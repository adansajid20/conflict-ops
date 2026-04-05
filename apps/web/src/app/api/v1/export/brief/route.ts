export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })

  const body = await req.json() as {
    brief_type?: string
    region?: string
    cluster_id?: string
    event_ids?: string[]
    user_id?: string
  }
  const { brief_type = 'region', region, cluster_id, event_ids, user_id } = body

  const h30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const h24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let content = ''
  let title = ''

  if (brief_type === 'region' && region) {
    const [{ data: events }, { data: riskData }, { data: preds }, { data: corrs }] = await Promise.all([
      supabase.from('events').select('title,severity,occurred_at,region,source,summary').ilike('region', `%${region}%`).gte('occurred_at', h30d).order('occurred_at', { ascending: false }).limit(20),
      supabase.from('region_risk_scores').select('*').ilike('region', `%${region}%`).limit(1).single(),
      supabase.from('predictions').select('title,probability,prediction_type,time_horizon_hours').gt('expires_at', new Date().toISOString()).is('outcome', null).ilike('region', `%${region}%`).order('probability', { ascending: false }).limit(5),
      supabase.from('correlation_signals').select('description,confidence,pattern_type').gte('detected_at', h24h).ilike('region', `%${region}%`).limit(5),
    ])

    title = `Region Brief: ${region} — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`

    const prompt = `Generate a professional intelligence brief for ${region}. Format in markdown with sections: EXECUTIVE SUMMARY, SITUATION OVERVIEW, KEY EVENTS, ACTIVE PREDICTIONS, INTELLIGENCE CORRELATIONS, RISK ASSESSMENT, RECOMMENDATIONS.

DATA:
Risk Score: ${(riskData as Record<string,unknown>)?.score ?? 'N/A'}/10 | Trend: ${(riskData as Record<string,unknown>)?.trend ?? 'unknown'}
Events (last 30d): ${JSON.stringify(events?.slice(0, 10))}
Active Predictions: ${JSON.stringify(preds)}
Correlations: ${JSON.stringify(corrs)}

Write a 600-800 word brief. Be specific, analytical, and actionable.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6-20250514', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json() as { content?: Array<{ text?: string }> }
    content = data.content?.[0]?.text ?? ''
  } else if (brief_type === 'situation' && cluster_id) {
    const { data: cluster } = await supabase.from('event_clusters').select('*').eq('id', cluster_id).single()
    const ids = (cluster?.event_ids ?? []) as string[]
    const { data: events } = await supabase.from('events').select('title,severity,occurred_at,summary').in('id', ids.slice(0, 30)).order('occurred_at', { ascending: true })
    title = `Situation Brief: ${(cluster as Record<string,unknown>)?.canonical_title ?? 'Unnamed'} — ${new Date().toLocaleDateString()}`

    const prompt = `Generate an incident timeline intelligence brief. Format: SITUATION OVERVIEW, TIMELINE, TURNING POINTS, CURRENT STATUS, OUTLOOK. Events: ${JSON.stringify(events?.slice(0, 15))}. 400-500 words, markdown.`
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json() as { content?: Array<{ text?: string }> }
    content = data.content?.[0]?.text ?? ''
  } else if (brief_type === 'daily') {
    // Return the most recent daily briefing
    const { data: report } = await supabase.from('reports').select('title,content').eq('report_type', 'daily_briefing').order('created_at', { ascending: false }).limit(1).single()
    title = (report?.title as string) ?? 'Daily Intelligence Brief'
    content = (report?.content as string) ?? 'No daily brief available. Run the generate-daily-brief cron.'
  } else {
    return NextResponse.json({ error: 'brief_type must be region, situation, or daily' }, { status: 400 })
  }

  // Save to reports table
  const { data: saved } = await supabase.from('reports').insert({
    user_id: user_id ?? null,
    report_type: brief_type === 'situation' ? 'incident_report' : brief_type === 'daily' ? 'daily_briefing' : 'region_deep_dive',
    title,
    content,
    region: region ?? null,
  }).select('id').single()

  return NextResponse.json({ id: saved?.id, title, content, format: 'markdown' })
}
