/**
 * Early Warning System (EWS) Module
 *
 * A comprehensive multi-factor early warning engine inspired by:
 * - Crisis24's 27-category threat model
 * - ACLED's CAST forecasting methodology
 *
 * Calculates threat assessments across 12 critical categories and derives:
 * - Overall Early Warning Level (1-5 scale)
 * - Trigger analysis (what caused the warning)
 * - Trajectory assessment (improving/stable/deteriorating)
 * - Time-to-crisis estimates (based on escalation velocity)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * The 12 primary threat categories for focused risk assessment
 */
export enum ThreatCategory {
  ARMED_CONFLICT = 'armed_conflict',
  TERRORISM = 'terrorism',
  CIVIL_UNREST = 'civil_unrest',
  POLITICAL_INSTABILITY = 'political_instability',
  HUMANITARIAN_CRISIS = 'humanitarian_crisis',
  CYBER_THREATS = 'cyber_threats',
  ECONOMIC_DISRUPTION = 'economic_disruption',
  ENVIRONMENTAL_HAZARD = 'environmental_hazard',
  CROSS_BORDER_SPILLOVER = 'cross_border_spillover',
  MARITIME_SECURITY = 'maritime_security',
  AVIATION_SECURITY = 'aviation_security',
  INFRASTRUCTURE_DISRUPTION = 'infrastructure_disruption',
}

/**
 * Early Warning Level (1-5 scale per Crisis24 model)
 */
export enum WarningLevel {
  STABLE = 1,
  ELEVATED = 2,
  HIGH = 3,
  SEVERE = 4,
  CRITICAL = 5,
}

export const WarningLevelNames: Record<WarningLevel, string> = {
  [WarningLevel.STABLE]: 'STABLE',
  [WarningLevel.ELEVATED]: 'ELEVATED',
  [WarningLevel.HIGH]: 'HIGH',
  [WarningLevel.SEVERE]: 'SEVERE',
  [WarningLevel.CRITICAL]: 'CRITICAL',
}

/**
 * Trigger event that contributed to warning level
 */
export interface TriggerEvent {
  category: ThreatCategory
  description: string
  score: number // 0-100
  severity: number // 1-4
  confidence: number // 0-1
  event_count: number
  primary_actors: string[]
  timestamp: string
}

/**
 * Trajectory assessment showing direction and momentum
 */
export interface TrajectoryAssessment {
  direction: 'improving' | 'stable' | 'deteriorating'
  confidence: number // 0-1
  velocity: number // -100 to +100 (negative = improving)
  momentum_days: number // how many days this trend has been consistent
  inflection_points: string[] // dates where trend changed
}

/**
 * Time-to-crisis estimate based on escalation patterns
 */
export interface TimeToCrisis {
  estimate_hours: number // estimated hours until crisis threshold
  estimate_days: number // estimated days
  confidence: number // 0-1
  primary_driver: ThreatCategory
  escalation_velocity: number // rate of increase per day (0-100 scale)
  threshold_distance: number // how far until critical threshold (0-100)
}

/**
 * Complete early warning assessment
 */
export interface EarlyWarningAssessment {
  country_code: string
  country_name: string
  timestamp: string
  warning_level: WarningLevel
  warning_level_name: string

  // Threat category scores (0-100, 0.25 increment precision)
  threat_scores: Record<ThreatCategory, number>
  category_details: Record<ThreatCategory, {
    score: number
    event_count: number
    recent_events: TriggerEvent[]
    trend: 'improving' | 'stable' | 'deteriorating'
  }>

  // Key metrics
  composite_score: number // 0-100
  critical_categories: ThreatCategory[] // categories at high risk
  elevated_categories: ThreatCategory[] // categories at moderate risk

  // Analysis
  trigger_events: TriggerEvent[]
  trajectory: TrajectoryAssessment
  time_to_crisis: TimeToCrisis | null

  // Supporting data
  confidence: number // overall assessment confidence (0-1)
  data_coverage: {
    events_analyzed: number
    signals_detected: number
    predictions_integrated: number
  }
}

/**
 * Calculate threat score for a specific category
 * Returns score with 0.25 precision (0.00, 0.25, 0.50, 0.75, 1.00, etc.)
 *
 * @param supabase - Supabase client
 * @param countryCode - ISO 2-letter country code
 * @param category - Threat category to assess
 * @param days - Number of days of lookback (default 90)
 */
async function calculateCategoryScore(
  supabase: SupabaseClient,
  countryCode: string,
  category: ThreatCategory,
  days: number = 90
): Promise<{
  score: number
  event_count: number
  events: TriggerEvent[]
  trend: 'improving' | 'stable' | 'deteriorating'
}> {
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const recentDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Map threat categories to event types/categories in database
  const categoryMapping: Record<ThreatCategory, string[]> = {
    [ThreatCategory.ARMED_CONFLICT]: ['armed_conflict', 'battles', 'military_clash'],
    [ThreatCategory.TERRORISM]: ['terrorism', 'terrorist_attack', 'suicide_bombing'],
    [ThreatCategory.CIVIL_UNREST]: ['protest', 'riot', 'civil_unrest', 'demonstration'],
    [ThreatCategory.POLITICAL_INSTABILITY]: ['political_violence', 'coup', 'government_change', 'election_violence'],
    [ThreatCategory.HUMANITARIAN_CRISIS]: ['humanitarian_aid', 'displacement', 'refugee_crisis', 'famine'],
    [ThreatCategory.CYBER_THREATS]: ['cyberattack', 'ransomware', 'data_breach', 'infrastructure_cyber'],
    [ThreatCategory.ECONOMIC_DISRUPTION]: ['economic_collapse', 'currency_crisis', 'sanctions', 'embargo'],
    [ThreatCategory.ENVIRONMENTAL_HAZARD]: ['earthquake', 'flood', 'natural_disaster', 'epidemic', 'pandemic'],
    [ThreatCategory.CROSS_BORDER_SPILLOVER]: ['cross_border_violence', 'refugee_flow', 'border_clash'],
    [ThreatCategory.MARITIME_SECURITY]: ['piracy', 'maritime_incident', 'vessel_hijack', 'shipping_disruption'],
    [ThreatCategory.AVIATION_SECURITY]: ['aviation_incident', 'airport_closure', 'flight_disruption'],
    [ThreatCategory.INFRASTRUCTURE_DISRUPTION]: ['infrastructure_attack', 'power_outage', 'transport_shutdown'],
  }

  const eventTypes = categoryMapping[category] || []

  // Query recent and longer-term events
  const { data: allEvents } = await supabase
    .from('events')
    .select('id, occurred_at, severity, event_type, category, entities, casualty_estimate, significance_score')
    .eq('country_code', countryCode)
    .gte('occurred_at', sinceDate)
    .order('occurred_at', { ascending: false })

  if (!allEvents) {
    return {
      score: 0,
      event_count: 0,
      events: [],
      trend: 'stable',
    }
  }

  // Filter events matching this category
  const relevantEvents = allEvents.filter(evt => {
    const type = (evt.event_type as string || '').toLowerCase()
    const cat = (evt.category as string || '').toLowerCase()
    return eventTypes.some(t => type.includes(t) || cat.includes(t))
  })

  if (relevantEvents.length === 0) {
    return {
      score: 0,
      event_count: 0,
      events: [],
      trend: 'stable',
    }
  }

  // Calculate score based on:
  // 1. Event frequency (raw count)
  // 2. Severity distribution (average severity, max severity)
  // 3. Significance/casualty estimates
  // 4. Recency boost

  const recentEvents = relevantEvents.filter(e => new Date(e.occurred_at as string) > new Date(recentDate))
  const frequencyScore = Math.min(30, relevantEvents.length * 0.5) // 30 points max for frequency

  const avgSeverity = relevantEvents.reduce((sum, e) => sum + (e.severity as number || 2), 0) / relevantEvents.length
  const severityScore = (avgSeverity / 4) * 25 // 25 points max for severity

  // Casualty and significance boost
  const casualtyBoost = relevantEvents.reduce((sum, e) => {
    const casualties = (e.casualty_estimate as number) || 0
    return sum + Math.min(15, casualties / 10) // 15 points max
  }, 0) / relevantEvents.length

  const significanceBoost = relevantEvents.reduce((sum, e) => {
    const sig = (e.significance_score as number) || 0
    return sum + (sig / 100) * 15 // 15 points max
  }, 0) / relevantEvents.length

  // Recency boost: +10 if events in last week
  const recencyBoost = recentEvents.length > 0 ? 10 : 0

  // Sum scores and cap at 100
  let baseScore = frequencyScore + severityScore + casualtyBoost + significanceBoost + recencyBoost
  baseScore = Math.min(100, baseScore)

  // Round to 0.25 precision
  const precisionScore = Math.round(baseScore * 4) / 4

  // Determine trend: compare last 30 days to prior 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const recentCount = relevantEvents.filter(e => new Date(e.occurred_at as string) > new Date(thirtyDaysAgo)).length
  const priorCount = relevantEvents.filter(e => {
    const d = new Date(e.occurred_at as string)
    return d > new Date(sixtyDaysAgo) && d <= new Date(thirtyDaysAgo)
  }).length

  let trend: 'improving' | 'stable' | 'deteriorating' = 'stable'
  if (recentCount > priorCount * 1.3) trend = 'deteriorating'
  else if (recentCount < priorCount * 0.7) trend = 'improving'

  // Create trigger events
  const triggerEvents = relevantEvents.slice(0, 5).map(evt => ({
    category,
    description: `${evt.event_type}: ${evt.category}${(evt.casualty_estimate as number) ? ` (${evt.casualty_estimate} casualties)` : ''}`,
    score: (evt.significance_score as number) || 50,
    severity: (evt.severity as number) || 2,
    confidence: 0.85,
    event_count: relevantEvents.length,
    primary_actors: (evt.entities as Record<string, unknown> || {}).actors ?
      ((evt.entities as Record<string, unknown>).actors as string[]).slice(0, 3) : [],
    timestamp: evt.occurred_at as string,
  }))

  return {
    score: precisionScore,
    event_count: relevantEvents.length,
    events: triggerEvents,
    trend,
  }
}

/**
 * Fetch recent predictions to enhance assessment
 */
async function getRecentPredictions(
  supabase: SupabaseClient,
  countryCode: string
): Promise<Array<{ prediction_type: string; probability: number; direction: string }>> {
  const { data: predictions } = await supabase
    .from('predictions')
    .select('prediction_type, probability, direction')
    .eq('country_code', countryCode)
    .gte('expires_at', new Date().toISOString())
    .order('confidence', { ascending: false })
    .limit(10)

  return predictions || []
}

/**
 * Determine overall warning level from threat scores
 */
function determineWarningLevel(threatScores: Record<ThreatCategory, number>): WarningLevel {
  const scores = Object.values(threatScores)
  const maxScore = Math.max(...scores)
  const criticalCount = scores.filter(s => s >= 75).length
  const elevatedCount = scores.filter(s => s >= 50).length
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  // Level 5 CRITICAL: Any category > 90 OR 3+ categories > 75
  if (maxScore > 90 || criticalCount >= 3) return WarningLevel.CRITICAL

  // Level 4 SEVERE: Max score 75-90 OR 2+ categories > 75 OR avg > 65
  if ((maxScore >= 75 && maxScore <= 90) || criticalCount >= 2 || avgScore > 65) return WarningLevel.SEVERE

  // Level 3 HIGH: Max score 50-75 OR 3+ elevated categories OR avg > 45
  if ((maxScore >= 50 && maxScore < 75) || elevatedCount >= 3 || avgScore > 45) return WarningLevel.HIGH

  // Level 2 ELEVATED: Max score 25-50 OR any elevated category OR avg > 20
  if ((maxScore >= 25 && maxScore < 50) || elevatedCount >= 1 || avgScore > 20) return WarningLevel.ELEVATED

  // Level 1 STABLE: Max score < 25
  return WarningLevel.STABLE
}

/**
 * Calculate trajectory based on trend data
 */
function calculateTrajectory(categoryDetails: Record<ThreatCategory, {
  score: number
  trend: 'improving' | 'stable' | 'deteriorating'
}>): TrajectoryAssessment {
  const categories = Object.values(categoryDetails)
  const deteriorating = categories.filter(c => c.trend === 'deteriorating').length
  const improving = categories.filter(c => c.trend === 'improving').length

  let direction: 'improving' | 'stable' | 'deteriorating' = 'stable'
  if (deteriorating > improving * 2) direction = 'deteriorating'
  else if (improving > deteriorating * 2) direction = 'improving'

  // Velocity: -100 (strongly improving) to +100 (rapidly deteriorating)
  const velocity = ((deteriorating - improving) / categories.length) * 100

  return {
    direction,
    confidence: 0.7 + (Math.abs(deteriorating - improving) / categories.length) * 0.3,
    velocity,
    momentum_days: 14, // Based on 14-day minimum trend window
    inflection_points: [],
  }
}

/**
 * Estimate time to crisis based on escalation velocity
 */
function estimateTimeToCrisis(
  threatScores: Record<ThreatCategory, number>,
  trajectory: TrajectoryAssessment,
  warningLevel: WarningLevel
): TimeToCrisis | null {
  // Only estimate if at elevated risk or deteriorating
  if (warningLevel < WarningLevel.ELEVATED && trajectory.direction !== 'deteriorating') {
    return null
  }

  // Find primary driver (highest scoring category)
  const sorted = Object.entries(threatScores).sort((a, b) => b[1] - a[1])
  const primaryDriver = sorted[0]?.[0] as ThreatCategory || ThreatCategory.ARMED_CONFLICT
  const currentScore = sorted[0]?.[1] || 0

  // Distance to critical threshold (90)
  const thresholdDistance = Math.max(0, 90 - currentScore)

  // Escalation velocity (0-100 per day)
  // Derived from trajectory velocity converted to daily change
  const dailyVelocity = Math.max(0.25, Math.abs(trajectory.velocity) / 14)

  // Estimate hours to reach 90 (if deteriorating) or stabilization
  let estimateHours: number
  if (trajectory.direction === 'deteriorating' && thresholdDistance > 0) {
    // At current velocity, how many days to reach threshold?
    const daysToThreshold = thresholdDistance / dailyVelocity
    estimateHours = daysToThreshold * 24
  } else if (trajectory.direction === 'improving') {
    // Improve to safety (below 40)
    const improvementNeeded = Math.max(0, currentScore - 40)
    const daysToSafety = improvementNeeded / dailyVelocity
    estimateHours = daysToSafety * 24
  } else {
    // Stable: project to next 30 days
    estimateHours = 30 * 24
  }

  // Confidence based on data and trend strength
  const confidence = Math.min(0.9, 0.5 + (Math.abs(dailyVelocity) / 100) * 0.4)

  return {
    estimate_hours: Math.round(estimateHours),
    estimate_days: Math.round(estimateHours / 24),
    confidence,
    primary_driver: primaryDriver,
    escalation_velocity: dailyVelocity,
    threshold_distance: thresholdDistance,
  }
}

/**
 * Main Early Warning Assessment Function
 *
 * @param countryCode - ISO 2-letter country code
 * @param supabase - Supabase client (optional, creates service client if not provided)
 */
export async function calculateEarlyWarning(
  countryCode: string,
  supabase?: SupabaseClient
): Promise<EarlyWarningAssessment> {
  const client = supabase || createServiceClient()
  const now = new Date()
  const countryCodeUpper = countryCode.toUpperCase()

  // Get country name (basic mapping, can be enhanced)
  const countryNames: Record<string, string> = {
    'SY': 'Syria',
    'UA': 'Ukraine',
    'YE': 'Yemen',
    'SO': 'Somalia',
    'MM': 'Myanmar',
    'SS': 'South Sudan',
    'AF': 'Afghanistan',
    'PK': 'Pakistan',
    'NG': 'Nigeria',
    'CD': 'Democratic Republic of Congo',
  }
  const countryName = countryNames[countryCodeUpper] || countryCodeUpper

  // Calculate scores for all threat categories
  const threatScores: Record<ThreatCategory, number> = {} as Record<ThreatCategory, number>
  const categoryDetails: Record<ThreatCategory, {
    score: number
    event_count: number
    recent_events: TriggerEvent[]
    trend: 'improving' | 'stable' | 'deteriorating'
  }> = {} as Record<ThreatCategory, {
    score: number
    event_count: number
    recent_events: TriggerEvent[]
    trend: 'improving' | 'stable' | 'deteriorating'
  }>

  const allTriggers: TriggerEvent[] = []

  // Calculate each category
  for (const category of Object.values(ThreatCategory)) {
    const result = await calculateCategoryScore(client, countryCodeUpper, category)
    threatScores[category] = result.score
    categoryDetails[category] = {
      score: result.score,
      event_count: result.event_count,
      recent_events: result.events,
      trend: result.trend,
    }
    allTriggers.push(...result.events)
  }

  // Determine warning level
  const warningLevel = determineWarningLevel(threatScores)

  // Calculate trajectory
  const trajectory = calculateTrajectory(categoryDetails)

  // Estimate time to crisis
  const timeToCrisis = estimateTimeToCrisis(threatScores, trajectory, warningLevel)

  // Identify critical and elevated categories
  const criticalCategories = Object.entries(threatScores)
    .filter(([_, score]) => score >= 75)
    .map(([cat]) => cat as ThreatCategory)

  const elevatedCategories = Object.entries(threatScores)
    .filter(([_, score]) => score >= 50 && score < 75)
    .map(([cat]) => cat as ThreatCategory)

  // Calculate composite score (weighted average, emphasizing high scores)
  const compositeScore = Math.round(
    Object.values(threatScores).reduce((sum, score) => sum + score, 0) /
    Object.values(threatScores).length
  )

  // Get supporting data counts
  const { count: eventCount } = await client
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('country_code', countryCodeUpper)
    .gte('occurred_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

  const { count: signalCount } = await client
    .from('correlation_signals')
    .select('*', { count: 'exact', head: true })
    .eq('region', countryCodeUpper)
    .gte('detected_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const { count: predictionCount } = await client
    .from('predictions')
    .select('*', { count: 'exact', head: true })
    .eq('country_code', countryCodeUpper)
    .gte('expires_at', now.toISOString())

  return {
    country_code: countryCodeUpper,
    country_name: countryName,
    timestamp: now.toISOString(),
    warning_level: warningLevel,
    warning_level_name: WarningLevelNames[warningLevel],

    threat_scores: threatScores,
    category_details: categoryDetails,

    composite_score: compositeScore,
    critical_categories: criticalCategories,
    elevated_categories: elevatedCategories,

    trigger_events: allTriggers.sort((a, b) => b.score - a.score).slice(0, 10),
    trajectory,
    time_to_crisis: timeToCrisis,

    confidence: 0.8,
    data_coverage: {
      events_analyzed: eventCount || 0,
      signals_detected: signalCount || 0,
      predictions_integrated: predictionCount || 0,
    },
  }
}

/**
 * Batch assessment for multiple countries
 */
export async function calculateEarlyWarningsForCountries(
  countryCodes: string[],
  supabase?: SupabaseClient
): Promise<EarlyWarningAssessment[]> {
  const client = supabase || createServiceClient()
  const assessments: EarlyWarningAssessment[] = []

  for (const code of countryCodes) {
    try {
      const assessment = await calculateEarlyWarning(code, client)
      assessments.push(assessment)
    } catch (error) {
      console.error(`[early-warning] Error assessing ${code}:`, error)
    }
  }

  return assessments
}
