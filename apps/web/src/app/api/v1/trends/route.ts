export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* ------------------------------------------------------------------ */
/*  Advanced Intelligence Trends API                                   */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const priorStart = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString()

  /* ---- Parallel data fetches ---- */
  const [
    eventsRes,
    priorEventsRes,
    regionsRes,
    predictionsRes,
    forecastRes,
    countryRiskRes,
  ] = await Promise.all([
    // Current period events — pull rich fields
    supabase.from('events')
      .select('id, occurred_at, severity, region, country_code, event_type, category, entities, provenance_raw, provenance_inferred, escalation_indicator, significance_score, sentiment_score, is_humanitarian_report, casualty_estimate, actor_ids')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(5000),
    // Prior period events (for comparison)
    supabase.from('events')
      .select('id, occurred_at, severity, region, country_code, event_type, category, provenance_raw, escalation_indicator, is_humanitarian_report, casualty_estimate, entities')
      .gte('occurred_at', priorStart)
      .lt('occurred_at', since)
      .limit(5000),
    // Region risk scores
    supabase.from('region_risk_scores')
      .select('region, score, previous_score, trend, event_count_24h, critical_count_24h, calculated_at')
      .order('score', { ascending: false })
      .limit(30),
    // Predictions
    supabase.from('predictions')
      .select('id, prediction_type, title, outcome, probability, severity_if_true, region, time_horizon_hours, created_at, evidence')
      .gte('created_at', since),
    // Forecast signals
    supabase.from('forecast_signals')
      .select('id, conflict_zone, country_code, signal_type, confidence, basis, valid_until, created_at')
      .gte('created_at', since)
      .order('confidence', { ascending: false }),
    // Country risk scores
    supabase.from('country_risk_scores')
      .select('country_code, risk_score, trend, event_count_7d, severity_avg, updated_at')
      .order('risk_score', { ascending: false })
      .limit(50),
  ])

  const events = eventsRes.data ?? []
  const priorEvents = priorEventsRes.data ?? []
  const predictions = predictionsRes.data ?? []
  const forecastSignals = forecastRes.data ?? []
  const countryRisks = countryRiskRes.data ?? []

  // Build escalation levels from event data (the escalation_levels table doesn't exist in prod)
  const countryStats = new Map<string, { events: number; severity_sum: number; max_sev: number; fatalities: number; escalation_count: number }>()
  for (const e of events) {
    const cc = (e.country_code as string) ?? ''
    if (!cc) continue
    if (!countryStats.has(cc)) countryStats.set(cc, { events: 0, severity_sum: 0, max_sev: 0, fatalities: 0, escalation_count: 0 })
    const d = countryStats.get(cc)!
    d.events++
    const sev = (e.severity as number) ?? 1
    d.severity_sum += sev
    if (sev > d.max_sev) d.max_sev = sev
    const f = e.casualty_estimate as number | null
    if (typeof f === 'number') d.fatalities += f
    if (e.escalation_indicator) d.escalation_count++
  }

  const escalationLevels = [...countryStats.entries()]
    .filter(([, d]) => d.events >= 3) // only countries with meaningful activity
    .map(([cc, d]) => {
      const avgSev = d.severity_sum / d.events
      let level = 1
      if (d.fatalities > 200 || (d.max_sev >= 5 && d.events > 20)) level = 5
      else if (d.fatalities > 50 || (d.max_sev >= 4 && d.events > 10) || avgSev >= 4) level = 4
      else if (d.fatalities > 10 || (d.max_sev >= 3 && d.events > 5) || avgSev >= 3) level = 3
      else if (d.events >= 3 || avgSev >= 2) level = 2
      const labels = ['', 'Stable', 'Tension', 'Crisis', 'Conflict', 'War']
      return {
        country_code: cc,
        level,
        label: labels[level] ?? 'Unknown',
        event_count: d.events,
        avg_severity: Math.round(avgSev * 100) / 100,
        fatality_estimate: d.fatalities,
      }
    })
    .sort((a, b) => b.level - a.level || b.event_count - a.event_count)
    .slice(0, 30)

  /* ================================================================ */
  /*  1. COMMAND STRIP — KPIs                                         */
  /* ================================================================ */
  // Use casualty_estimate column for fatalities (integer, can be null)
  const totalFatalities = events.reduce((sum, e) => {
    const f = e.casualty_estimate as number | null
    return sum + (typeof f === 'number' ? f : 0)
  }, 0)
  const priorFatalities = priorEvents.reduce((sum, e) => {
    const f = e.casualty_estimate as number | null
    return sum + (typeof f === 'number' ? f : 0)
  }, 0)

  const displacementEvents = events.filter(e =>
    e.event_type === 'displacement' || e.event_type === 'humanitarian_crisis' || e.is_humanitarian_report === true
  ).length
  const priorDisplacement = priorEvents.filter(e =>
    e.event_type === 'displacement' || e.event_type === 'humanitarian_crisis' || e.is_humanitarian_report === true
  ).length

  const escalationEvents = events.filter(e => e.escalation_indicator === true).length
  const priorEscalationEvents = priorEvents.filter(e => e.escalation_indicator === true).length

  const activeConflictCountries = new Set(
    escalationLevels.filter(el => (el.level as number) >= 3).map(el => el.country_code)
  ).size

  // Escalation index = average escalation level across all tracked countries
  const escalationIndex = escalationLevels.length > 0
    ? Math.round((escalationLevels.reduce((s, el) => s + (el.level as number), 0) / escalationLevels.length) * 100) / 100
    : 0

  // Sparkline data (daily totals for last N days)
  const dailyMap = new Map<string, { total: number; critical: number; high: number; medium: number; low: number; fatalities: number }>()
  for (const e of events) {
    const day = (e.occurred_at ?? '').slice(0, 10)
    if (!day) continue
    if (!dailyMap.has(day)) dailyMap.set(day, { total: 0, critical: 0, high: 0, medium: 0, low: 0, fatalities: 0 })
    const d = dailyMap.get(day)!
    d.total++
    const sev = (e.severity as number) ?? 1
    if (sev >= 5) d.critical++
    else if (sev >= 4) d.high++
    else if (sev >= 3) d.medium++
    else d.low++
    const f = e.casualty_estimate as number | null
    if (typeof f === 'number') d.fatalities += f
  }
  const dailyVolume = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }))

  const pctChange = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0

  const commandStrip = {
    total_events: events.length,
    prior_events: priorEvents.length,
    events_change_pct: pctChange(events.length, priorEvents.length),
    total_fatalities: totalFatalities,
    prior_fatalities: priorFatalities,
    fatalities_change_pct: pctChange(totalFatalities, priorFatalities),
    displacement_events: displacementEvents,
    prior_displacement: priorDisplacement,
    displacement_change_pct: pctChange(displacementEvents, priorDisplacement),
    active_conflicts: activeConflictCountries,
    escalation_index: escalationIndex,
    escalation_events: escalationEvents,
    prior_escalation_events: priorEscalationEvents,
    escalation_change_pct: pctChange(escalationEvents, priorEscalationEvents),
    daily_sparkline: dailyVolume.map(d => d.total),
    fatality_sparkline: dailyVolume.map(d => d.fatalities),
  }

  /* ================================================================ */
  /*  2. ESCALATION TIMELINE                                          */
  /* ================================================================ */
  const escalationTimeline = escalationLevels.slice(0, 15).map(el => {
    const countryEvents = events.filter(e => e.country_code === el.country_code)
    const dailyCounts = new Map<string, number>()
    for (const e of countryEvents) {
      const day = (e.occurred_at ?? '').slice(0, 10)
      if (day) dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1)
    }
    return {
      country_code: el.country_code,
      level: el.level,
      label: el.label,
      event_count: el.event_count,
      avg_severity: el.avg_severity,
      fatality_estimate: el.fatality_estimate,
      daily_counts: [...dailyCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
      signals: forecastSignals.filter(s => s.country_code === el.country_code),
    }
  })

  /* ================================================================ */
  /*  3. CASUALTY & IMPACT TRACKER                                    */
  /* ================================================================ */
  const fatalityByRegion = new Map<string, number>()
  const fatalityByCountry = new Map<string, number>()
  const fatalityByType = new Map<string, number>()
  for (const e of events) {
    const f = e.casualty_estimate as number | null
    if (typeof f !== 'number' || f <= 0) continue
    const r = (e.region as string) ?? 'Unknown'
    const cc = (e.country_code as string) ?? 'XX'
    const t = (e.event_type as string) ?? 'unknown'
    fatalityByRegion.set(r, (fatalityByRegion.get(r) ?? 0) + f)
    fatalityByCountry.set(cc, (fatalityByCountry.get(cc) ?? 0) + f)
    fatalityByType.set(t, (fatalityByType.get(t) ?? 0) + f)
  }

  const dailyFatalities = dailyVolume.map(d => ({ date: d.date, fatalities: d.fatalities }))

  const casualtyTracker = {
    total_fatalities: totalFatalities,
    by_region: [...fatalityByRegion.entries()]
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    by_country: [...fatalityByCountry.entries()]
      .map(([country_code, count]) => ({ country_code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15),
    by_type: [...fatalityByType.entries()]
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    daily_fatalities: dailyFatalities,
    displacement_events: displacementEvents,
    humanitarian_events: events.filter(e => e.is_humanitarian_report === true).length,
  }

  /* ================================================================ */
  /*  4. ATTACK PATTERN ANALYSIS                                      */
  /* ================================================================ */
  const typeMap = new Map<string, { count: number; critical: number; fatalities: number; countries: Set<string> }>()
  const priorTypeMap = new Map<string, number>()

  for (const e of events) {
    const t = (e.event_type as string) ?? 'unknown'
    if (!typeMap.has(t)) typeMap.set(t, { count: 0, critical: 0, fatalities: 0, countries: new Set() })
    const d = typeMap.get(t)!
    d.count++
    if ((e.severity as number) >= 4) d.critical++
    const f = e.casualty_estimate as number | null
    if (typeof f === 'number') d.fatalities += f
    if (e.country_code) d.countries.add(e.country_code as string)
  }
  for (const e of priorEvents) {
    const t = (e.event_type as string) ?? 'unknown'
    priorTypeMap.set(t, (priorTypeMap.get(t) ?? 0) + 1)
  }

  const attackPatterns = [...typeMap.entries()]
    .map(([event_type, data]) => ({
      event_type,
      count: data.count,
      critical: data.critical,
      fatalities: data.fatalities,
      countries_affected: data.countries.size,
      prior_count: priorTypeMap.get(event_type) ?? 0,
      change_pct: pctChange(data.count, priorTypeMap.get(event_type) ?? 0),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Daily breakdown by top event types (for trend lines)
  const topTypes = attackPatterns.slice(0, 6).map(a => a.event_type)
  const typeDaily = new Map<string, Map<string, number>>()
  for (const t of topTypes) typeDaily.set(t, new Map())
  for (const e of events) {
    const t = (e.event_type as string) ?? 'unknown'
    if (!typeDaily.has(t)) continue
    const day = (e.occurred_at ?? '').slice(0, 10)
    if (!day) continue
    const m = typeDaily.get(t)!
    m.set(day, (m.get(day) ?? 0) + 1)
  }
  const attackTrendLines: Record<string, { date: string; count: number }[]> = {}
  for (const [t, m] of typeDaily) {
    attackTrendLines[t] = [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
  }

  /* ================================================================ */
  /*  5. REGIONAL THREAT MATRIX                                       */
  /* ================================================================ */
  const regionMatrix = new Map<string, {
    events: number; critical: number; fatalities: number; escalation: number;
    displacement: number; attack_types: Set<string>; countries: Set<string>
  }>()
  for (const e of events) {
    const r = (e.region as string) ?? 'Unknown'
    if (!regionMatrix.has(r)) regionMatrix.set(r, { events: 0, critical: 0, fatalities: 0, escalation: 0, displacement: 0, attack_types: new Set(), countries: new Set() })
    const d = regionMatrix.get(r)!
    d.events++
    if ((e.severity as number) >= 4) d.critical++
    if (e.escalation_indicator) d.escalation++
    if (e.event_type === 'displacement' || e.event_type === 'humanitarian_crisis' || e.is_humanitarian_report) d.displacement++
    const f = e.casualty_estimate as number | null
    if (typeof f === 'number') d.fatalities += f
    if (e.event_type) d.attack_types.add(e.event_type as string)
    if (e.country_code) d.countries.add(e.country_code as string)
  }

  const regionThreatMatrix = [...regionMatrix.entries()]
    .map(([region, data]) => ({
      region,
      events: data.events,
      critical: data.critical,
      fatalities: data.fatalities,
      escalation_events: data.escalation,
      displacement_events: data.displacement,
      attack_types: data.attack_types.size,
      countries: data.countries.size,
      threat_score: Math.min(100, Math.round(
        (data.critical * 3 + data.escalation * 5 + data.fatalities * 0.5 + data.displacement * 2) / Math.max(data.events, 1) * 10
      )),
    }))
    .sort((a, b) => b.threat_score - a.threat_score)
    .slice(0, 12)

  /* ================================================================ */
  /*  6. ACTOR INTELLIGENCE                                           */
  /* ================================================================ */
  const actorFreq = new Map<string, { count: number; regions: Set<string>; countries: Set<string>; severity_sum: number; fatalities: number; event_types: Set<string> }>()

  for (const e of events) {
    const actors: string[] = []
    // From provenance_inferred.actor_names
    const inferred = e.provenance_inferred as Record<string, unknown> | null
    if (inferred && Array.isArray(inferred.actor_names)) actors.push(...(inferred.actor_names as string[]))
    // From entities.actors
    const ent = e.entities as Record<string, unknown> | null
    if (ent && Array.isArray(ent.actors)) actors.push(...(ent.actors as string[]))

    const unique = [...new Set(actors.map(a => a.trim()).filter(a => a.length > 1))]
    for (const actor of unique) {
      if (!actorFreq.has(actor)) actorFreq.set(actor, { count: 0, regions: new Set(), countries: new Set(), severity_sum: 0, fatalities: 0, event_types: new Set() })
      const d = actorFreq.get(actor)!
      d.count++
      if (e.region) d.regions.add(e.region as string)
      if (e.country_code) d.countries.add(e.country_code as string)
      d.severity_sum += (e.severity as number) ?? 1
      const f = e.casualty_estimate as number | null
      if (typeof f === 'number') d.fatalities += f
      if (e.event_type) d.event_types.add(e.event_type as string)
    }
  }

  // Prior-period actor counts for trending
  const priorActorFreq = new Map<string, number>()
  for (const e of priorEvents) {
    const actors: string[] = []
    const ent = e.entities as Record<string, unknown> | null
    if (ent && Array.isArray(ent.actors)) actors.push(...(ent.actors as string[]))
    for (const actor of [...new Set(actors.map(a => a.trim()).filter(a => a.length > 1))]) {
      priorActorFreq.set(actor, (priorActorFreq.get(actor) ?? 0) + 1)
    }
  }

  const actorIntel = [...actorFreq.entries()]
    .map(([name, data]) => ({
      name,
      event_count: data.count,
      regions: [...data.regions],
      countries: [...data.countries],
      avg_severity: Math.round((data.severity_sum / data.count) * 10) / 10,
      fatalities: data.fatalities,
      event_types: [...data.event_types],
      prior_count: priorActorFreq.get(name) ?? 0,
      trending: pctChange(data.count, priorActorFreq.get(name) ?? 0),
    }))
    .sort((a, b) => b.event_count - a.event_count)
    .slice(0, 25)

  /* ================================================================ */
  /*  7. PREDICTION CORRELATION PANEL                                 */
  /* ================================================================ */
  const predictionPanel = {
    total: predictions.length,
    confirmed: predictions.filter(p => p.outcome === 'confirmed').length,
    denied: predictions.filter(p => p.outcome === 'denied').length,
    expired: predictions.filter(p => p.outcome === 'expired').length,
    active: predictions.filter(p => !p.outcome).length,
    accuracy_pct: (() => {
      const resolved = predictions.filter(p => p.outcome !== null && p.outcome !== undefined)
      if (resolved.length === 0) return null
      return Math.round(resolved.filter(p => p.outcome === 'confirmed').length / resolved.length * 100)
    })(),
    by_type: (() => {
      const m = new Map<string, { total: number; confirmed: number; active: number }>()
      for (const p of predictions) {
        const t = (p.prediction_type as string) ?? 'unknown'
        if (!m.has(t)) m.set(t, { total: 0, confirmed: 0, active: 0 })
        const d = m.get(t)!
        d.total++
        if (p.outcome === 'confirmed') d.confirmed++
        if (!p.outcome) d.active++
      }
      return [...m.entries()].map(([type, data]) => ({ type, ...data, accuracy: data.total - data.active > 0 ? Math.round(data.confirmed / (data.total - data.active) * 100) : null })).sort((a, b) => b.total - a.total)
    })(),
    high_confidence: predictions
      .filter(p => !p.outcome && (p.probability as number) >= 0.7)
      .map(p => ({ id: p.id, title: p.title, probability: p.probability, severity_if_true: p.severity_if_true, region: p.region, type: p.prediction_type }))
      .slice(0, 10),
    recent: predictions
      .slice(0, 10)
      .map(p => ({ id: p.id, title: p.title, outcome: p.outcome, probability: p.probability, type: p.prediction_type, created_at: p.created_at })),
  }

  /* ================================================================ */
  /*  8. COMPARATIVE ANALYSIS                                         */
  /* ================================================================ */
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const thisWeekEvents = events.filter(e => new Date(e.occurred_at ?? '').getTime() > now - weekMs)
  const lastWeekEvents = events.filter(e => {
    const t = new Date(e.occurred_at ?? '').getTime()
    return t > now - 2 * weekMs && t <= now - weekMs
  })

  const thisWeekCritical = thisWeekEvents.filter(e => (e.severity as number) >= 4).length
  const lastWeekCritical = lastWeekEvents.filter(e => (e.severity as number) >= 4).length

  const overallTrend = events.length > priorEvents.length * 1.2 ? 'escalating'
    : events.length < priorEvents.length * 0.8 ? 'de_escalating' : 'stable'

  // Anomaly detection: days with event counts > 2 standard deviations from mean
  const dailyCounts = dailyVolume.map(d => d.total)
  const mean = dailyCounts.length > 0 ? dailyCounts.reduce((s, v) => s + v, 0) / dailyCounts.length : 0
  const stddev = dailyCounts.length > 1 ? Math.sqrt(dailyCounts.reduce((s, v) => s + (v - mean) ** 2, 0) / (dailyCounts.length - 1)) : 0
  const anomalyThreshold = mean + 2 * stddev
  const anomalyDays = dailyVolume.filter(d => d.total > anomalyThreshold).map(d => ({
    date: d.date,
    count: d.total,
    sigma: stddev > 0 ? Math.round(((d.total - mean) / stddev) * 10) / 10 : 0,
  }))

  // Region comparison
  const regionComparison: { region: string; current: number; prior: number; change_pct: number }[] = []
  const priorRegionMap = new Map<string, number>()
  for (const e of priorEvents) {
    const r = (e.region as string) ?? 'Unknown'
    priorRegionMap.set(r, (priorRegionMap.get(r) ?? 0) + 1)
  }
  for (const [region, data] of regionMatrix) {
    const prior = priorRegionMap.get(region) ?? 0
    regionComparison.push({ region, current: data.events, prior, change_pct: pctChange(data.events, prior) })
  }
  regionComparison.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))

  const comparativeAnalysis = {
    trend: overallTrend,
    this_week: { total: thisWeekEvents.length, critical: thisWeekCritical },
    last_week: { total: lastWeekEvents.length, critical: lastWeekCritical },
    week_change_pct: pctChange(thisWeekEvents.length, lastWeekEvents.length),
    period_change_pct: pctChange(events.length, priorEvents.length),
    anomaly_days: anomalyDays,
    anomaly_threshold: Math.round(anomalyThreshold),
    mean_daily: Math.round(mean * 10) / 10,
    stddev_daily: Math.round(stddev * 10) / 10,
    region_comparison: regionComparison.slice(0, 10),
  }

  /* ================================================================ */
  /*  9. EVENT VELOCITY & ANOMALY DETECTION                           */
  /* ================================================================ */
  const h48 = new Date(now - 48 * 60 * 60 * 1000).toISOString()
  const recentEvents = events.filter(e => (e.occurred_at ?? '') >= h48)
  const hourlyMap = new Map<string, number>()
  for (const e of recentEvents) {
    const h = (e.occurred_at ?? '').slice(0, 13) // YYYY-MM-DDTHH
    if (h) hourlyMap.set(h, (hourlyMap.get(h) ?? 0) + 1)
  }
  const hourlyVelocity = [...hourlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({ hour, count }))

  const hourCounts = hourlyVelocity.map(h => h.count)
  const hourMean = hourCounts.length > 0 ? hourCounts.reduce((s, v) => s + v, 0) / hourCounts.length : 0
  const hourStddev = hourCounts.length > 1 ? Math.sqrt(hourCounts.reduce((s, v) => s + (v - hourMean) ** 2, 0) / (hourCounts.length - 1)) : 0
  const hourAnomalyThreshold = hourMean + 2 * hourStddev
  const velocityAnomalies = hourlyVelocity.filter(h => h.count > hourAnomalyThreshold).map(h => ({
    ...h,
    sigma: hourStddev > 0 ? Math.round(((h.count - hourMean) / hourStddev) * 10) / 10 : 0,
  }))

  const velocityPanel = {
    hourly_velocity: hourlyVelocity,
    current_rate: hourlyVelocity.length > 0 ? hourlyVelocity[hourlyVelocity.length - 1]!.count : 0,
    avg_hourly: Math.round(hourMean * 10) / 10,
    peak_hourly: Math.max(...hourCounts, 0),
    anomalies: velocityAnomalies,
    anomaly_threshold: Math.round(hourAnomalyThreshold * 10) / 10,
  }

  /* ================================================================ */
  /*  RESPONSE                                                         */
  /* ================================================================ */

  return NextResponse.json({
    days,
    generated_at: new Date().toISOString(),
    command_strip: commandStrip,
    daily_volume: dailyVolume,
    escalation_timeline: escalationTimeline,
    casualty_tracker: casualtyTracker,
    attack_patterns: attackPatterns,
    attack_trend_lines: attackTrendLines,
    region_threat_matrix: regionThreatMatrix,
    hotspots: regionsRes.data ?? [],
    actor_intel: actorIntel,
    prediction_panel: predictionPanel,
    comparative_analysis: comparativeAnalysis,
    velocity_panel: velocityPanel,
    forecast_signals: forecastSignals.slice(0, 20),
    country_risks: countryRisks.slice(0, 20),
  })
}
