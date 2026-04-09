/**
 * Unified Signal Aggregator
 *
 * Brings together ALL available signals for a country:
 * - Event-based signals (frequency, severity, types)
 * - Correlation signals (pattern matches)
 * - Anomaly signals (statistical deviations)
 * - Sentiment signals (rhetoric shifts)
 * - Economic signals (sanctions, commodity moves)
 * - Vessel signals (dark ships, route deviations)
 * - Prediction market signals (crowd forecasts)
 * - Strategic context (phase, precursors, cyclical patterns)
 *
 * Combines into a unified "Composite Threat Score" (0-100)
 */

import { createServiceClient } from '@/lib/supabase/server'
import { calculateEconomicStressScore } from '@/lib/ingest/economic-signals'

export type SignalBreakdown = {
  event_signals: number
  correlation_signals: number
  anomaly_signals: number
  sentiment_signals: number
  economic_signals: number
  vessel_signals: number
  prediction_signals: number
  strategic_signals: number
}

export type CompositeScore = {
  country_code: string
  country_name: string
  composite_threat_score: number
  severity: 'minimal' | 'low' | 'medium' | 'high' | 'critical'
  trend: 'improving' | 'stable' | 'deteriorating'
  signal_breakdown: SignalBreakdown
  weighted_contributions: Record<string, number>
  key_drivers: string[]
  timestamp: string
}

/**
 * Get event-based signals for a country
 * Measures: frequency, severity, event type distribution
 */
async function getEventSignals(region: string): Promise<number> {
  const supabase = createServiceClient()
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: events24h } = await supabase
    .from('events')
    .select('severity')
    .gte('ingested_at', twentyFourHoursAgo)
    .ilike('region', `%${region}%`)

  if (!events24h?.length) return 0

  // Calculate signal based on event count and severity
  const severityScore = events24h.reduce((sum, e) => sum + (e.severity as number), 0)
  const frequencyScore = events24h.length

  // Normalize: 10 events at severity 3 = ~15 points
  return Math.max(0, Math.min(25, Math.round((frequencyScore * 0.75) + (severityScore * 0.5))))
}

/**
 * Get correlation signals
 * These are pre-computed patterns (flights + events, outages + events, etc.)
 */
async function getCorrelationSignals(region: string): Promise<number> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: signals } = await supabase
    .from('correlation_signals')
    .select('severity')
    .gte('detected_at', sevenDaysAgo)
    .ilike('region', `%${region}%`)

  if (!signals?.length) return 0

  // Weight by severity
  let score = 0
  for (const sig of signals) {
    const severity = sig.severity as string
    score += severity === 'critical' ? 4 : severity === 'high' ? 3 : severity === 'medium' ? 2 : 1
  }

  return Math.min(20, score)
}

/**
 * Get anomaly signals
 * Statistical deviations: unusual flight patterns, internet outages, etc.
 */
async function getAnomalySignals(region: string): Promise<number> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count internet outages
  const { data: outages } = await supabase
    .from('internet_outages')
    .select('severity')
    .gte('recorded_at', sevenDaysAgo)
    .ilike('country', `%${region}%`)
    .is('resolved_at', null)

  // Count unusual flight patterns
  const { data: flights } = await supabase
    .from('flight_tracks')
    .select('id')
    .gte('recorded_at', sevenDaysAgo)
    .eq('conflict_zone', region)

  const outageScore = (outages?.length ?? 0) * 3
  const flightScore = Math.min((flights?.length ?? 0) / 3, 8) // Cap at 8 points

  return Math.min(20, outageScore + flightScore)
}

/**
 * Get sentiment signals
 * Rhetoric shifts, narrative changes (requires NLP processing)
 */
async function getSentimentSignals(region: string): Promise<number> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Check for escalatory language in events
  const { data: events } = await supabase
    .from('events')
    .select('description')
    .gte('ingested_at', sevenDaysAgo)
    .ilike('region', `%${region}%`)

  if (!events?.length) return 0

  // Count mentions of escalatory terms (simple pattern matching)
  const escalatoryTerms = ['nuclear', 'threatens', 'invasion', 'attack', 'war', 'military operation']
  let escalationCount = 0

  for (const evt of events) {
    const desc = String(evt.description ?? '').toLowerCase()
    for (const term of escalatoryTerms) {
      if (desc.includes(term)) escalationCount++
    }
  }

  return Math.min(15, Math.round(escalationCount / 2))
}

/**
 * Get economic signals
 * Sanctions activity, commodity spikes, currency stress
 */
async function getEconomicSignals(region: string): Promise<number> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count economic correlation signals in region
  const { data: economicSignals } = await supabase
    .from('correlation_signals')
    .select('severity')
    .gte('detected_at', sevenDaysAgo)
    .in('signal_type', ['economic_signal', 'economic_conflict_correlation', 'sanctions_violation_new_region'])
    .ilike('region', `%${region}%`)

  if (!economicSignals?.length) return 0

  const score = economicSignals.reduce((sum, s) => {
    const severity = s.severity as string
    return sum + (severity === 'critical' ? 4 : severity === 'high' ? 3 : 1)
  }, 0)

  // Get stress score
  const { score: stressScore } = await calculateEconomicStressScore('', region)

  // Combine: 40% from signals, 60% from stress score
  return Math.min(18, Math.round((score * 0.4) + (stressScore * 0.6 * 0.18)))
}

/**
 * Get maritime/vessel signals
 * Dark vessels, route anomalies, sanctions violations at sea
 */
async function getVesselSignals(region: string): Promise<number> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Count vessel-related correlation signals
  const { data: vesselSignals } = await supabase
    .from('correlation_signals')
    .select('severity')
    .gte('detected_at', sevenDaysAgo)
    .in('signal_type', ['vessel_dark_critical', 'sanctioned_vessel_dark'])
    .ilike('region', `%${region}%`)

  if (!vesselSignals?.length) return 0

  const score = vesselSignals.reduce((sum, s) => {
    const severity = s.severity as string
    return sum + (severity === 'critical' ? 5 : severity === 'high' ? 3 : 1)
  }, 0)

  return Math.min(15, score)
}

/**
 * Get prediction market signals
 * Crowd-sourced probabilistic forecasts about conflict
 */
async function getPredictionSignals(region: string): Promise<number> {
  const supabase = createServiceClient()

  // Get recent prediction markets for this region
  const { data: markets } = await supabase
    .from('prediction_markets')
    .select('probability')
    .ilike('linked_region', `%${region}%`)
    .order('resolution_date', { ascending: true })

  if (!markets?.length) return 0

  // Average probability of conflict-related markets
  const avgProbability = markets.reduce((sum, m) => sum + ((m.probability as number) ?? 0), 0) / markets.length

  // Convert probability (0-1) to signal contribution (0-12)
  return Math.round(avgProbability * 12)
}

/**
 * Get strategic context signals
 * Cyclical patterns, phase progression, precursor detection
 */
async function getStrategicSignals(region: string): Promise<number> {
  const supabase = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Look for strategic indicator events
  const { data: strategicEvents } = await supabase
    .from('events')
    .select('event_type, severity')
    .gte('ingested_at', thirtyDaysAgo)
    .ilike('region', `%${region}%`)
    .in('event_type', ['troop_movement', 'military_exercise', 'diplomatic_crisis', 'sanctions'])

  if (!strategicEvents?.length) return 0

  // Count escalation indicators
  let score = 0
  const typeScores: Record<string, number> = {
    'troop_movement': 3,
    'military_exercise': 2,
    'diplomatic_crisis': 4,
    'sanctions': 2,
  }

  for (const evt of strategicEvents) {
    const baseScore = typeScores[(evt.event_type as string) ?? ''] ?? 1
    const severityMultiplier = (evt.severity as number) / 2
    score += Math.round(baseScore * severityMultiplier)
  }

  return Math.min(20, score)
}

/**
 * Calculate composite threat score for a country
 */
export async function calculateCompositeScore(countryCode: string, countryName: string): Promise<CompositeScore> {
  // Get all signal types in parallel
  const [
    eventSigs,
    correlationSigs,
    anomalySigs,
    sentimentSigs,
    economicSigs,
    vesselSigs,
    predictionSigs,
    strategicSigs,
  ] = await Promise.all([
    getEventSignals(countryName),
    getCorrelationSignals(countryName),
    getAnomalySignals(countryName),
    getSentimentSignals(countryName),
    getEconomicSignals(countryName),
    getVesselSignals(countryName),
    getPredictionSignals(countryName),
    getStrategicSignals(countryName),
  ])

  // Weight contributions (percentages must sum to 100)
  const weights = {
    events: 0.20,           // 20%
    correlations: 0.15,     // 15%
    anomalies: 0.12,        // 12%
    sentiment: 0.10,        // 10%
    economic: 0.13,         // 13%
    vessels: 0.08,          // 8%
    predictions: 0.12,      // 12%
    strategic: 0.10,        // 10%
  }

  // Each signal component is out of its max value
  // Normalize to 0-100 scale
  const maxPerComponent = 25 // Assume each can be out of 25
  const normalizedScores = {
    events: Math.min(25, eventSigs),
    correlations: Math.min(20, correlationSigs),
    anomalies: Math.min(20, anomalySigs),
    sentiment: Math.min(15, sentimentSigs),
    economic: Math.min(18, economicSigs),
    vessels: Math.min(15, vesselSigs),
    predictions: Math.min(12, predictionSigs),
    strategic: Math.min(20, strategicSigs),
  }

  // Calculate weighted composite (0-100)
  const compositeScore = Math.round(
    ((normalizedScores.events ?? 0) / 25) * weights.events * 100 +
    ((normalizedScores.correlations ?? 0) / 20) * weights.correlations * 100 +
    ((normalizedScores.anomalies ?? 0) / 20) * weights.anomalies * 100 +
    ((normalizedScores.sentiment ?? 0) / 15) * weights.sentiment * 100 +
    ((normalizedScores.economic ?? 0) / 18) * weights.economic * 100 +
    ((normalizedScores.vessels ?? 0) / 15) * weights.vessels * 100 +
    ((normalizedScores.predictions ?? 0) / 12) * weights.predictions * 100 +
    ((normalizedScores.strategic ?? 0) / 20) * weights.strategic * 100
  )

  // Determine severity
  const severity: 'minimal' | 'low' | 'medium' | 'high' | 'critical' =
    compositeScore >= 75 ? 'critical' :
    compositeScore >= 60 ? 'high' :
    compositeScore >= 40 ? 'medium' :
    compositeScore >= 20 ? 'low' : 'minimal'

  // Determine trend by comparing to previous score
  const supabase = createServiceClient()
  const { data: previousScore } = await supabase
    .from('composite_threat_scores')
    .select('score')
    .eq('country_code', countryCode)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  const previousScoreValue = (previousScore?.score as number) ?? compositeScore
  const trend: 'improving' | 'stable' | 'deteriorating' =
    compositeScore > previousScoreValue + 5 ? 'deteriorating' :
    compositeScore < previousScoreValue - 5 ? 'improving' : 'stable'

  // Calculate weighted contributions for breakdown
  const weightedContributions = {
    events: Math.round((normalizedScores.events / 25) * weights.events * 100),
    correlations: Math.round((normalizedScores.correlations / 20) * weights.correlations * 100),
    anomalies: Math.round((normalizedScores.anomalies / 20) * weights.anomalies * 100),
    sentiment: Math.round((normalizedScores.sentiment / 15) * weights.sentiment * 100),
    economic: Math.round((normalizedScores.economic / 18) * weights.economic * 100),
    vessels: Math.round((normalizedScores.vessels / 15) * weights.vessels * 100),
    predictions: Math.round((normalizedScores.predictions / 12) * weights.predictions * 100),
    strategic: Math.round((normalizedScores.strategic / 20) * weights.strategic * 100),
  }

  // Identify key drivers (components > 10% of total score)
  const keyDrivers: string[] = []
  for (const [key, value] of Object.entries(weightedContributions)) {
    if (value > 10) {
      keyDrivers.push(`${key} (${value}%)`)
    }
  }

  return {
    country_code: countryCode,
    country_name: countryName,
    composite_threat_score: compositeScore,
    severity,
    trend,
    signal_breakdown: {
      event_signals: eventSigs,
      correlation_signals: correlationSigs,
      anomaly_signals: anomalySigs,
      sentiment_signals: sentimentSigs,
      economic_signals: economicSigs,
      vessel_signals: vesselSigs,
      prediction_signals: predictionSigs,
      strategic_signals: strategicSigs,
    },
    weighted_contributions: weightedContributions,
    key_drivers: keyDrivers,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Calculate composite scores for all major conflict zones
 */
export async function calculateAllCompositeScores(): Promise<CompositeScore[]> {
  const conflictZones = [
    { code: 'UA', name: 'Ukraine' },
    { code: 'RU', name: 'Russia' },
    { code: 'IL', name: 'Israel' },
    { code: 'PS', name: 'Palestine' },
    { code: 'SY', name: 'Syria' },
    { code: 'YE', name: 'Yemen' },
    { code: 'SD', name: 'Sudan' },
    { code: 'MM', name: 'Myanmar' },
    { code: 'IR', name: 'Iran' },
    { code: 'CN', name: 'China' },
    { code: 'TW', name: 'Taiwan' },
  ]

  const results: CompositeScore[] = []

  for (const zone of conflictZones) {
    const score = await calculateCompositeScore(zone.code, zone.name)
    results.push(score)

    // Store for historical tracking
    const supabase = createServiceClient()
    await supabase.from('composite_threat_scores').insert({
      country_code: zone.code,
      country_name: zone.name,
      score: score.composite_threat_score,
      severity: score.severity,
      trend: score.trend,
      signal_breakdown: score.signal_breakdown,
      weighted_contributions: score.weighted_contributions,
      key_drivers: score.key_drivers,
      calculated_at: score.timestamp,
    })
  }

  return results
}
