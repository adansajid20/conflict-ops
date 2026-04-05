export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'No ANTHROPIC_API_KEY' }, { status: 500 })

  const supabase = createServiceClient()
  const body = await req.json() as { report_type?: string; region?: string; user_id?: string; custom_prompt?: string }
  const { report_type = 'region_deep_dive', region, user_id, custom_prompt } = body

  if (!region && report_type !== 'daily_briefing' && report_type !== 'custom') {
    return NextResponse.json({ error: 'region required for this report type' }, { status: 400 })
  }

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const h7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase.from('events').select('title, severity, region, category, summary, occurred_at').gte('occurred_at', h7d).order('severity', { ascending: false }).limit(30)
  if (region) query = query.ilike('region', `%${region}%`)
  const { data: events } = await query

  const { data: predictions } = await supabase.from('predictions').select('title, probability, description, severity_if_true').gt('expires_at', new Date().toISOString()).is('outcome', null).order('probability', { ascending: false }).limit(5)

  const prompt = custom_prompt ?? `Generate a ${report_type} intelligence report for ${region ?? 'the world'}.

Recent events:
${events?.map(e => `- [${e.severity}] ${e.title} (${e.occurred_at?.slice(0, 10)})`).join('\n') ?? 'None'}

Active predictions:
${predictions?.map(p => `- ${p.title} (${Math.round((p.probability ?? 0) * 100)}%)`).join('\n') ?? 'None'}

Format as a professional intelligence report in markdown. Include: executive summary, key developments, threat assessment, predictions, and recommendations.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6-20250514', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const content = data.content[0]?.type === 'text' ? data.content[0].text : ''

  const { data: report, error } = await supabase.from('reports').insert({
    user_id: user_id ?? null, report_type, region: region ?? null,
    title: `${report_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}${region ? ` — ${region}` : ''} — ${new Date().toDateString()}`,
    content, summary: content.slice(0, 300) + '...',
    event_ids: events?.map(e => (e as unknown as { id: string }).id).filter(Boolean) ?? [],
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report })
}
