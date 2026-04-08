export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'

/* ================================================================ */
/*  Country Code to Name Mapping (Top 50+ Conflict-Affected Nations)*/
/* ================================================================ */
const COUNTRY_CODE_MAP: Record<string, string> = {
  'SY': 'Syria',
  'YE': 'Yemen',
  'AF': 'Afghanistan',
  'IQ': 'Iraq',
  'PS': 'Palestine',
  'UZ': 'Ukraine',
  'SO': 'Somalia',
  'SS': 'South Sudan',
  'SD': 'Sudan',
  'ET': 'Ethiopia',
  'ER': 'Eritrea',
  'DZ': 'Algeria',
  'LY': 'Libya',
  'SN': 'Senegal',
  'NE': 'Niger',
  'ML': 'Mali',
  'BF': 'Burkina Faso',
  'NG': 'Nigeria',
  'CM': 'Cameroon',
  'CF': 'Central African Republic',
  'CG': 'Congo',
  'CD': 'Democratic Republic of the Congo',
  'ZA': 'South Africa',
  'MZ': 'Mozambique',
  'ZW': 'Zimbabwe',
  'TZ': 'Tanzania',
  'KE': 'Kenya',
  'UG': 'Uganda',
  'RW': 'Rwanda',
  'BU': 'Burundi',
  'MM': 'Myanmar',
  'TH': 'Thailand',
  'KH': 'Cambodia',
  'LA': 'Laos',
  'VN': 'Vietnam',
  'PH': 'Philippines',
  'ID': 'Indonesia',
  'PK': 'Pakistan',
  'IN': 'India',
  'BD': 'Bangladesh',
  'NP': 'Nepal',
  'IR': 'Iran',
  'SA': 'Saudi Arabia',
  'AE': 'United Arab Emirates',
  'OM': 'Oman',
  'JO': 'Jordan',
  'LB': 'Lebanon',
  'IL': 'Israel',
  'TR': 'Turkey',
  'RU': 'Russia',
  'GE': 'Georgia',
  'BY': 'Belarus',
  'PL': 'Poland',
  'RO': 'Romania',
  'RS': 'Serbia',
  'BA': 'Bosnia and Herzegovina',
  'HR': 'Croatia',
  'ME': 'Montenegro',
  'KS': 'Kosovo',
  'MK': 'North Macedonia',
  'CL': 'Chile',
  'CO': 'Colombia',
  'PE': 'Peru',
  'BO': 'Bolivia',
  'EC': 'Ecuador',
  'VE': 'Venezuela',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'GT': 'Guatemala',
  'SV': 'El Salvador',
  'HN': 'Honduras',
  'NI': 'Nicaragua',
  'HT': 'Haiti',
  'KP': 'North Korea',
  'KR': 'South Korea',
  'JP': 'Japan',
  'CN': 'China',
  'TW': 'Taiwan',
  'TL': 'Timor-Leste',
  'MN': 'Mongolia',
}

interface DailyEventCount {
  date: string
  count: number
  critical_high: number
  escalation_indicators: number
  fatalities: number
  sentiment_score: number
}

interface Signal {
  signal_type: string
  direction: 'escalating' | 'stable' | 'de-escalating'
  strength: number
  description: string
}

interface Scenario {
  name: string
  probability: number
  description: string
  key_drivers: string[]
}

interface HistoricalContext {
  events_last_30d: number
  events_prior_30d: number
  trend_direction: string
  deadliest_event_type: string
  avg_daily_events: number
}

interface ForecastResponse {
  country_code: string
  country_name: string
  horizon_days: number
  forecast_date: string
  current_risk_level: 'critical' | 'high' | 'elevated' | 'moderate' | 'low'
  predicted_risk_level: 'critical' | 'high' | 'elevated' | 'moderate' | 'low'
  confidence: number
  confidence_label: 'high' | 'moderate' | 'low'
  prediction_summary: string
  signals: Signal[]
  scenarios: Scenario[]
  historical_context: HistoricalContext
  methodology_note: string
  generated_at: string
}

/* ================================================================ */
/*  Utility Functions                                               */
/* ================================================================ */

/**
 * Calculate linear trend over past 60 days
 * Returns slope (events/day) and recent avg
 */
function calculateTrendExtrapolation(dailyCounts: DailyEventCount[]): {
  slope: number
  recentAvg: number
  projectedDaysOut: (days: number) => number
} {
  if (dailyCounts.length === 0) {
    return { slope: 0, recentAvg: 0, projectedDaysOut: () => 0 }
  }

  const recent = dailyCounts.slice(-14) // Last 2 weeks for recent avg
  const recentAvg = recent.length > 0
    ? recent.reduce((s, d) => s + d.count, 0) / recent.length
    : 0

  // Linear regression over all available data
  const n = dailyCounts.length
  if (n < 3) return { slope: 0, recentAvg, projectedDaysOut: () => recentAvg }

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) {
    const x = i
    const y = dailyCounts[i]?.count ?? 0
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

  return {
    slope,
    recentAvg,
    projectedDaysOut: (days: number) => Math.max(0, recentAvg + slope * days),
  }
}

/**
 * Detect severity escalation using rolling 7-day windows
 * Returns strength (0-1) if escalating, negative if de-escalating
 */
function detectSeverityEscalation(dailyCounts: DailyEventCount[]): {
  strength: number
  direction: 'escalating' | 'stable' | 'de-escalating'
} {
  if (dailyCounts.length < 14) {
    return { strength: 0, direction: 'stable' }
  }

  const now = dailyCounts.slice(-7)
  const prior = dailyCounts.slice(-14, -7)

  const nowRatio = now.length > 0
    ? now.reduce((s, d) => s + d.critical_high, 0) / Math.max(1, now.reduce((s, d) => s + d.count, 0))
    : 0

  const priorRatio = prior.length > 0
    ? prior.reduce((s, d) => s + d.critical_high, 0) / Math.max(1, prior.reduce((s, d) => s + d.count, 0))
    : 0

  const change = nowRatio - priorRatio
  const strength = Math.min(1, Math.abs(change) * 2) // Scale to 0-1

  if (change > 0.05) {
    return { strength, direction: 'escalating' }
  } else if (change < -0.05) {
    return { strength, direction: 'de-escalating' }
  }

  return { strength: strength * 0.5, direction: 'stable' }
}

/**
 * Compare current period to same period last year (if available)
 */
function detectSeasonalPattern(dailyCounts: DailyEventCount[]): {
  strength: number
  description: string
} {
  if (dailyCounts.length < 60) {
    return { strength: 0, description: 'Insufficient historical data for seasonal analysis' }
  }

  // Assume we have ~60 days. Compare first 30 to last 30.
  const older = dailyCounts.slice(0, 30)
  const recent = dailyCounts.slice(-30)

  const olderAvg = older.reduce((s, d) => s + d.count, 0) / older.length
  const recentAvg = recent.reduce((s, d) => s + d.count, 0) / recent.length

  const change = Math.abs(recentAvg - olderAvg) / Math.max(1, olderAvg)
  const strength = Math.min(1, change)

  return {
    strength,
    description: recentAvg > olderAvg
      ? 'Event activity increasing compared to earlier period'
      : 'Event activity decreasing compared to earlier period',
  }
}

/**
 * Check if key actors are increasing or decreasing activity
 */
function analyzeActorMomentum(
  currentActors: Record<string, number>,
  priorActors: Record<string, number>,
): {
  strength: number
  direction: 'escalating' | 'stable' | 'de-escalating'
  keyActors: string[]
} {
  const allActors = new Set([...Object.keys(currentActors), ...Object.keys(priorActors)])
  let escalatingCount = 0
  let deEscalatingCount = 0
  const keyActors: string[] = []

  for (const actor of Array.from(allActors)) {
    const curr = currentActors[actor] ?? 0
    const prior = priorActors[actor] ?? 0

    if (curr > prior * 1.3) {
      escalatingCount++
      keyActors.push(actor)
    } else if (curr < prior * 0.7) {
      deEscalatingCount++
    }
  }

  const strength = Math.min(1, Math.max(escalatingCount, deEscalatingCount) / Math.max(1, allActors.size))

  let direction: 'escalating' | 'stable' | 'de-escalating' = 'stable'
  if (escalatingCount > deEscalatingCount * 1.5) {
    direction = 'escalating'
  } else if (deEscalatingCount > escalatingCount * 1.5) {
    direction = 'de-escalating'
  }

  return { strength, direction, keyActors: keyActors.slice(0, 3) }
}

/**
 * Cross-signal convergence: if multiple signals point to escalation, boost confidence
 */
function calculateCrossSignalConvergence(signals: Array<{ strength: number; direction: string }>): number {
  const escalatingCount = signals.filter(s => s.direction === 'escalating').length
  const totalStrength = signals.reduce((s, sig) => s + sig.strength, 0) / Math.max(1, signals.length)

  // If majority of signals escalating, boost confidence
  if (escalatingCount >= signals.length * 0.6) {
    return Math.min(1, totalStrength * 1.2)
  }

  return totalStrength
}

/**
 * Map risk level based on event count/severity
 */
function mapRiskLevel(
  eventCount: number,
  criticalCount: number,
  fatalities: number,
): 'critical' | 'high' | 'elevated' | 'moderate' | 'low' {
  const avgSeverity = eventCount > 0 ? criticalCount / eventCount : 0
  const fatalityScore = fatalities / Math.max(1, eventCount)

  if (fatalities > 500 || (eventCount > 20 && avgSeverity > 0.6)) {
    return 'critical'
  }
  if (fatalities > 100 || (eventCount > 10 && avgSeverity > 0.5)) {
    return 'high'
  }
  if (fatalities > 20 || (eventCount > 5 && avgSeverity > 0.4)) {
    return 'elevated'
  }
  if (eventCount > 2 || avgSeverity > 0.2) {
    return 'moderate'
  }
  return 'low'
}

/* ================================================================ */
/*  Main API Handler                                                */
/* ================================================================ */

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url)
    const countryCode = url.searchParams.get('country_code')?.toUpperCase()
    const horizonStr = url.searchParams.get('horizon') ?? '14'
    const horizon = parseInt(horizonStr, 10)

    // Validate inputs
    if (!countryCode || countryCode.length !== 2) {
      return NextResponse.json(
        { success: false, error: 'country_code parameter required (2-letter ISO code)' },
        { status: 400 },
      )
    }

    const validHorizons = [7, 14, 30]
    const horizonDays = validHorizons.includes(horizon) ? horizon : 14

    // Check cache
    const cacheKey = `forecast:${countryCode}:${horizonDays}`
    const cached = await getCachedSnapshot<ForecastResponse>(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached })
    }

    const supabase = createServiceClient()
    const now = new Date()
    const last60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const prior30d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()

    // Parallel data fetches
    const [eventsRes, priorEventsRes, riskScoreRes] = await Promise.all([
      // Last 60 days for trend analysis
      supabase
        .from('events')
        .select(
          'id, occurred_at, severity, event_type, category, escalation_indicator, significance_score, sentiment_score, casualty_estimate, actor_ids, entities',
        )
        .eq('country_code', countryCode)
        .gte('occurred_at', last60d)
        .order('occurred_at', { ascending: true }),

      // Prior 30-60 days for comparison
      supabase
        .from('events')
        .select('id, occurred_at, severity, event_type, casualty_estimate, escalation_indicator, actor_ids')
        .eq('country_code', countryCode)
        .gte('occurred_at', prior30d)
        .lt('occurred_at', last30d),

      // Current risk score
      supabase
        .from('country_risk_scores')
        .select('country_code, risk_score, trend, event_count_7d, severity_avg')
        .eq('country_code', countryCode)
        .limit(1)
        .single(),
    ])

    const events = eventsRes.data ?? []
    const priorEvents = priorEventsRes.data ?? []
    const riskScore = riskScoreRes.data

    // Build daily aggregates
    const dailyMap = new Map<string, DailyEventCount>()
    for (const e of events) {
      const date = (e.occurred_at ?? '').slice(0, 10)
      if (!date) continue

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          count: 0,
          critical_high: 0,
          escalation_indicators: 0,
          fatalities: 0,
          sentiment_score: 0,
        })
      }

      const d = dailyMap.get(date)!
      d.count++

      const sev = (e.severity as string)?.toLowerCase() ?? 'low'
      if (sev === 'critical' || sev === 'high') d.critical_high++
      if (e.escalation_indicator) d.escalation_indicators++

      const f = e.casualty_estimate as number | null
      if (typeof f === 'number') d.fatalities += f

      const sent = (e.sentiment_score as number) ?? 0
      d.sentiment_score += sent
    }

    const dailyCounts = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // ---- 1. TREND EXTRAPOLATION ----
    const trend = calculateTrendExtrapolation(dailyCounts)
    const projectedCount = trend.projectedDaysOut(horizonDays)

    // ---- 2. SEVERITY ESCALATION ----
    const severityEscalation = detectSeverityEscalation(dailyCounts)

    // ---- 3. SEASONAL PATTERN ----
    const seasonal = detectSeasonalPattern(dailyCounts)

    // ---- 4. ACTOR MOMENTUM ----
    const currentActorMap = new Map<string, number>()
    const priorActorMap = new Map<string, number>()

    for (const e of events.slice(-14)) {
      // Last 14 days
      const actors = (e.actor_ids as string[] | null) ?? []
      for (const a of actors) {
        currentActorMap.set(a, (currentActorMap.get(a) ?? 0) + 1)
      }
    }

    for (const e of priorEvents.slice(0, 14)) {
      // Prior 14 days
      const actors = (e.actor_ids as string[] | null) ?? []
      for (const a of actors) {
        priorActorMap.set(a, (priorActorMap.get(a) ?? 0) + 1)
      }
    }

    const actorMomentum = analyzeActorMomentum(
      Object.fromEntries(currentActorMap),
      Object.fromEntries(priorActorMap),
    )

    // ---- 5. HISTORICAL STATS ----
    const last30dEvents = events.filter(e => (e.occurred_at ?? '') >= last30d)
    const last30dCriticalHigh = last30dEvents.filter(e => {
      const sev = (e.severity as string)?.toLowerCase() ?? 'low'
      return sev === 'critical' || sev === 'high'
    }).length

    const last30dFatalities = last30dEvents.reduce((s, e) => {
      const f = e.casualty_estimate as number | null
      return s + (typeof f === 'number' ? f : 0)
    }, 0)

    const prior30dFatalities = priorEvents.reduce((s, e) => {
      const f = e.casualty_estimate as number | null
      return s + (typeof f === 'number' ? f : 0)
    }, 0)

    // Event type with highest fatalities
    const typeMap = new Map<string, number>()
    for (const e of last30dEvents) {
      const t = (e.event_type as string) ?? 'unknown'
      const f = e.casualty_estimate as number | null
      if (typeof f === 'number') typeMap.set(t, (typeMap.get(t) ?? 0) + f)
    }
    const deathliestType = Array.from(typeMap.entries())
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'unknown'

    const avgDailyEvents = last30dEvents.length / 30

    // ---- 6. BUILD SIGNALS ----
    const signals: Signal[] = [
      {
        signal_type: 'trend_extrapolation',
        direction: trend.slope > 0.5 ? 'escalating' : trend.slope < -0.5 ? 'de-escalating' : 'stable',
        strength: Math.min(1, Math.abs(trend.slope) / Math.max(1, trend.recentAvg)),
        description:
          trend.slope > 0.5
            ? `Events trending upward at ${trend.slope.toFixed(2)} events/day`
            : trend.slope < -0.5
              ? `Events trending downward at ${trend.slope.toFixed(2)} events/day`
              : `Stable event rate averaging ${trend.recentAvg.toFixed(1)} events/day`,
      },
      {
        signal_type: 'severity_escalation',
        direction: severityEscalation.direction,
        strength: severityEscalation.strength,
        description:
          severityEscalation.direction === 'escalating'
            ? 'Ratio of critical/high severity events increasing'
            : severityEscalation.direction === 'de-escalating'
              ? 'Ratio of critical/high severity events decreasing'
              : 'Severity distribution stable',
      },
      {
        signal_type: 'seasonal_pattern',
        direction: seasonal.strength > 0.3 ? 'escalating' : 'stable',
        strength: seasonal.strength,
        description: seasonal.description,
      },
      {
        signal_type: 'actor_momentum',
        direction: actorMomentum.direction,
        strength: actorMomentum.strength,
        description:
          actorMomentum.keyActors.length > 0
            ? `Key actors increasing activity: ${actorMomentum.keyActors.join(', ')}`
            : 'Actor activity levels stable or declining',
      },
    ]

    // ---- 7. CROSS-SIGNAL CONVERGENCE & CONFIDENCE ----
    const baseConfidence = calculateCrossSignalConvergence(signals)
    const escalatingSignals = signals.filter(s => s.direction === 'escalating').length

    // Boost confidence if multiple signals converge
    let confidence = baseConfidence
    if (escalatingSignals >= 3) {
      confidence = Math.min(1, confidence * 1.15)
    }

    const confidenceLabel: 'high' | 'moderate' | 'low' =
      confidence >= 0.75
        ? 'high'
        : confidence >= 0.5
          ? 'moderate'
          : 'low'

    // ---- 8. CURRENT & PREDICTED RISK LEVELS ----
    const currentRiskLevel = mapRiskLevel(last30dEvents.length, last30dCriticalHigh, last30dFatalities)
    const projectedRiskLevel = mapRiskLevel(
      Math.ceil(projectedCount * (horizonDays / 30)),
      Math.ceil((last30dCriticalHigh / last30dEvents.length) * projectedCount * (horizonDays / 30)),
      Math.ceil((last30dFatalities / last30dEvents.length) * projectedCount * (horizonDays / 30)),
    )

    // ---- 9. SCENARIOS ----
    const scenarios: Scenario[] = [
      {
        name: 'escalation',
        probability: escalatingSignals >= 2 ? Math.min(1, 0.4 + escalatingSignals * 0.15) : 0.25,
        description: 'Conflict intensity increases with potential for wider regional involvement.',
        key_drivers: signals.filter(s => s.direction === 'escalating').map(s => s.signal_type),
      },
      {
        name: 'status_quo',
        probability: 0.45,
        description: 'Conflict remains at current levels of intensity without major changes.',
        key_drivers: signals.filter(s => s.direction === 'stable').map(s => s.signal_type),
      },
      {
        name: 'de-escalation',
        probability: signals.filter(s => s.direction === 'de-escalating').length >= 2 ? 0.3 : 0.15,
        description: 'Violence subsides with improved conditions and reduced actor activity.',
        key_drivers: signals.filter(s => s.direction === 'de-escalating').map(s => s.signal_type),
      },
    ]

    // Normalize scenario probabilities
    const totalProb = scenarios.reduce((s, sc) => s + sc.probability, 0)
    for (const sc of scenarios) {
      sc.probability = sc.probability / totalProb
    }

    // ---- 10. PREDICTION SUMMARY ----
    let summaryText = ''
    if (escalatingSignals >= 3 && confidence >= 0.7) {
      summaryText = `Multiple escalation signals detected in ${COUNTRY_CODE_MAP[countryCode] ?? countryCode}. `
      summaryText += `Events trending upward with ${last30dFatalities} casualties in past 30 days. `
      summaryText += `High confidence forecast of increased risk over the next ${horizonDays} days.`
    } else if (escalatingSignals >= 2) {
      summaryText = `Mixed signals suggest moderate escalation risk in ${COUNTRY_CODE_MAP[countryCode] ?? countryCode}. `
      summaryText += `Recent activity shows ${trend.slope > 0 ? 'increasing' : 'stable'} event frequency. `
      summaryText += `Recommend close monitoring over the forecast period.`
    } else {
      summaryText = `${COUNTRY_CODE_MAP[countryCode] ?? countryCode} shows relatively stable conflict patterns. `
      summaryText += `${last30dEvents.length} events recorded in last 30 days with average severity. `
      summaryText += `Escalation risk remains low to moderate unless new actors or triggers emerge.`
    }

    // ---- 11. BUILD RESPONSE ----
    const response: ForecastResponse = {
      country_code: countryCode,
      country_name: COUNTRY_CODE_MAP[countryCode] ?? `Country (${countryCode})`,
      horizon_days: horizonDays,
      forecast_date: now.toISOString(),
      current_risk_level: currentRiskLevel,
      predicted_risk_level: projectedRiskLevel,
      confidence,
      confidence_label: confidenceLabel,
      prediction_summary: summaryText,
      signals,
      scenarios,
      historical_context: {
        events_last_30d: last30dEvents.length,
        events_prior_30d: priorEvents.length,
        trend_direction:
          trend.slope > 0.5
            ? 'escalating'
            : trend.slope < -0.5
              ? 'de-escalating'
              : 'stable',
        deadliest_event_type: deathliestType,
        avg_daily_events: Math.round(avgDailyEvents * 10) / 10,
      },
      methodology_note:
        'Forecast combines trend extrapolation, severity escalation analysis, seasonal patterns, actor momentum, and cross-signal convergence. Confidence reflects signal alignment and data density.',
      generated_at: now.toISOString(),
    }

    // Cache for 1 hour
    await setCachedSnapshot(cacheKey, response, TTL.FORECAST)

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error('[Forecast API Error]', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}
