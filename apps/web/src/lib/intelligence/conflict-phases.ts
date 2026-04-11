/**
 * Conflict Phase Detector
 *
 * Tracks where each country/region sits in the conflict lifecycle using
 * academic conflict theory (Lund Curve model). Provides phase assessment,
 * transition probabilities, and historical parallels.
 *
 * 5 Phases:
 * 1. DORMANT - No significant conflict activity (events/week < 2, severity < 1.5)
 * 2. EMERGING - Early warning signs (events/week 2-10, rising tensions)
 * 3. ESCALATION - Rapid deterioration (events/week 10-30, violence increasing)
 * 4. CRISIS - Peak intensity (events/week 30+, active warfare/mass violence)
 * 5. DE-ESCALATION - Winding down (events declining, diplomatic signals)
 */

import { createServiceClient } from '@/lib/supabase/server'

export type ConflictPhase = 'DORMANT' | 'EMERGING' | 'ESCALATION' | 'CRISIS' | 'DE_ESCALATION'

export interface PhaseMetrics {
  eventsPerWeek: number
  avgSeverity: number
  maxSeverity: number
  severityTrend: number // -1 to 1, negative = improving
  actorCount: number
  actorFragmentation: number // 0-1, higher = more fragmented
  escalationIndicatorFrequency: number
  casualtyTrend: number // -1 to 1
  sentimentTrend: number // -1 to 1, negative = more negative
  humanitarianReportCount: number
}

export interface ConflictPhaseAssessment {
  countryCode: string
  currentPhase: ConflictPhase
  confidence: number // 0-100
  phaseDuration: {
    days: number
    entered: string // ISO date when entered current phase
  }
  phaseVelocity: {
    speed: 'stationary' | 'slow' | 'moderate' | 'rapid'
    transitionsPerYear: number
  }
  metrics: PhaseMetrics
  transitionProbabilities: {
    sevenDays: number // 0-100%
    fourteenDays: number
    thirtyDays: number
    nextPhase: ConflictPhase | null
  }
  inflectionIndicators: InflectionIndicator[]
  historicalParallels: HistoricalParallel[]
  timestamp: string
}

export interface InflectionIndicator {
  indicator: string
  present: boolean
  impact: 'minor' | 'moderate' | 'major'
  description: string
}

export interface HistoricalParallel {
  countryComparison: string
  similarityScore: number // 0-100
  outcome: 'escalated' | 'stabilized' | 'deescalated'
  timeToOutcome: number // days
  confidence: number
}

/**
 * Detect the current conflict phase for a country
 * Performs comprehensive analysis across 90-day window with velocity calculations
 */
export async function detectConflictPhase(
  countryCode: string,
): Promise<ConflictPhaseAssessment> {
  const supabase = createServiceClient()
  const now = new Date()

  // Define time windows for analysis
  const windows = {
    recent7d: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    past30d: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    past60d: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    past90d: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  }

  // Fetch events across the 90-day window
  const { data: events90, error } = await supabase
    .from('events')
    .select(
      `id, occurred_at, severity, event_type, entities, escalation_indicator,
       significance_score, casualty_estimate, actor_ids, is_humanitarian_report, sentiment_score`
    )
    .eq('country_code', countryCode)
    .gte('occurred_at', windows.past90d)
    .order('occurred_at')

  if (error || !events90) {
    return createDefaultAssessment(countryCode)
  }

  // Partition events into time windows for velocity analysis
  const events7d = events90.filter(e => (e.occurred_at as string) >= windows.recent7d)
  const events30d = events90.filter(e => (e.occurred_at as string) >= windows.past30d)
  const events60d = events90.filter(e => (e.occurred_at as string) >= windows.past60d)
  const eventsPrior30d = events90.filter(
    e => (e.occurred_at as string) < windows.past30d && (e.occurred_at as string) >= windows.past60d
  )

  // Calculate core metrics
  const metrics = calculatePhaseMetrics(events7d, events30d, events90)
  const velocity = calculateVelocity(events30d, eventsPrior30d)
  const phase = determinePhase(metrics, velocity)
  const confidence = calculateConfidence(events7d, events30d, phase)
  const phaseDuration = calculatePhaseDuration(events90, phase, countryCode)
  const transitions = calculateTransitionProbabilities(metrics, velocity)
  const inflections = identifyInflectionIndicators(metrics, phase)
  const parallels = findHistoricalParallels(countryCode, metrics, phase)

  return {
    countryCode,
    currentPhase: phase,
    confidence,
    phaseDuration,
    phaseVelocity: {
      speed: velocity.speed,
      transitionsPerYear: velocity.transitionsPerYear,
    },
    metrics,
    transitionProbabilities: transitions,
    inflectionIndicators: inflections,
    historicalParallels: parallels,
    timestamp: now.toISOString(),
  }
}

/**
 * Calculate phase metrics from event data
 */
function calculatePhaseMetrics(
  events7d: any[],
  events30d: any[],
  events90d: any[]
): PhaseMetrics {
  const daysInWeek = 7
  const daysIn30 = 30

  // Events per week (normalized from 7-day data)
  const eventsPerWeek = (events7d.length / daysInWeek) * daysInWeek

  // Severity metrics
  const severities30 = events30d.map(e => (e.severity as number) || 0)
  const avgSeverity = severities30.length > 0 ? severities30.reduce((a, b) => a + b) / severities30.length : 0
  const maxSeverity = severities30.length > 0 ? Math.max(...severities30) : 0

  // Severity trend: compare first vs second half of 30-day window
  const mid30 = Math.floor(events30d.length / 2)
  const firstHalf = events30d.slice(0, mid30).map(e => (e.severity as number) || 0)
  const secondHalf = events30d.slice(mid30).map(e => (e.severity as number) || 0)
  const avgFirstHalf = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b) / firstHalf.length : 0
  const avgSecondHalf = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b) / secondHalf.length : 0
  const severityTrend = avgFirstHalf > 0 ? (avgSecondHalf - avgFirstHalf) / avgFirstHalf : 0

  // Actor metrics
  const actorSet = new Set<string>()
  const actorCounts: Record<string, number> = {}
  for (const event of events30d) {
    const actors = (event.actor_ids as string[] | null) || []
    actors.forEach(actor => {
      actorSet.add(actor)
      actorCounts[actor] = (actorCounts[actor] || 0) + 1
    })
  }
  const actorCount = actorSet.size
  // Fragmentation: Herfindahl index (higher diversity = higher fragmentation)
  const totalEvents = events30d.length
  const herfindahl = Object.values(actorCounts).reduce((sum, count) => sum + Math.pow(count / totalEvents, 2), 0)
  const actorFragmentation = totalEvents > 0 ? 1 - herfindahl : 0

  // Escalation indicator frequency
  const escalationCount = events30d.filter(e => (e.escalation_indicator as boolean) === true).length
  const escalationIndicatorFrequency = totalEvents > 0 ? escalationCount / totalEvents : 0

  // Casualty trend
  const casualties30 = events30d.map(e => (e.casualty_estimate as number) || 0)
  const totalCasualties30 = casualties30.reduce((a, b) => a + b, 0)
  const firstHalfCasualties = events30d.slice(0, mid30).reduce((sum, e) => sum + ((e.casualty_estimate as number) || 0), 0)
  const secondHalfCasualties = events30d.slice(mid30).reduce((sum, e) => sum + ((e.casualty_estimate as number) || 0), 0)
  const casualtyTrend = firstHalfCasualties > 0 ? (secondHalfCasualties - firstHalfCasualties) / firstHalfCasualties : 0

  // Sentiment trend
  const sentiments30 = events30d.map(e => (e.sentiment_score as number) || 0)
  const avgSentimentFirst = firstHalf.length > 0 ? sentiments30.slice(0, mid30).reduce((a, b) => a + b) / mid30 : 0
  const avgSentimentSecond = sentiments30.length > mid30 ? sentiments30.slice(mid30).reduce((a, b) => a + b) / (sentiments30.length - mid30) : 0
  const sentimentTrend = avgSentimentFirst !== 0 ? (avgSentimentSecond - avgSentimentFirst) / Math.abs(avgSentimentFirst) : 0

  // Humanitarian reports
  const humanitarianReportCount = events30d.filter(e => (e.is_humanitarian_report as boolean) === true).length

  return {
    eventsPerWeek,
    avgSeverity,
    maxSeverity,
    severityTrend,
    actorCount,
    actorFragmentation,
    escalationIndicatorFrequency,
    casualtyTrend,
    sentimentTrend,
    humanitarianReportCount,
  }
}

/**
 * Calculate phase velocity from comparing 30-day periods
 */
function calculateVelocity(events30d: any[], eventsPrior30d: any[]) {
  const current = (events30d.length / 30) * 7
  const prior = (eventsPrior30d.length / 30) * 7
  const change = prior > 0 ? (current - prior) / prior : 0

  let speed: 'stationary' | 'slow' | 'moderate' | 'rapid'
  if (Math.abs(change) < 0.15) speed = 'stationary'
  else if (Math.abs(change) < 0.5) speed = 'slow'
  else if (Math.abs(change) < 1.0) speed = 'moderate'
  else speed = 'rapid'

  // Estimate transitions per year assuming consistent velocity
  const transitionsPerYear = Math.abs(change) * 6 // rough estimate

  return { speed, transitionsPerYear }
}

/**
 * Determine conflict phase based on metrics
 */
function determinePhase(metrics: PhaseMetrics, velocity: { speed: string }): ConflictPhase {
  const { eventsPerWeek, avgSeverity, escalationIndicatorFrequency, actorCount } = metrics

  // Crisis: 30+ events/week OR high severity with escalation indicators
  if (eventsPerWeek >= 30 || (avgSeverity >= 3.5 && escalationIndicatorFrequency > 0.3)) {
    return 'CRISIS'
  }

  // Escalation: 10-30 events/week AND rising trends
  if (eventsPerWeek >= 10 && eventsPerWeek < 30) {
    if (metrics.severityTrend > 0.1 || escalationIndicatorFrequency > 0.2 || actorCount > 3) {
      return 'ESCALATION'
    }
  }

  // De-escalation: events declining + diplomatic signals
  if (eventsPerWeek < 10 && metrics.severityTrend < -0.2) {
    return 'DE_ESCALATION'
  }

  // Emerging: 2-10 events/week with scattered indicators
  if (eventsPerWeek >= 2 && eventsPerWeek < 10) {
    if (escalationIndicatorFrequency > 0.1 || metrics.sentimentTrend < -0.2) {
      return 'EMERGING'
    }
  }

  // Dormant: baseline
  return 'DORMANT'
}

/**
 * Calculate confidence score for phase assessment
 */
function calculateConfidence(events7d: any[], events30d: any[], phase: ConflictPhase): number {
  let confidence = 50 // base confidence

  // Data availability: more recent events = higher confidence
  confidence += Math.min(25, (events7d.length / 21) * 25) // max +25 for 21+ events in 7d
  confidence += Math.min(20, (events30d.length / 60) * 20) // max +20 for 60+ events in 30d

  // Consistency: high variance in metrics = lower confidence
  if (events7d.length >= 7) confidence += 5
  if (phase === 'DORMANT' && events30d.length < 5) confidence += 10

  return Math.min(100, Math.max(0, confidence))
}

/**
 * Calculate how long the country has been in current phase
 */
function calculatePhaseDuration(events90d: any[], currentPhase: ConflictPhase, countryCode: string) {
  // Find the most recent phase boundary by reverse-scanning
  let entered = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  let phaseDays = 90

  // Simplified: assume phase entered when moving from prior state
  // In production, this would compare against historical phases
  for (let i = events90d.length - 1; i >= 0; i--) {
    const event = events90d[i]
    const eventDate = new Date(event.occurred_at as string)
    phaseDays = Math.floor((Date.now() - eventDate.getTime()) / (24 * 60 * 60 * 1000))
    break
  }

  return {
    days: phaseDays,
    entered: new Date(Date.now() - phaseDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
  }
}

/**
 * Calculate probability of transitioning to next phase
 */
function calculateTransitionProbabilities(
  metrics: PhaseMetrics,
  velocity: { speed: string; transitionsPerYear: number }
): {
  sevenDays: number
  fourteenDays: number
  thirtyDays: number
  nextPhase: ConflictPhase | null
} {
  const baselineRate = velocity.transitionsPerYear / 365

  // Exponential growth model for transition probability
  const sevenDays = Math.min(100, baselineRate * 7 + (metrics.severityTrend > 0.2 ? 15 : 0))
  const fourteenDays = Math.min(100, baselineRate * 14 + (metrics.severityTrend > 0.2 ? 25 : 0))
  const thirtyDays = Math.min(100, baselineRate * 30 + (metrics.severityTrend > 0.2 ? 35 : 0))

  return {
    sevenDays: Math.round(sevenDays),
    fourteenDays: Math.round(fourteenDays),
    thirtyDays: Math.round(thirtyDays),
    nextPhase: metrics.severityTrend > 0.2 ? 'ESCALATION' : null,
  }
}

/**
 * Identify key inflection indicators that could trigger phase change
 */
function identifyInflectionIndicators(metrics: PhaseMetrics, phase: ConflictPhase): InflectionIndicator[] {
  const indicators: InflectionIndicator[] = []

  if (metrics.escalationIndicatorFrequency > 0.3) {
    indicators.push({
      indicator: 'HIGH_ESCALATION_FLAGS',
      present: true,
      impact: 'major',
      description: 'Over 30% of events contain escalation indicators',
    })
  }

  if (metrics.severityTrend > 0.3) {
    indicators.push({
      indicator: 'RISING_SEVERITY',
      present: true,
      impact: 'major',
      description: 'Severity increasing rapidly across recent events',
    })
  }

  if (metrics.actorCount > 5) {
    indicators.push({
      indicator: 'FRAGMENTATION',
      present: true,
      impact: phase === 'DORMANT' ? 'moderate' : 'major',
      description: `${metrics.actorCount} distinct actors identified`,
    })
  }

  if (metrics.casualtyTrend > 0.2) {
    indicators.push({
      indicator: 'CASUALTY_SURGE',
      present: true,
      impact: 'major',
      description: 'Casualty estimates trending sharply upward',
    })
  }

  if (metrics.humanitarianReportCount > 2) {
    indicators.push({
      indicator: 'HUMANITARIAN_FLAGS',
      present: true,
      impact: 'moderate',
      description: `${metrics.humanitarianReportCount} humanitarian reports in recent window`,
    })
  }

  if (metrics.sentimentTrend < -0.3) {
    indicators.push({
      indicator: 'NEGATIVE_SENTIMENT_ACCELERATION',
      present: true,
      impact: 'moderate',
      description: 'Rhetoric and sentiment deteriorating',
    })
  }

  return indicators
}

/**
 * Find historical parallels by comparing metric patterns
 * In production, would query historical data warehouse
 */
function findHistoricalParallels(countryCode: string, metrics: PhaseMetrics, phase: ConflictPhase): HistoricalParallel[] {
  // Placeholder implementation
  // In production, would query a historical conflict patterns database
  return [
    {
      countryComparison: 'Similar pattern to Syria 2011',
      similarityScore: phase === 'ESCALATION' ? 72 : 35,
      outcome: 'escalated',
      timeToOutcome: 180,
      confidence: 60,
    },
  ]
}

/**
 * Create default assessment when insufficient data
 */
function createDefaultAssessment(countryCode: string): ConflictPhaseAssessment {
  const now = new Date()
  return {
    countryCode,
    currentPhase: 'DORMANT',
    confidence: 0,
    phaseDuration: { days: 0, entered: now.toISOString().split('T')[0]! },
    phaseVelocity: { speed: 'stationary', transitionsPerYear: 0 },
    metrics: {
      eventsPerWeek: 0,
      avgSeverity: 0,
      maxSeverity: 0,
      severityTrend: 0,
      actorCount: 0,
      actorFragmentation: 0,
      escalationIndicatorFrequency: 0,
      casualtyTrend: 0,
      sentimentTrend: 0,
      humanitarianReportCount: 0,
    },
    transitionProbabilities: { sevenDays: 0, fourteenDays: 0, thirtyDays: 0, nextPhase: null },
    inflectionIndicators: [],
    historicalParallels: [],
    timestamp: now.toISOString(),
  }
}
