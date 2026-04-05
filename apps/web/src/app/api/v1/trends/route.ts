export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const [eventsRes, regionsRes, sourcesRes, predictionsRes] = await Promise.all([
    supabase.from('events').select('occurred_at, severity, region, category, source').gte('occurred_at', since),
    supabase.from('region_risk_scores').select('region, score, previous_score, trend, event_count_24h, critical_count_24h, calculated_at').order('score', { ascending: false }).limit(20),
    supabase.from('source_credibility').select('source_domain, display_name, credibility_score, total_events, verified_events').order('total_events', { ascending: false }).limit(15),
    supabase.from('predictions').select('prediction_type, outcome, probability, region, created_at').gte('created_at', since),
  ])

  const events = eventsRes.data ?? []

  // Daily volume by severity
  const dailyMap = new Map<string, { critical: number; high: number; medium: number; low: number }>()
  for (const e of events) {
    const day = (e.occurred_at ?? '').slice(0, 10)
    if (!day) continue
    if (!dailyMap.has(day)) dailyMap.set(day, { critical: 0, high: 0, medium: 0, low: 0 })
    const d = dailyMap.get(day)!
    const sev = e.severity as number ?? 1
    if (sev >= 4) d.critical++
    else if (sev >= 3) d.high++
    else if (sev >= 2) d.medium++
    else d.low++
  }
  const dailyVolume = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => ({ date, ...counts, total: counts.critical + counts.high + counts.medium + counts.low }))

  // Region breakdown
  const regionMap = new Map<string, { critical: number; high: number; medium: number; low: number }>()
  for (const e of events) {
    const r = e.region ?? 'Unknown'
    if (!regionMap.has(r)) regionMap.set(r, { critical: 0, high: 0, medium: 0, low: 0 })
    const d = regionMap.get(r)!
    const sev = e.severity as number ?? 1
    if (sev >= 4) d.critical++
    else if (sev >= 3) d.high++
    else if (sev >= 2) d.medium++
    else d.low++
  }
  const regionBreakdown = [...regionMap.entries()]
    .map(([region, counts]) => ({ region, ...counts, total: counts.critical + counts.high + counts.medium + counts.low }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)

  // Category breakdown
  const catMap = new Map<string, number>()
  for (const e of events) {
    const c = (e.category as string | null) ?? 'uncategorized'
    catMap.set(c, (catMap.get(c) ?? 0) + 1)
  }
  const categoryBreakdown = [...catMap.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count)

  // Prediction accuracy
  const preds = predictionsRes.data ?? []
  const predAccuracy = {
    confirmed: preds.filter(p => p.outcome === 'confirmed').length,
    denied: preds.filter(p => p.outcome === 'denied').length,
    expired: preds.filter(p => p.outcome === 'expired').length,
    active: preds.filter(p => !p.outcome).length,
    total: preds.length,
    accuracy_pct: preds.filter(p => p.outcome !== null).length > 0
      ? Math.round(preds.filter(p => p.outcome === 'confirmed').length / preds.filter(p => p.outcome !== null).length * 100)
      : null,
  }

  // Severity trend (this week vs last week)
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const thisWeekEvts = events.filter(e => (e.occurred_at ?? '') >= lastWeek)
  const lastWeekEvts = events.filter(e => (e.occurred_at ?? '') >= twoWeeksAgo && (e.occurred_at ?? '') < lastWeek)
  const trend = thisWeekEvts.length > lastWeekEvts.length * 1.2 ? 'escalating' : thisWeekEvts.length < lastWeekEvts.length * 0.8 ? 'de_escalating' : 'stable'

  return NextResponse.json({
    days,
    total_events: events.length,
    trend,
    this_week: thisWeekEvts.length,
    last_week: lastWeekEvts.length,
    daily_volume: dailyVolume,
    region_breakdown: regionBreakdown,
    category_breakdown: categoryBreakdown,
    hotspots: regionsRes.data ?? [],
    sources: sourcesRes.data ?? [],
    prediction_accuracy: predAccuracy,
    generated_at: new Date().toISOString(),
  })
}
