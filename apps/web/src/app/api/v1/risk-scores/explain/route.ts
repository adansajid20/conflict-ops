export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* ================================================================== */
/*  Explainable Risk Scoring API                                     */
/*  6-Indicator ACLED-inspired methodology with transparent reasoning */
/* ================================================================== */

type RiskIndicator = {
  name: string
  score: number // 0-100
  reasoning: string
  trend: 'up' | 'down' | 'stable'
  trendPercent: number // percentage change vs prior period
}

type RiskScoreResponse = {
  success: boolean
  data?: {
    country_code?: string
    region?: string
    overall_risk_score: number // 0-100
    risk_grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' // A=lowest, F=highest
    conflict_intensity: RiskIndicator
    civilian_impact: RiskIndicator
    geographic_spread: RiskIndicator
    escalation_trajectory: RiskIndicator
    actor_fragmentation: RiskIndicator
    international_attention: RiskIndicator
    reasoning: string // executive summary
    data_quality: {
      event_count_analyzed: number
      event_count_current_period: number
      event_count_prior_period: number
      date_range_start: string
      date_range_end: string
      confidence_level: 'high' | 'medium' | 'low' // based on event count
    }
    last_updated: string
    methodology_version: string
  }
  error?: string
  meta?: Record<string, unknown>
}

type EventRecord = {
  id: string
  occurred_at: string
  severity: number | null
  region: string | null
  country_code: string | null
  event_type: string | null
  category: string | null
  entities: Record<string, unknown> | null
  escalation_indicator: string | null
  significance_score: number | null
  sentiment_score: number | null
  is_humanitarian_report: boolean | null
  casualty_estimate: number | null
  actor_ids: string[] | null
}

function getLetterGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  if (score >= 50) return 'E'
  return 'F'
}

function calculateConflictIntensity(currentEvents: EventRecord[], priorEvents: EventRecord[]): RiskIndicator {
  // Frequency + severity weighting
  const severityWeights = { 1: 0.5, 2: 1, 3: 2, 4: 3, 5: 4 }

  const currentScore = currentEvents.reduce((acc, e) => {
    const sev = e.severity ?? 1
    const weight = severityWeights[sev as keyof typeof severityWeights] ?? 1
    return acc + weight
  }, 0)

  const priorScore = priorEvents.reduce((acc, e) => {
    const sev = e.severity ?? 1
    const weight = severityWeights[sev as keyof typeof severityWeights] ?? 1
    return acc + weight
  }, 0)

  // Normalize to 0-100 scale
  const normalizedCurrent = Math.min(100, (currentScore / 10))
  const normalizedPrior = Math.min(100, (priorScore / 10))

  const criticalCount = currentEvents.filter(e => (e.severity ?? 1) >= 4).length
  const highCount = currentEvents.filter(e => (e.severity ?? 1) === 3).length
  const criticalPercent = currentEvents.length > 0 ? ((criticalCount + highCount) / currentEvents.length * 100).toFixed(0) : '0'

  const trendPercent = priorScore > 0 ? ((normalizedCurrent - normalizedPrior) / normalizedPrior * 100) : 0
  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (trendPercent > 10) trend = 'up'
  else if (trendPercent < -10) trend = 'down'

  const reasoning = `Conflict intensity is ${normalizedCurrent >= 70 ? 'HIGH' : normalizedCurrent >= 50 ? 'MODERATE' : 'LOW'} (${Math.round(normalizedCurrent)}/100) because there were ${currentEvents.length} events in the last 30 days, ${criticalPercent}% classified as critical or high severity, ${priorEvents.length > 0 ? `${priorEvents.length} events in the prior period` : 'no prior events'}. ${trendPercent > 0 ? `Trend is upward (+${Math.round(Math.abs(trendPercent))}%)` : trendPercent < 0 ? `Trend is downward (${Math.round(trendPercent)}%)` : 'Trend is stable'}.`

  return {
    name: 'Conflict Intensity',
    score: normalizedCurrent,
    reasoning,
    trend,
    trendPercent: Math.round(trendPercent),
  }
}

function calculateCivilianImpact(currentEvents: EventRecord[], priorEvents: EventRecord[]): RiskIndicator {
  // Humanitarian events + casualty estimates
  const currentHumanitarian = currentEvents.filter(e => e.is_humanitarian_report === true).length
  const currentCasualties = currentEvents.reduce((acc, e) => acc + (e.casualty_estimate ?? 0), 0)

  const priorHumanitarian = priorEvents.filter(e => e.is_humanitarian_report === true).length
  const priorCasualties = priorEvents.reduce((acc, e) => acc + (e.casualty_estimate ?? 0), 0)

  // Score: humanitarian events (0-40) + casualty estimates (0-60)
  const humanitarianScore = Math.min(40, currentHumanitarian * 2)
  const casualtyScore = Math.min(60, currentCasualties / 5) // 1 casualty = 0.2 points, 300+ = max
  const score = humanitarianScore + casualtyScore

  const priorHumanitarianScore = Math.min(40, priorHumanitarian * 2)
  const priorCasualtyScore = Math.min(60, priorCasualties / 5)
  const priorScore = priorHumanitarianScore + priorCasualtyScore

  const trendPercent = priorScore > 0 ? ((score - priorScore) / priorScore * 100) : 0
  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (trendPercent > 10) trend = 'up'
  else if (trendPercent < -10) trend = 'down'

  const reasoning = `Civilian impact is ${score >= 60 ? 'SEVERE' : score >= 40 ? 'SIGNIFICANT' : 'MODERATE'} (${Math.round(score)}/100) due to ${currentHumanitarian} humanitarian events and an estimated ${currentCasualties} casualties in the current period, ${priorCasualties > 0 ? `compared to ${priorCasualties} prior` : 'with no casualties in the prior period'}. ${currentCasualties > 0 ? `The casualty toll indicates significant human suffering.` : ''}`

  return {
    name: 'Civilian Impact',
    score: Math.min(100, score),
    reasoning,
    trend,
    trendPercent: Math.round(trendPercent),
  }
}

function calculateGeographicSpread(currentEvents: EventRecord[]): RiskIndicator {
  // Count distinct sub-regions/locations
  const regionsSet = new Set<string>()
  for (const e of currentEvents) {
    if (e.region) regionsSet.add(e.region)
  }

  const distinctRegions = regionsSet.size

  // More regions = higher diffusion
  // 0-5 regions = score 0-20, 5-20 regions = 20-80, 20+ = 80-100
  let score = 0
  if (distinctRegions <= 5) {
    score = (distinctRegions / 5) * 20
  } else if (distinctRegions <= 20) {
    score = 20 + ((distinctRegions - 5) / 15) * 60
  } else {
    score = Math.min(100, 80 + (distinctRegions - 20) * 1)
  }

  const reasoning = `Geographic spread is ${score >= 60 ? 'WIDESPREAD' : score >= 40 ? 'MODERATE' : 'CONCENTRATED'} (${Math.round(score)}/100) with conflict affecting ${distinctRegions} distinct region${distinctRegions !== 1 ? 's' : ''} over the 30-day period. ${distinctRegions >= 10 ? 'The wide geographic diffusion indicates systemic instability rather than localized conflict.' : distinctRegions >= 5 ? 'Multiple affected regions suggest conflict beyond a single flashpoint.' : 'Conflict remains concentrated in a limited geographic area.'}`

  return {
    name: 'Geographic Spread',
    score,
    reasoning,
    trend: 'stable', // we don't have prior region data in this context
    trendPercent: 0,
  }
}

function calculateEscalationTrajectory(currentEvents: EventRecord[], priorEvents: EventRecord[]): RiskIndicator {
  // Compare periods for escalation signals
  const currentEscalation = currentEvents.filter(e => e.escalation_indicator).length
  const priorEscalation = priorEvents.filter(e => e.escalation_indicator).length

  // Events trending toward higher severity
  const currentHighSevere = currentEvents.filter(e => (e.severity ?? 1) >= 3).length
  const priorHighSevere = priorEvents.filter(e => (e.severity ?? 1) >= 3).length

  const escalationRate = currentEvents.length > 0 ? (currentEscalation / currentEvents.length) * 100 : 0
  const highSeverityRate = currentEvents.length > 0 ? (currentHighSevere / currentEvents.length) * 100 : 0

  // Score: escalation indicators (0-40) + severity trend (0-60)
  const escalationScore = Math.min(40, currentEscalation * 5)
  const severityScore = Math.min(60, highSeverityRate * 0.6) // max 100% = 60 points
  const score = escalationScore + severityScore

  const priorEscalationScore = Math.min(40, priorEscalation * 5)
  const priorSeverityScore = Math.min(60, (priorHighSevere / Math.max(1, priorEvents.length)) * 100 * 0.6)
  const priorScore = priorEscalationScore + priorSeverityScore

  const trendPercent = priorScore > 0 ? ((score - priorScore) / priorScore * 100) : (score > 0 ? 100 : 0)
  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (trendPercent > 15) trend = 'up'
  else if (trendPercent < -15) trend = 'down'

  const reasoning = `Escalation trajectory is ${score >= 60 ? 'DETERIORATING' : score >= 40 ? 'CONCERNING' : 'STABLE'} (${Math.round(score)}/100). ${currentEscalation} events have explicit escalation indicators, ${escalationRate.toFixed(0)}% of all events. ${highSeverityRate.toFixed(0)}% of events are high severity or above, ${priorHighSevere > 0 ? `compared to ${((priorHighSevere / Math.max(1, priorEvents.length)) * 100).toFixed(0)}% in the prior period` : 'with no such events in the prior period'}. ${trend === 'up' ? 'This suggests deteriorating conditions and rising risks.' : trend === 'down' ? 'Conditions appear to be improving.' : 'The situation remains stable.'}`

  return {
    name: 'Escalation Trajectory',
    score: Math.min(100, score),
    reasoning,
    trend,
    trendPercent: Math.round(trendPercent),
  }
}

function calculateActorFragmentation(currentEvents: EventRecord[]): RiskIndicator {
  // How many distinct actor groups are involved
  const actorsSet = new Set<string>()
  for (const e of currentEvents) {
    if (Array.isArray(e.actor_ids)) {
      for (const actor of e.actor_ids) {
        actorsSet.add(actor)
      }
    }
  }

  const distinctActors = actorsSet.size

  // More actors = harder to resolve, more fragmented
  // 0-2 actors = 0-20, 2-5 = 20-50, 5-10 = 50-80, 10+ = 80-100
  let score = 0
  if (distinctActors <= 2) {
    score = (distinctActors / 2) * 20
  } else if (distinctActors <= 5) {
    score = 20 + ((distinctActors - 2) / 3) * 30
  } else if (distinctActors <= 10) {
    score = 50 + ((distinctActors - 5) / 5) * 30
  } else {
    score = Math.min(100, 80 + (distinctActors - 10) * 2)
  }

  const reasoning = `Actor fragmentation is ${score >= 70 ? 'HIGHLY FRAGMENTED' : score >= 50 ? 'MODERATELY FRAGMENTED' : 'CONCENTRATED'} (${Math.round(score)}/100) with ${distinctActors} distinct actor group${distinctActors !== 1 ? 's' : ''} identified. ${distinctActors >= 5 ? 'High actor fragmentation makes conflict resolution significantly more difficult and increases unpredictability.' : distinctActors >= 3 ? 'Multiple competing actors complicate political settlement.' : 'A dominant actor or bilateral conflict is more predictable.'}`

  return {
    name: 'Actor Fragmentation',
    score,
    reasoning,
    trend: 'stable',
    trendPercent: 0,
  }
}

function calculateInternationalAttention(currentEvents: EventRecord[]): RiskIndicator {
  // Average significance_score + event coverage density
  const scores = currentEvents
    .map(e => e.significance_score ?? 0)
    .filter(s => s > 0)

  const avgSignificance = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const significancePercent = Math.min(60, (avgSignificance / 100) * 60) // max 60 points

  // Coverage density: more events = higher attention (but log scale)
  const densityScore = Math.min(40, Math.log(currentEvents.length + 1) / Math.log(50) * 40)

  const score = significancePercent + densityScore

  const reasoning = `International attention is ${score >= 70 ? 'HIGH' : score >= 50 ? 'MODERATE' : 'LOW'} (${Math.round(score)}/100). The average significance score across ${currentEvents.length} events is ${avgSignificance.toFixed(0)}/100. ${scores.filter(s => s > 70).length > 0 ? `${scores.filter(s => s > 70).length} events have high significance scores (>70).` : 'Events have moderate significance.'} ${currentEvents.length >= 10 ? 'The high event volume suggests sustained international media coverage.' : 'Limited event volume may indicate lower international visibility.'}`

  return {
    name: 'International Attention',
    score: Math.min(100, score),
    reasoning,
    trend: 'stable',
    trendPercent: 0,
  }
}

function calculateOverallRiskScore(indicators: RiskIndicator[]): number {
  // Equal weighting of all 6 indicators
  const sum = indicators.reduce((acc, ind) => acc + ind.score, 0)
  return sum / 6
}

export async function GET(req: NextRequest): Promise<NextResponse<RiskScoreResponse>> {
  try {
    const url = new URL(req.url)
    const countryCode = url.searchParams.get('country_code')
    const region = url.searchParams.get('region')

    if (!countryCode && !region) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either country_code or region query parameter is required',
        },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Query dates
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString()
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString()
    const nowStr = now.toISOString()

    // Fetch events in parallel
    let currentQuery = supabase
      .from('events')
      .select('id, occurred_at, severity, region, country_code, event_type, category, entities, escalation_indicator, significance_score, sentiment_score, is_humanitarian_report, casualty_estimate, actor_ids')
      .gte('occurred_at', thirtyDaysAgoStr)
      .lte('occurred_at', nowStr)

    let priorQuery = supabase
      .from('events')
      .select('id, occurred_at, severity, region, country_code, event_type, category, entities, escalation_indicator, significance_score, sentiment_score, is_humanitarian_report, casualty_estimate, actor_ids')
      .gte('occurred_at', sixtyDaysAgoStr)
      .lt('occurred_at', thirtyDaysAgoStr)

    if (countryCode) {
      currentQuery = currentQuery.eq('country_code', countryCode)
      priorQuery = priorQuery.eq('country_code', countryCode)
    }

    if (region) {
      currentQuery = currentQuery.eq('region', region)
      priorQuery = priorQuery.eq('region', region)
    }

    const [currentRes, priorRes] = await Promise.all([currentQuery, priorQuery])

    const currentEvents = (currentRes.data ?? []) as EventRecord[]
    const priorEvents = (priorRes.data ?? []) as EventRecord[]

    if (currentRes.error) {
      return NextResponse.json(
        { success: false, error: currentRes.error.message },
        { status: 500 }
      )
    }

    if (priorRes.error) {
      return NextResponse.json(
        { success: false, error: priorRes.error.message },
        { status: 500 }
      )
    }

    // Calculate indicators
    const conflictIntensity = calculateConflictIntensity(currentEvents, priorEvents)
    const civilianImpact = calculateCivilianImpact(currentEvents, priorEvents)
    const geographicSpread = calculateGeographicSpread(currentEvents)
    const escalationTrajectory = calculateEscalationTrajectory(currentEvents, priorEvents)
    const actorFragmentation = calculateActorFragmentation(currentEvents)
    const internationalAttention = calculateInternationalAttention(currentEvents)

    const indicators = [
      conflictIntensity,
      civilianImpact,
      geographicSpread,
      escalationTrajectory,
      actorFragmentation,
      internationalAttention,
    ]

    const overallRiskScore = calculateOverallRiskScore(indicators)
    const riskGrade = getLetterGrade(overallRiskScore)

    // Determine confidence level based on event count
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low'
    if (currentEvents.length >= 20) confidenceLevel = 'high'
    else if (currentEvents.length >= 5) confidenceLevel = 'medium'

    // Executive summary
    const reasoning = `Overall risk score is ${Math.round(overallRiskScore)}/100 (Grade: ${riskGrade}). ${
      conflictIntensity.score >= 70 ? 'High conflict intensity ' : conflictIntensity.score >= 50 ? 'Moderate conflict intensity ' : 'Low conflict intensity '
    } combined with ${
      civilianImpact.score >= 60 ? 'severe civilian impact ' : civilianImpact.score >= 40 ? 'significant civilian impact ' : 'moderate civilian impact '
    } and ${
      escalationTrajectory.trend === 'up' ? 'deteriorating escalation trajectory ' : escalationTrajectory.trend === 'down' ? 'improving escalation trajectory ' : 'stable conditions '
    } indicate a ${riskGrade === 'A' ? 'very stable' : riskGrade === 'B' ? 'generally stable' : riskGrade === 'C' ? 'mixed' : riskGrade === 'D' ? 'concerning' : riskGrade === 'E' ? 'very concerning' : 'critical'} situation. Geographic spread across ${new Set(currentEvents.map(e => e.region)).size} regions and ${new Set(currentEvents.flatMap(e => e.actor_ids ?? [])).size} distinct actors shape the operational landscape.`

    return NextResponse.json({
      success: true,
      data: {
        country_code: countryCode ?? undefined,
        region: region ?? undefined,
        overall_risk_score: Math.round(overallRiskScore * 10) / 10,
        risk_grade: riskGrade,
        conflict_intensity: conflictIntensity,
        civilian_impact: civilianImpact,
        geographic_spread: geographicSpread,
        escalation_trajectory: escalationTrajectory,
        actor_fragmentation: actorFragmentation,
        international_attention: internationalAttention,
        reasoning,
        data_quality: {
          event_count_analyzed: currentEvents.length + priorEvents.length,
          event_count_current_period: currentEvents.length,
          event_count_prior_period: priorEvents.length,
          date_range_start: sixtyDaysAgoStr.split('T')[0],
          date_range_end: nowStr.split('T')[0],
          confidence_level: confidenceLevel,
        },
        last_updated: nowStr,
        methodology_version: 'CR-RSM-v1.0',
      },
    } as RiskScoreResponse)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
