import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { copilotTools, type CopilotToolName } from '@/lib/ai/copilot-tools'
import type { ApiResponse } from '@conflict-ops/shared'

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(4000),
})

const RequestSchema = z.object({
  org_id: z.string().uuid(),
  messages: z.array(MessageSchema).min(1).max(20),
  top_stories: z.array(z.object({
    id: z.string().optional(),
    title: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    event_type: z.string().nullable().optional(),
    severity: z.number().nullable().optional(),
    occurred_at: z.string().nullable().optional(),
    outlet_name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  })).max(20).optional(),
})

type ChatMessage = z.infer<typeof MessageSchema>
type CopilotResponse = { response: string; grounded: boolean; unavailable?: boolean }

const OPENAI_API_BASE = 'https://api.openai.com/v1'

async function verifyOrg(userId: string, orgId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  return data?.org_id === orgId
}

async function callOpenAI(messages: Array<Record<string, unknown>>, tools: Array<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env['OPENAI_API_KEY']}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0,
      messages,
      tools,
      tool_choice: 'auto',
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return response.json() as Promise<Record<string, unknown>>
}

function toolSpecs(): Array<Record<string, unknown>> {
  return [
    {
      type: 'function',
      function: {
        name: 'search_events',
        description: 'Search recent events for the current org context. Use for what is happening, high severity, countries, time windows.',
        parameters: { type: 'object', properties: { query: { type: 'string' }, country_code: { type: 'string' }, region: { type: 'string' }, severity_gte: { type: 'number' }, hours: { type: 'number' }, limit: { type: 'number' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_mission',
        description: 'Fetch a mission by ID or fuzzy name for mission summaries.',
        parameters: { type: 'object', properties: { mission_id: { type: 'string' }, mission_name: { type: 'string' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_forecast',
        description: 'Fetch grounded forecast records for a region or country.',
        parameters: { type: 'object', properties: { region: { type: 'string' }, country_code: { type: 'string' }, horizon_days: { type: 'number' } } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_alerts',
        description: 'Fetch recent alerts for the organization.',
        parameters: { type: 'object', properties: { severity_gte: { type: 'number' }, unread_only: { type: 'boolean' }, limit: { type: 'number' } } },
      },
    },
  ]
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<CopilotResponse>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  if (!process.env['OPENAI_API_KEY']) {
    return NextResponse.json({ success: true, data: { response: 'AI Co-pilot unavailable', grounded: false, unavailable: true } })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const allowed = await verifyOrg(userId, parsed.data.org_id)
  if (!allowed) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const overviewContext = (parsed.data.top_stories ?? []).map((event, index) => ({
    rank: index + 1,
    id: event.id ?? null,
    title: event.title ?? null,
    region: event.region ?? null,
    event_type: event.event_type ?? null,
    severity: event.severity ?? null,
    occurred_at: event.occurred_at ?? null,
    outlet_name: event.outlet_name ?? null,
    description: event.description ?? null,
  }))

  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: `You are the CONFLICTRADAR Intel Analyst co-pilot. Never hallucinate. Use tools when factual data is needed. If tool data is empty or unavailable, say so plainly. Ground all claims in returned data. Include inline event references as [event:<id>] when citing event records. Current overview top stories context: ${JSON.stringify(overviewContext)}`,
    },
    ...parsed.data.messages.map((message: ChatMessage) => ({ role: message.role, content: message.content })),
  ]

  try {
    const firstPass = await callOpenAI(messages, toolSpecs())
    const choice = (((firstPass.choices as Array<Record<string, unknown>> | undefined) ?? [])[0] ?? {}) as Record<string, unknown>
    const message = (choice.message as Record<string, unknown> | undefined) ?? {}
    const toolCalls = (message.tool_calls as Array<Record<string, unknown>> | undefined) ?? []

    if (toolCalls.length === 0) {
      const content = typeof message.content === 'string' ? message.content : 'No grounded response available.'
      return NextResponse.json({ success: true, data: { response: content, grounded: false } })
    }

    const nextMessages = [...messages, message]

    for (const toolCall of toolCalls) {
      const functionRecord = (toolCall.function as Record<string, unknown> | undefined) ?? {}
      const rawName = functionRecord.name
      if (typeof rawName !== 'string' || !(rawName in copilotTools)) continue
      const argsText = typeof functionRecord.arguments === 'string' ? functionRecord.arguments : '{}'
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(argsText) as Record<string, unknown> } catch { args = {} }
      const toolName = rawName as CopilotToolName
      const result = await copilotTools[toolName]({ ...args, org_id: parsed.data.org_id } as never)
      nextMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      })
    }

    const finalPass = await callOpenAI(nextMessages, toolSpecs())
    const finalChoice = ((((finalPass.choices as Array<Record<string, unknown>> | undefined) ?? [])[0] ?? {}) as Record<string, unknown>)
    const finalMessage = (finalChoice.message as Record<string, unknown> | undefined) ?? {}
    const content = typeof finalMessage.content === 'string' ? finalMessage.content : 'No grounded response available.'

    return NextResponse.json({ success: true, data: { response: content, grounded: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Copilot failed'
    return NextResponse.json({ success: true, data: { response: `AI Co-pilot temporarily unavailable: ${message}`, grounded: false, unavailable: true } })
  }
}
