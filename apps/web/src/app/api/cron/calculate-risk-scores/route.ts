export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const h48 = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: events } = await supabase.from('events').select('region, severity, occurred_at').gte('occurred_at', h48).not('region', 'is', null)
  const { data: correlations } = await supabase.from('correlation_signals').select('region, confidence, pattern_type').gt('detected_at', h24).not('region', 'is', null)
  const { data: predictions } = await supabase.from('predictions').select('region, probability, severity_if_true').gt('expires_at', new Date().toISOString()).is('outcome', null)

  const regionMap = new Map<string, { c24: number; h24: number; m24: number; l24: number; total24: number; total48: number }>()
  const cutoff24 = Date.now() - 24 * 60 * 60 * 1000

  for (const e of events ?? []) {
    const r = e.region as string
    if (!regionMap.has(r)) regionMap.set(r, { c24: 0, h24: 0, m24: 0, l24: 0, total24: 0, total48: 0 })
    const entry = regionMap.get(r)!
    const isRecent = new Date(e.occurred_at ?? '').getTime() > cutoff24
    entry.total48++
    if (isRecent) {
      entry.total24++
      const sev = e.severity as number ?? 1
      if (sev >= 4) entry.c24++
      else if (sev >= 3) entry.h24++
      else if (sev >= 2) entry.m24++
      else entry.l24++
    }
  }

  let calculated = 0
  for (const [region, stats] of regionMap) {
    const { data: prev } = await supabase.from('region_risk_scores').select('score').eq('region', region).single()

    let score = stats.c24 * 2.5 + stats.h24 * 1.2 + stats.m24 * 0.3 + stats.l24 * 0.05
    score = Math.min(score, 7)

    const regionCorrs = (correlations ?? []).filter(c => (c.region as string | null)?.toLowerCase().includes(region.toLowerCase()))
    score += Math.min(regionCorrs.reduce((sum, c) => sum + (c.confidence as number ?? 0) * 0.4, 0), 1.5)

    const regionPreds = (predictions ?? []).filter(p => (p.region as string | null)?.toLowerCase().includes(region.toLowerCase()))
    const predBonus = regionPreds.reduce((sum, p) => {
      const sm = p.severity_if_true === 'critical' ? 1.0 : p.severity_if_true === 'high' ? 0.7 : 0.3
      return sum + (p.probability as number ?? 0) * sm
    }, 0)
    score += Math.min(predBonus, 1.5)
    score = Math.min(Math.round(score * 10) / 10, 10)

    const prev24 = stats.total48 - stats.total24
    const trend: 'escalating' | 'stable' | 'de_escalating' = stats.total24 > prev24 * 1.3 ? 'escalating' : stats.total24 < prev24 * 0.7 ? 'de_escalating' : 'stable'

    await supabase.from('region_risk_scores').upsert({
      region, score, previous_score: (prev?.score as number | null) ?? null, trend,
      components: { base_events: stats.c24 * 2.5 + stats.h24 * 1.2, correlations: regionCorrs.length, predictions: regionPreds.length, total_events_24h: stats.total24, critical_24h: stats.c24 },
      event_count_24h: stats.total24, critical_count_24h: stats.c24,
      prediction_count: regionPreds.length, active_correlations: regionCorrs.length,
      calculated_at: new Date().toISOString(),
    }, { onConflict: 'region' })
    calculated++
  }

  return NextResponse.json({ calculated })
}
