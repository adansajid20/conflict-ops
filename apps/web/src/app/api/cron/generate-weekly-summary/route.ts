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
  if (!key) return NextResponse.json({ generated: false, reason: 'No ANTHROPIC_API_KEY' })

  const supabase = createServiceClient()
  const h7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: events }, { data: hotspots }, { data: predictions }, { data: confirmed }, { data: patterns }] = await Promise.all([
    supabase.from('events').select('severity, region, category').gte('occurred_at', h7d),
    supabase.from('region_risk_scores').select('region, score, trend, event_count_24h').order('score', { ascending: false }).limit(10),
    supabase.from('predictions').select('title, probability, region, outcome').gte('created_at', h7d),
    supabase.from('predictions').select('title, region, outcome').gte('created_at', h7d).eq('outcome', 'confirmed'),
    supabase.from('correlation_signals').select('pattern_type, region, confidence').gte('detected_at', h7d).order('confidence', { ascending: false }).limit(10),
  ])

  const totalEvents = events?.length ?? 0
  const criticalCount = events?.filter(e => e.severity >= 4).length ?? 0
  const regionBreakdown = (hotspots ?? []).slice(0, 8).map(h => `${h.region}: ${h.score}/10 (${h.trend})`).join(', ')
  const predAccuracy = predictions?.length ? `${Math.round((confirmed?.length ?? 0) / predictions.length * 100)}% accuracy (${confirmed?.length ?? 0}/${predictions?.length ?? 0} confirmed)` : 'No predictions evaluated'

  const prompt = `You are a senior intelligence analyst. Write a comprehensive WEEKLY INTELLIGENCE SUMMARY in markdown covering the past 7 days.

DATA SUMMARY:
- Total events: ${totalEvents} (${criticalCount} critical)
- Top risk regions: ${regionBreakdown}
- Prediction accuracy this week: ${predAccuracy}
- Notable patterns: ${(patterns ?? []).map(p => `[${p.pattern_type}] ${p.region}`).join(', ') || 'None'}

Structure:
# WEEKLY INTELLIGENCE SUMMARY — Week of ${new Date(h7d).toDateString()} to ${new Date().toDateString()}
## EXECUTIVE SUMMARY (5-bullet week-in-review)
## CONFLICT TRACKER (top 5 situations with 7d trajectory)
## ESCALATION WATCHLIST (situations to watch in coming week)
## PREDICTION REVIEW (what we predicted, what happened)
## INTELLIGENCE SIGNALS (notable cross-stream correlations)
## WEEK AHEAD FORECAST (top 3 predictions for the next 7 days)
## ANALYST ASSESSMENT (one contrarian take)

Write for senior intelligence professionals. Dense, analytical, no filler.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6-20250514', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(90000),
  })

  if (!res.ok) return NextResponse.json({ generated: false, reason: 'Anthropic error' })
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  const content = data.content[0]?.type === 'text' ? data.content[0].text : ''

  const weekOf = new Date(h7d).toISOString().split('T')[0]
  await supabase.from('reports').insert({
    report_type: 'weekly_summary',
    title: `Weekly Intelligence Summary — ${weekOf}`,
    content,
    summary: `${totalEvents} events · ${criticalCount} critical · ${hotspots?.length ?? 0} hotspots tracked`,
    event_ids: [],
  })

  return NextResponse.json({ generated: true, week_of: weekOf })
}
