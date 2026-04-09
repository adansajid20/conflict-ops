export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ generated: false, reason: 'No ANTHROPIC_API_KEY' })

  const supabase = createServiceClient()
  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: events }, { data: hotspots }, { data: predictions }, { data: correlations }] = await Promise.all([
    supabase.from('events').select('id, title, severity, region, category, summary').gte('occurred_at', h24).gte('severity', 3).order('severity', { ascending: false }).limit(20),
    supabase.from('region_risk_scores').select('region, score, trend').order('score', { ascending: false }).limit(8),
    supabase.from('predictions').select('title, region, probability, prediction_type, severity_if_true').gt('expires_at', new Date().toISOString()).is('outcome', null).order('probability', { ascending: false }).limit(5),
    supabase.from('correlation_signals').select('description, pattern_type, region').gt('detected_at', h24).order('confidence', { ascending: false }).limit(5),
  ])

  const context = `
CRITICAL/HIGH EVENTS (last 24h):
${events?.map(e => `- [${e.severity}] ${e.region}: ${e.title}`).join('\n') ?? 'None'}

RISK HOTSPOTS:
${hotspots?.map(h => `- ${h.region}: ${h.score}/10 (${h.trend})`).join('\n') ?? 'None'}

ACTIVE PREDICTIONS:
${predictions?.map(p => `- ${p.region} ${p.prediction_type}: ${p.title} (${Math.round((p.probability ?? 0) * 100)}%)`).join('\n') ?? 'None'}

CORRELATION SIGNALS:
${correlations?.map(c => `- [${c.pattern_type}] ${c.description?.slice(0, 150)}`).join('\n') ?? 'None'}
`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a senior intelligence analyst at ConflictRadar. Write today's intelligence briefing in markdown. Be concise, analytical, and actionable.

${context}

Structure:
# DAILY INTELLIGENCE BRIEFING — ${new Date().toDateString()}
## THREAT LEVEL
## SITUATION OVERVIEW (3-4 bullet key takeaways)
## CRITICAL DEVELOPMENTS (top 3-4 events with analysis)
## ACTIVE PREDICTIONS (what to watch)
## CORRELATIONS & SIGNALS (cross-stream intelligence)
## ANALYST NOTE (one insight that isn't obvious from the data)

Write for intelligence professionals. No fluff.`
      }]
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) return NextResponse.json({ generated: false, reason: 'Anthropic error' })

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const content = data.content[0]?.type === 'text' ? data.content[0].text : ''

  const today = new Date().toISOString().split('T')[0]
  await supabase.from('reports').insert({
    report_type: 'daily_briefing',
    title: `Daily Intelligence Briefing — ${today}`,
    content,
    summary: `${events?.length ?? 0} critical events, ${hotspots?.length ?? 0} hotspots, ${predictions?.length ?? 0} active predictions`,
    event_ids: events?.map(e => e.id) ?? [],
    prediction_ids: predictions?.map(p => (p as unknown as { id: string }).id).filter(Boolean) ?? [],
  })

  return NextResponse.json({ generated: true, date: today })
}
