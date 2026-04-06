export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(4000),
})

const RequestSchema = z.object({
  org_id: z.string().optional(),
  messages: z.array(MessageSchema).min(1).max(20),
  top_stories: z.array(z.object({
    id: z.string().optional(),
    title: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    event_type: z.string().nullable().optional(),
    severity: z.number().nullable().optional(),
    occurred_at: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
  })).max(20).optional(),
})

type ChatMessage = z.infer<typeof MessageSchema>
type CopilotResponse = { response: string; grounded: boolean; unavailable?: boolean }

async function buildContext(supabase: ReturnType<typeof createServiceClient>) {
  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [{ data: events }, { data: hotspots }, { data: predictions }, { data: patterns }] = await Promise.all([
    supabase.from('events').select('id,title,severity,region,category,occurred_at,summary').gte('occurred_at', h24).gte('severity', 3).order('severity', { ascending: false }).limit(15),
    supabase.from('region_risk_scores').select('region,score,trend,event_count_24h').order('score', { ascending: false }).limit(8),
    supabase.from('predictions').select('title,probability,region,prediction_type,expires_at').is('outcome', null).gt('expires_at', new Date().toISOString()).order('probability', { ascending: false }).limit(5),
    supabase.from('correlation_signals').select('description,pattern_type,region,confidence').gt('detected_at', h24).order('confidence', { ascending: false }).limit(5),
  ])
  return { events: events ?? [], hotspots: hotspots ?? [], predictions: predictions ?? [], patterns: patterns ?? [] }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<CopilotResponse>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 20 requests per minute per user
  const { checkRateLimit, AI_RATE_LIMIT } = await import('@/lib/rate-limit')
  const rl = await checkRateLimit(userId, AI_RATE_LIMIT.prefix, AI_RATE_LIMIT.maxRequests, AI_RATE_LIMIT.windowSeconds)
  if (!rl.allowed) return NextResponse.json({ success: false, error: 'Rate limit exceeded. Please wait a moment.' }, { status: 429 })

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    return NextResponse.json({ success: true, data: { response: 'AI Co-pilot unavailable — no API key configured.', grounded: false, unavailable: true } })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const ctx = await buildContext(supabase)

  const topStoriesCtx = (parsed.data.top_stories ?? []).slice(0, 15).map((e, i) => `${i+1}. [${e.severity ?? '?'}] ${e.region ?? '?'}: ${e.title ?? '(no title)'} (${(e.occurred_at ?? '').slice(0,16)})`).join('\n')

  const systemPrompt = `You are the CONFLICTRADAR Intel Analyst Co-pilot — an expert geopolitical intelligence assistant grounded in real-time platform data.

LIVE DATA (last 24h):

## HIGH-SEVERITY EVENTS
${ctx.events.map(e => `- [sev:${e.severity}] ${e.region}: ${e.title}${e.summary ? ` — ${e.summary.slice(0,100)}` : ''}`).join('\n') || 'None'}

## RISK HOTSPOTS
${ctx.hotspots.map(h => `- ${h.region}: ${h.score}/10 (${h.trend}), ${h.event_count_24h} events/24h`).join('\n') || 'None'}

## ACTIVE PREDICTIONS
${ctx.predictions.map(p => `- ${p.region} ${p.prediction_type}: ${p.title} (${Math.round((p.probability ?? 0)*100)}%)`).join('\n') || 'None'}

## CORRELATION SIGNALS
${ctx.patterns.map(p => `- [${p.pattern_type}/${Math.round((p.confidence ?? 0)*100)}%] ${p.description}`).join('\n') || 'None'}

${topStoriesCtx ? `## OVERVIEW CONTEXT\n${topStoriesCtx}` : ''}

RULES:
- Only answer from the above data. Do not hallucinate.
- If asked about something not in the data, say "No data available for that in the current window."
- Be concise, analytical, and direct. Use bullet points for multi-part answers.
- Reference specific regions, scores, and events when available.
- If asked for predictions or forecasts, use the Predictions section above.`

  const conversationMessages = parsed.data.messages
    .filter(m => m.role !== 'system')
    .map((m: ChatMessage) => ({ role: m.role, content: m.content }))

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationMessages,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const content = data.content.find(c => c.type === 'text')?.text ?? 'No response available.'
    return NextResponse.json({ success: true, data: { response: content, grounded: true } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Copilot failed'
    return NextResponse.json({ success: true, data: { response: `Co-pilot temporarily unavailable: ${msg}`, grounded: false, unavailable: true } })
  }
}
