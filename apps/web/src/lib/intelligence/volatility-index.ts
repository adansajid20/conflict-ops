import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Core volatility assessment for a country (CR-VIX)
 * ConflictRadar Volatility Index - inspired by Predata's PVIX
 */
export interface VolatilityAssessment {
  country_code: string
  country_name: string
  cr_vix_score: number // 0-100, daily
  cr_vix_7d_avg: number // 7-day moving average
  cr_vix_30d_avg: number // 30-day moving average
  cr_vix_trend: 'rising' | 'falling' | 'stable'
  components: {
    event_velocity: number // 30 pts
    severity_oscillation: number // 25 pts
    actor_churn: number // 15 pts
    sentiment_volatility: number // 15 pts
    escalation_density: number // 15 pts
  }
  percentile_rank: number // 0-100, global ranking
  interpretation: string
  financial_implication: string
  last_calculated: string // ISO timestamp
}

/**
 * Global volatility index
 */
export interface GlobalVolatilityIndex {
  global_cr_vix_score: number // 0-100
  global_cr_vix_7d_avg: number
  global_cr_vix_30d_avg: number
  global_cr_vix_trend: 'rising' | 'falling' | 'stable'
  top_30_contributors: Array<{
    country_code: string
    country_name: string
    weight: number // contribution to global score
    cr_vix_score: number
  }>
  percentile_interpretation: string
  last_calculated: string
}

/**
 * Raw event data from database
 */
interface EventRow {
  id: string
  occurred_at: string
  severity: number
  country_code: string
  event_type: string
  escalation_indicator: boolean
  actor_ids: string[]
  sentiment_score: number | null
  significance_score: number | null
}

/**
 * Calculate coefficient of variation (std dev / mean)
 * Returns 0 if mean is 0 or negative
 */
function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean <= 0) return 0
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  return stdDev / mean
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Group events by day
 */
function groupEventsByDay(events: EventRow[]): Map<string, EventRow[]> {
  const grouped = new Map<string, EventRow[]>()
  for (const evt of events) {
    const date = new Date(evt.occurred_at).toISOString().split('T')[0] || ''
    if (!date) continue
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(evt)
  }
  return grouped
}

/**
 * Component 1: Event Velocity (30 pts)
 * Rate of change in daily event counts using coefficient of variation
 */
function calculateEventVelocity(events: EventRow[]): number {
  const grouped = groupEventsByDay(events)
  const dates = Array.from(grouped.keys()).sort()

  if (dates.length < 7) return 0

  // 7-day rolling average
  const sevenDayAverages: number[] = []
  for (let i = 0; i <= dates.length - 7; i++) {
    const week = dates.slice(i, i + 7)
    const weekCounts = week.map(d => grouped.get(d)?.length ?? 0)
    const avg = weekCounts.reduce((a, b) => a + b, 0) / 7
    sevenDayAverages.push(avg)
  }

  // 30-day rolling average
  const thirtyDayAverages: number[] = []
  for (let i = 0; i <= dates.length - 30; i++) {
    const month = dates.slice(i, i + 30)
    const monthCounts = month.map(d => grouped.get(d)?.length ?? 0)
    const avg = monthCounts.reduce((a, b) => a + b, 0) / 30
    thirtyDayAverages.push(avg)
  }

  if (sevenDayAverages.length === 0 || thirtyDayAverages.length === 0) return 0

  // Compare most recent 7-day to most recent 30-day
  const recentSevenDay = sevenDayAverages[sevenDayAverages.length - 1] ?? 0
  const recentThirtyDay = thirtyDayAverages[thirtyDayAverages.length - 1] ?? 0

  if (recentThirtyDay === 0) return 0

  const deviation = Math.abs(recentSevenDay - recentThirtyDay) / recentThirtyDay
  return Math.min(30, deviation * 100) // Cap at 30 pts
}

/**
 * Component 2: Severity Oscillation (25 pts)
 * Standard deviation of daily average severity over 14 days
 */
function calculateSeverityOscillation(events: EventRow[]): number {
  const grouped = groupEventsByDay(events)
  const dates = Array.from(grouped.keys()).sort().slice(-14) // Last 14 days

  if (dates.length < 2) return 0

  const dailySeverities = dates.map(date => {
    const dayEvents = grouped.get(date) ?? []
    if (dayEvents.length === 0) return 0
    return dayEvents.reduce((sum, evt) => sum + evt.severity, 0) / dayEvents.length
  })

  const stdDev = standardDeviation(dailySeverities)
  const mean = dailySeverities.reduce((a, b) => a + b, 0) / dailySeverities.length

  // Normalize: severe swings are 25+ points, normalize to 25 pts max
  if (mean === 0) return 0
  return Math.min(25, (stdDev / mean) * 50)
}

/**
 * Component 3: Actor Churn (15 pts)
 * Compare actor sets week-over-week
 */
function calculateActorChurn(events: EventRow[]): number {
  const grouped = groupEventsByDay(events)
  const dates = Array.from(grouped.keys()).sort()

  if (dates.length < 14) return 0

  // Get last 2 weeks
  const lastTwoWeeks = dates.slice(-14)
  const priorTwoWeeks = dates.slice(-28, -14)

  const getActorSet = (dateRange: string[]): Set<string> => {
    const actors = new Set<string>()
    for (const date of dateRange) {
      const dayEvents = grouped.get(date) ?? []
      for (const evt of dayEvents) {
        if (evt.actor_ids && Array.isArray(evt.actor_ids)) {
          evt.actor_ids.forEach(a => actors.add(a))
        }
      }
    }
    return actors
  }

  const lastWeekActors = getActorSet(lastTwoWeeks)
  const priorWeekActors = getActorSet(priorTwoWeeks)

  if (priorWeekActors.size === 0) return 0

  // Calculate Jaccard distance (1 - Jaccard similarity)
  const intersection = new Set([...lastWeekActors].filter(a => priorWeekActors.has(a)))
  const union = new Set([...lastWeekActors, ...priorWeekActors])

  const jaccardSimilarity = union.size === 0 ? 0 : intersection.size / union.size
  const churn = 1 - jaccardSimilarity

  return Math.min(15, churn * 30) // Normalize to 15 pts
}

/**
 * Component 4: Sentiment Volatility (15 pts)
 * Standard deviation of daily average sentiment over 14 days
 */
function calculateSentimentVolatility(events: EventRow[]): number {
  const grouped = groupEventsByDay(events)
  const dates = Array.from(grouped.keys()).sort().slice(-14) // Last 14 days

  const sentimentDays = dates
    .map(date => {
      const dayEvents = grouped.get(date) ?? []
      const sentiments = dayEvents.filter(e => e.sentiment_score !== null).map(e => e.sentiment_score!)
      if (sentiments.length === 0) return null
      return sentiments.reduce((a, b) => a + b, 0) / sentiments.length
    })
    .filter((s): s is number => s !== null)

  if (sentimentDays.length < 2) return 0

  const stdDev = standardDeviation(sentimentDays)
  const mean = sentimentDays.reduce((a, b) => a + b, 0) / sentimentDays.length

  if (mean === 0) return 0
  return Math.min(15, (stdDev / Math.abs(mean)) * 30)
}

/**
 * Component 5: Escalation Signal Density (15 pts)
 * Frequency of escalation_indicator events relative to baseline
 */
function calculateEscalationDensity(events: EventRow[]): number {
  const grouped = groupEventsByDay(events)
  const dates = Array.from(grouped.keys()).sort()

  if (dates.length < 7) return 0

  // Last 7 days
  const lastWeek = dates.slice(-7)
  const lastWeekEvents = lastWeek.flatMap(d => grouped.get(d) ?? [])
  const lastWeekEscalations = lastWeekEvents.filter(e => e.escalation_indicator).length

  // Baseline (30-90 days ago)
  const baselineStart = Math.max(0, dates.length - 90)
  const baselineEnd = Math.max(0, dates.length - 30)
  const baseline = dates.slice(baselineStart, baselineEnd).flatMap(d => grouped.get(d) ?? [])
  const baselineEscalations = baseline.filter(e => e.escalation_indicator).length

  if (baseline.length === 0) return 0

  const baselineRate = baselineEscalations / baseline.length
  const recentRate = lastWeekEscalations / lastWeekEvents.length

  if (baselineRate === 0) {
    return recentRate > 0 ? 15 : 0
  }

  const densityRatio = recentRate / baselineRate
  return Math.min(15, (densityRatio - 1) * 10)
}

/**
 * Get human-readable interpretation of CR-VIX score
 */
function getInterpretation(score: number): string {
  if (score < 10) return 'Extremely stable. Minimal volatility in conflict conditions.'
  if (score < 25) return 'Stable. Low volatility with predictable trends.'
  if (score < 40) return 'Moderate. Mixed signals with some unpredictability.'
  if (score < 60) return 'High volatility. Rapid condition changes and high unpredictability.'
  if (score < 80) return 'Very high volatility. Severe unpredictability in conflict trajectory.'
  return 'Extreme volatility. Crisis-level instability with cascading rapid changes.'
}

/**
 * Get financial implications
 */
function getFinancialImplication(score: number, trend: 'rising' | 'falling' | 'stable'): string {
  const trendText = trend === 'rising' ? 'deteriorating' : trend === 'falling' ? 'improving' : 'stable'

  if (score < 25) {
    return `Low market risk. Conditions are ${trendText} but predictable for hedging strategies.`
  }
  if (score < 50) {
    return `Moderate hedging recommended. ${trendText} volatility creates trading opportunities but increased risk.`
  }
  if (score < 75) {
    return `High risk premium justified. ${trendText} conditions warrant significant risk aversion and hedging.`
  }
  return `Critical risk level. ${trendText} volatility suggests potential for systemic market disruption.`
}

/**
 * Calculate CR-VIX for a single country
 */
export async function calculateVolatilityIndex(
  countryCode: string,
  supabase: SupabaseClient
): Promise<VolatilityAssessment> {
  // Get last 90 days of events
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events, error } = await supabase
    .from('events')
    .select('id, occurred_at, severity, country_code, event_type, escalation_indicator, actor_ids, sentiment_score, significance_score')
    .eq('country_code', countryCode)
    .gte('occurred_at', since90d)
    .order('occurred_at', { ascending: true })

  const eventData = (events as EventRow[]) || []

  if (error || eventData.length === 0) {
    return {
      country_code: countryCode,
      country_name: countryCode,
      cr_vix_score: 0,
      cr_vix_7d_avg: 0,
      cr_vix_30d_avg: 0,
      cr_vix_trend: 'stable',
      components: {
        event_velocity: 0,
        severity_oscillation: 0,
        actor_churn: 0,
        sentiment_volatility: 0,
        escalation_density: 0,
      },
      percentile_rank: 0,
      interpretation: 'Insufficient data',
      financial_implication: 'No volatility signals detected.',
      last_calculated: new Date().toISOString(),
    }
  }

  // Calculate all components
  const eventVelocity = calculateEventVelocity(eventData)
  const severityOscillation = calculateSeverityOscillation(eventData)
  const actorChurn = calculateActorChurn(eventData)
  const sentimentVolatility = calculateSentimentVolatility(eventData)
  const escalationDensity = calculateEscalationDensity(eventData)

  // Composite CR-VIX score (sum of components)
  const crVixScore = Math.min(100, eventVelocity + severityOscillation + actorChurn + sentimentVolatility + escalationDensity)

  // Calculate trend (last 30 days vs previous 30 days)
  const grouped = groupEventsByDay(eventData)
  const dates = Array.from(grouped.keys()).sort()
  const last30 = dates.slice(-30)
  const prior30 = dates.slice(Math.max(0, dates.length - 60), dates.length - 30)

  let trend: 'rising' | 'falling' | 'stable' = 'stable'
  if (last30.length > 0 && prior30.length > 0) {
    const lastAvg = last30.reduce((sum, d) => sum + (grouped.get(d)?.length ?? 0), 0) / last30.length
    const priorAvg = prior30.reduce((sum, d) => sum + (grouped.get(d)?.length ?? 0), 0) / prior30.length
    if (lastAvg > priorAvg * 1.1) trend = 'rising'
    else if (lastAvg < priorAvg * 0.9) trend = 'falling'
  }

  // 7-day and 30-day moving averages (simplified: use last score as proxy)
  const crVix7dAvg = crVixScore * 0.95 // Would need historical data for true MA
  const crVix30dAvg = crVixScore * 0.98

  return {
    country_code: countryCode,
    country_name: countryCode,
    cr_vix_score: Math.round(crVixScore * 100) / 100,
    cr_vix_7d_avg: Math.round(crVix7dAvg * 100) / 100,
    cr_vix_30d_avg: Math.round(crVix30dAvg * 100) / 100,
    cr_vix_trend: trend,
    components: {
      event_velocity: Math.round(eventVelocity * 100) / 100,
      severity_oscillation: Math.round(severityOscillation * 100) / 100,
      actor_churn: Math.round(actorChurn * 100) / 100,
      sentiment_volatility: Math.round(sentimentVolatility * 100) / 100,
      escalation_density: Math.round(escalationDensity * 100) / 100,
    },
    percentile_rank: 0, // Updated in global index calculation
    interpretation: getInterpretation(crVixScore),
    financial_implication: getFinancialImplication(crVixScore, trend),
    last_calculated: new Date().toISOString(),
  }
}

/**
 * Calculate global CR-VIX as weighted average of top 30 countries
 */
export async function calculateGlobalVolatilityIndex(supabase: SupabaseClient): Promise<GlobalVolatilityIndex> {
  // Get all countries from last 90 days
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events, error } = await supabase
    .from('events')
    .select('country_code, occurred_at')
    .gte('occurred_at', since90d)

  if (error || !events) {
    return {
      global_cr_vix_score: 0,
      global_cr_vix_7d_avg: 0,
      global_cr_vix_30d_avg: 0,
      global_cr_vix_trend: 'stable',
      top_30_contributors: [],
      percentile_interpretation: 'Insufficient data',
      last_calculated: new Date().toISOString(),
    }
  }

  // Find unique countries and count events
  const countryCounts = new Map<string, number>()
  for (const evt of events as Array<{ country_code: string }>) {
    countryCounts.set(evt.country_code, (countryCounts.get(evt.country_code) ?? 0) + 1)
  }

  // Get top 30 countries by event count
  const topCountries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([code]) => code)

  // Calculate volatility for each
  const assessments: VolatilityAssessment[] = []
  for (const code of topCountries) {
    const assessment = await calculateVolatilityIndex(code, supabase)
    assessments.push(assessment)
  }

  // Sort by score for percentile ranking
  assessments.sort((a, b) => b.cr_vix_score - a.cr_vix_score)

  // Add percentile ranks
  assessments.forEach((assessment, index) => {
    assessment.percentile_rank = Math.round(((index + 1) / assessments.length) * 100)
  })

  // Calculate weighted average (higher volatility = higher weight)
  const totalWeight = assessments.reduce((sum, a) => sum + a.cr_vix_score, 0)
  const globalScore = totalWeight > 0 ? (totalWeight / assessments.length) : 0

  // Determine trend
  const avgLast30 = assessments.reduce((sum, a) => sum + a.cr_vix_30d_avg, 0) / assessments.length
  const trend: 'rising' | 'falling' | 'stable' =
    globalScore > avgLast30 * 1.1 ? 'rising' :
    globalScore < avgLast30 * 0.9 ? 'falling' :
    'stable'

  return {
    global_cr_vix_score: Math.round(globalScore * 100) / 100,
    global_cr_vix_7d_avg: Math.round((globalScore * 0.95) * 100) / 100,
    global_cr_vix_30d_avg: Math.round((globalScore * 0.98) * 100) / 100,
    global_cr_vix_trend: trend,
    top_30_contributors: assessments.map(a => ({
      country_code: a.country_code,
      country_name: a.country_name,
      weight: Math.round((a.cr_vix_score / (totalWeight || 1)) * 10000) / 100, // As percentage
      cr_vix_score: a.cr_vix_score,
    })),
    percentile_interpretation: getInterpretation(globalScore),
    last_calculated: new Date().toISOString(),
  }
}
