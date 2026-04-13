import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

type AnalyzeBody = { event_id?: string }
type AnalyzeResult = { is_disinfo: boolean; confidence: number; indicators: string[] }

type EventRow = {
  id: string
  title: string | null
  description: string | null
  source: string | null
}

async function analyzeWithOpenAI(event: EventRow): Promise<AnalyzeResult | null> {
  const apiKey = process.env['OPENAI_API_KEY']
  if (!apiKey) return null

  const prompt = `Assess whether this event resembles common disinformation patterns (fabricated sourcing, emotional manipulation, unverifiable specifics, recycled propaganda tropes). Return JSON with keys is_disinfo, confidence (0-1), indicators (string[]).\n\nTitle: ${event.title ?? ''}\nSource: ${event.source ?? ''}\nBody: ${event.description ?? ''}`
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 250,
      }),
    })
    if (!response.ok) return null
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const content = json.choices?.[0]?.message?.content
    if (!content) return null
    const parsed = JSON.parse(content) as AnalyzeResult
    return {
      is_disinfo: Boolean(parsed.is_disinfo),
      confidence: Number(parsed.confidence ?? 0),
      indicators: Array.isArray(parsed.indicators) ? parsed.indicators.map(String) : [],
    }
  } catch {
    return null
  }
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<AnalyzeResult>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as AnalyzeBody | null
  if (!body?.event_id) return NextResponse.json({ success: false, error: 'event_id is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: event, error } = await supabase
    .from('events')
    .select('id, title, description, source')
    .eq('id', body.event_id)
    .single()

  if (error || !event) return NextResponse.json({ success: false, error: error?.message ?? 'Event not found' }, { status: 404 })

  const analyzed = await analyzeWithOpenAI(event as EventRow)
  const fallback: AnalyzeResult = analyzed ?? {
    is_disinfo: false,
    confidence: 0.15,
    indicators: ['AI unavailable or low-signal event'],
  }

  await supabase.from('events').update({ disinfo_checked_at: new Date().toISOString() }).eq('id', body.event_id)

  return NextResponse.json({ success: true, data: fallback })
}
