export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ generated: 0, reason: 'No ANTHROPIC_API_KEY' })

  const supabase = createServiceClient()
  const h1 = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Find regions with 3+ critical events in last hour
  const { data: critEvents } = await supabase.from('events').select('id, title, region, severity, occurred_at, summary').gte('occurred_at', h1).eq('severity', 4).order('occurred_at', { ascending: false })

  const regionMap = new Map<string, typeof critEvents>()
  for (const e of critEvents ?? []) {
    const r = (e.region as string) ?? 'unknown'
    if (!regionMap.has(r)) regionMap.set(r, [])
    regionMap.get(r)!.push(e)
  }

  let generated = 0

  for (const [region, events] of regionMap) {
    if ((events?.length ?? 0) < 3) continue

    // Check if we already generated a flash report for this region in last 2h
    const h2 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase.from('reports').select('id').eq('report_type', 'flash_report').ilike('region', region).gte('created_at', h2).limit(1)
    if (existing?.length) continue

    const prompt = `You are a senior intelligence analyst. Write an urgent FLASH REPORT for a rapidly developing situation.

REGION: ${region}
CRITICAL EVENTS IN LAST HOUR (${events?.length}):
${(events ?? []).map(e => `- ${e.title}${e.summary ? ': ' + e.summary : ''}`).join('\n')}

Write a flash report in markdown:
# ⚡ FLASH REPORT — ${region.toUpperCase()} — ${new Date().toUTCString()}
## SITUATION SUMMARY (2-3 sentences, what is happening RIGHT NOW)
## KEY DEVELOPMENTS (bullet list of confirmed events)
## IMMEDIATE THREATS (what could escalate in next 6 hours)
## RECOMMENDED ACTIONS (for analysts monitoring this situation)

Be urgent, specific, and analytical. This goes to analysts within minutes of events occurring.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) continue
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const content = data.content[0]?.type === 'text' ? data.content[0].text : ''

    await supabase.from('reports').insert({
      report_type: 'flash_report',
      region,
      title: `⚡ FLASH: ${region} — ${events?.length} critical events in 1h`,
      content,
      summary: (events ?? []).slice(0, 2).map(e => e.title).join(' | '),
      event_ids: (events ?? []).map(e => e.id as string).filter(Boolean),
    })

    generated++
  }

  return NextResponse.json({ generated, regions_checked: regionMap.size })
}
