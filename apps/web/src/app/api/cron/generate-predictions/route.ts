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
  if (!key) return NextResponse.json({ generated: 0, disabled: true, reason: 'No ANTHROPIC_API_KEY' })

  const supabase = createServiceClient()
  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: hotClusters }, { data: multiSignals }, { data: patternMatches }] = await Promise.all([
    supabase.from('event_clusters').select('*').eq('escalation_trajectory', 'escalating').gte('event_count', 5).order('escalation_velocity', { ascending: false }).limit(4),
    supabase.from('correlation_signals').select('*').eq('pattern_type', 'multi_signal').gt('detected_at', h24).limit(3),
    supabase.from('correlation_signals').select('*').eq('pattern_type', 'historical_match').gt('detected_at', h24).limit(3),
  ])

  const situations = [
    ...(hotClusters ?? []).map(c => ({ type: 'cluster', data: c, region: c.region ?? 'Global' })),
    ...(multiSignals ?? []).map(s => ({ type: 'multi_signal', data: s, region: s.region ?? 'Global' })),
    ...(patternMatches ?? []).map(p => ({ type: 'pattern', data: p, region: p.region ?? 'Global' })),
  ]

  let generated = 0

  for (const sit of situations.slice(0, 6)) {
    try {
      // Skip if we already have a prediction for this region in last 12h
      const { data: existing } = await supabase.from('predictions').select('id').eq('region', sit.region).gt('created_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()).limit(1)
      if (existing?.length) continue

      let context = ''
      if (sit.type === 'cluster') {
        const cluster = sit.data as Record<string,unknown>
        const { data: evts } = await supabase.from('events').select('title, severity, category, summary').eq('cluster_id', cluster.id as string).order('occurred_at', { ascending: false }).limit(10)
        context = `ESCALATING SITUATION in ${sit.region}:
Cluster: ${cluster.name}
Events: ${cluster.event_count} | Trajectory: escalating (velocity: ${cluster.escalation_velocity}) | Severity: ${cluster.severity}
Recent events:\n${evts?.map(e => `- [${e.severity}] ${e.title}`).join('\n') ?? 'None'}`
      } else if (sit.type === 'multi_signal') {
        context = `MULTI-SIGNAL CONVERGENCE in ${sit.region}:\n${(sit.data as Record<string,unknown>).description}`
      } else {
        context = `HISTORICAL PATTERN MATCH in ${sit.region}:\n${(sit.data as Record<string,unknown>).description}`
      }

      const { data: corrs } = await supabase.from('correlation_signals').select('pattern_type, description, confidence').ilike('region', `%${sit.region}%`).gt('detected_at', h24).limit(5)
      const corrContext = corrs?.map(c => `- [${c.pattern_type}] ${c.description}`).join('\n') ?? 'None'

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `You are a geopolitical intelligence analyst. Generate a specific, actionable prediction based on the following intelligence. Return ONLY valid JSON.

${context}

Active correlations in ${sit.region}:
${corrContext}

Return exactly this JSON:
{
  "prediction_type": "escalation|attack|diplomatic|humanitarian|economic",
  "title": "Specific prediction headline (max 100 chars)",
  "description": "2-3 paragraph analysis explaining WHY, WHAT evidence supports it, and implications",
  "probability": 0.0-0.95,
  "time_horizon_hours": 24-168,
  "severity_if_true": "critical|high|medium|low",
  "key_indicators": ["specific things to monitor that would confirm or deny this"]
}

Be specific. Not vague. If evidence is weak: 0.2-0.4. If converging: 0.65-0.85. Never exceed 0.95.`
          }]
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) continue
      const resp = await res.json() as { content: Array<{ type: string; text: string }> }
      const text = resp.content[0]?.type === 'text' ? resp.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) continue

      const pred = JSON.parse(jsonMatch[0]) as Record<string,unknown>

      await supabase.from('predictions').insert({
        prediction_type: pred.prediction_type ?? 'escalation',
        title: (pred.title as string ?? '').slice(0, 200),
        description: pred.description ?? '',
        region: sit.region,
        probability: Math.min((pred.probability as number) ?? 0.5, 0.95),
        time_horizon_hours: (pred.time_horizon_hours as number) ?? 48,
        severity_if_true: pred.severity_if_true ?? 'high',
        evidence: {
          situation_type: sit.type,
          correlations: corrs?.map(c => c.description),
          key_indicators: pred.key_indicators,
        },
        expires_at: new Date(Date.now() + ((pred.time_horizon_hours as number) ?? 48) * 60 * 60 * 1000).toISOString(),
      })
      generated++
    } catch (e) { console.warn('Prediction error:', e) }
  }

  const { count: activeCount } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString()).is('outcome', null)
  await supabase.from('tracking_stats').upsert({ stat_type: 'predictions', count: activeCount ?? 0, updated_at: new Date().toISOString() }, { onConflict: 'stat_type' })

  return NextResponse.json({ generated, active_predictions: activeCount ?? 0 })
}
