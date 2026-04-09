import { createServiceClient } from '@/lib/supabase/server'

type EventAggregate = {
  event_count: number
  severity_avg: number
  casualty_total: number
}

type TrendData = {
  slope: number
  intercept: number
  r_squared: number
}

type LongTermTrend = {
  slope: number
  direction: 'escalating' | 'stable' | 'de-escalating'
  confidence: number
  event_count_90d: number
  severity_trend_90d: number
  casualty_trend_90d: number
}

type CyclicalContext = {
  is_seasonal: boolean
  deviation_from_cycle: number
  historical_pattern: string
  quarter_comparison: {
    current_30d: number
    prior_year_same_period: number
    difference_pct: number
  }
}

type PrecursorEvent = {
  type: string
  detected_at: string
  expected_follow_on: string
  timeline_days: number
  confidence: number
}

type StrategicAssessment = {
  country_code: string
  phase: 'escalation' | 'peak' | 'de-escalation' | 'dormant'
  long_term_trend: LongTermTrend
  cyclical_context: CyclicalContext
  active_precursors: PrecursorEvent[]
  strategic_risk_level: number
  forecast_note: string
}

// Known precursor patterns: lead_event_type -> [follow_on_type, follow_on_type, ...]
// with timeline in days
const PRECURSOR_PATTERNS: Record<
  string,
  {
    follow_on: string[]
    timeline_days: [number, number]
    confidence: number
  }
> = {
  diplomatic_recall: {
    follow_on: ['military_mobilization', 'border_incident', 'military_exercise'],
    timeline_days: [7, 14],
    confidence: 0.75,
  },
  sanctions_announcement: {
    follow_on: ['economic_protest', 'civil_unrest', 'counteractions'],
    timeline_days: [7, 28],
    confidence: 0.65,
  },
  election_results: {
    follow_on: ['civil_unrest', 'protest', 'civil_violence'],
    timeline_days: [0, 7],
    confidence: 0.7,
  },
  military_exercise: {
    follow_on: ['border_incident', 'provocation', 'military_engagement'],
    timeline_days: [7, 21],
    confidence: 0.6,
  },
  humanitarian_corridor_closure: {
    follow_on: ['civilian_casualties', 'humanitarian_crisis', 'mass_displacement'],
    timeline_days: [0, 3],
    confidence: 0.8,
  },
  weapons_shipment: {
    follow_on: ['military_escalation', 'armed_clash', 'organized_violence'],
    timeline_days: [3, 30],
    confidence: 0.7,
  },
}

function linearRegression(points: Array<[number, number]>): TrendData {
  if (points.length < 2) return { slope: 0, intercept: 0, r_squared: 0 }

  const n = points.length
  const sumX = points.reduce((s, [x]) => s + x, 0)
  const sumY = points.reduce((s, [, y]) => s + y, 0)
  const sumXY = points.reduce((s, [x, y]) => s + x * y, 0)
  const sumX2 = points.reduce((s, [x]) => s + x * x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R-squared
  const yMean = sumY / n
  const ssRes = points.reduce((s, [x, y]) => s + Math.pow(y - (slope * x + intercept), 2), 0)
  const ssTot = points.reduce((s, [, y]) => s + Math.pow(y - yMean, 2), 0)
  const r_squared = 1 - ssRes / (ssTot || 1)

  return { slope, intercept, r_squared }
}

export async function analyzeLongTermTrend(
  countryCode: string
): Promise<LongTermTrend | null> {
  const supabase = createServiceClient()

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: events, error } = await supabase
    .from('events')
    .select('occurred_at, severity, casualty_estimate')
    .eq('country_code', countryCode)
    .gte('occurred_at', ninetyDaysAgo)
    .order('occurred_at', { ascending: true })

  if (error || !events || events.length < 10) return null

  // Group by day and aggregate
  const dailyAggregates = new Map<string, EventAggregate>()

  for (const event of events as Array<{
    occurred_at: string
    severity: number
    casualty_estimate: number | null
  }>) {
    const date = new Date(event.occurred_at).toISOString().split('T')[0] || ''
    if (!date) continue
    const existing = dailyAggregates.get(date) || {
      event_count: 0,
      severity_avg: 0,
      casualty_total: 0,
    }
    existing.event_count += 1
    existing.severity_avg += event.severity
    existing.casualty_total += event.casualty_estimate || 0
    dailyAggregates.set(date, existing)
  }

  const aggregates = Array.from(dailyAggregates.values()).map((agg) => ({
    ...agg,
    severity_avg: agg.severity_avg / agg.event_count,
  }))

  if (aggregates.length < 10) return null

  // Create time series for linear regression
  // X = days since start, Y = daily event count
  const eventPoints = aggregates.map((agg, idx) => [idx, agg.event_count] as [number, number])
  const severityPoints = aggregates.map((agg, idx) => [idx, agg.severity_avg] as [number, number])
  const casualtyPoints = aggregates.map((agg, idx) => [idx, agg.casualty_total] as [number, number])

  const eventTrend = linearRegression(eventPoints)
  const severityTrend = linearRegression(severityPoints)
  const casualtyTrend = linearRegression(casualtyPoints)

  // Determine direction
  const direction =
    eventTrend.slope > 0.5
      ? 'escalating'
      : eventTrend.slope < -0.5
        ? 'de-escalating'
        : 'stable'

  // Confidence based on R-squared (fit quality)
  const confidence = Math.max(eventTrend.r_squared, severityTrend.r_squared)

  return {
    slope: Number(eventTrend.slope.toFixed(3)),
    direction,
    confidence: Number(confidence.toFixed(2)),
    event_count_90d: events.length,
    severity_trend_90d: Number(severityTrend.slope.toFixed(3)),
    casualty_trend_90d: Number(casualtyTrend.slope.toFixed(1)),
  }
}

export async function findCyclicalPatterns(
  countryCode: string
): Promise<CyclicalContext | null> {
  const supabase = createServiceClient()

  // Get current 30-day window
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: current30d } = await supabase
    .from('events')
    .select('occurred_at, severity')
    .eq('country_code', countryCode)
    .gte('occurred_at', thirtyDaysAgo)

  if (!current30d || current30d.length === 0) return null

  const currentCount = current30d.length
  const currentSeverityAvg =
    current30d.reduce((sum, e) => sum + ((e as any).severity || 1), 0) / current30d.length

  // Get same calendar period from one year ago (rough estimate)
  const oneYearTwoMonthsAgo = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000 - 30 * 24 * 60 * 60 * 1000
  ).toISOString()
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  const { data: priorYear } = await supabase
    .from('events')
    .select('occurred_at, severity')
    .eq('country_code', countryCode)
    .gte('occurred_at', oneYearTwoMonthsAgo)
    .lt('occurred_at', oneYearAgo)

  if (!priorYear || priorYear.length === 0) {
    // Not enough historical data
    return {
      is_seasonal: false,
      deviation_from_cycle: 0,
      historical_pattern: 'insufficient_data',
      quarter_comparison: {
        current_30d: currentCount,
        prior_year_same_period: 0,
        difference_pct: 0,
      },
    }
  }

  const priorCount = priorYear.length
  const priorSeverityAvg =
    priorYear.reduce((sum, e) => sum + ((e as any).severity || 1), 0) / priorYear.length

  // Calculate deviation
  const countDifference = ((currentCount - priorCount) / Math.max(priorCount, 1)) * 100
  const severityDifference = currentSeverityAvg - priorSeverityAvg

  // Determine if there's a seasonal pattern (>30% variance is significant)
  const isSeasonal = Math.abs(countDifference) > 30
  const pattern =
    countDifference > 30
      ? 'seasonal_uptick'
      : countDifference < -30
        ? 'seasonal_downtick'
        : 'stable_seasonal'

  return {
    is_seasonal: isSeasonal,
    deviation_from_cycle: Number(countDifference.toFixed(1)),
    historical_pattern: pattern,
    quarter_comparison: {
      current_30d: currentCount,
      prior_year_same_period: priorCount,
      difference_pct: Number(countDifference.toFixed(1)),
    },
  }
}

export async function detectActivePrecursors(
  countryCode: string
): Promise<PrecursorEvent[]> {
  const supabase = createServiceClient()

  const precursors: PrecursorEvent[] = []
  const now = Date.now()

  // Check for each known precursor pattern
  for (const [precursorType, pattern] of Object.entries(PRECURSOR_PATTERNS)) {
    // Look for precursor events in the last 90 days
    const lookbackMs = 90 * 24 * 60 * 60 * 1000
    const lookbackDate = new Date(now - lookbackMs).toISOString()

    // This is a simplified check - in production you'd want event_type field
    // For now, we'll search in event titles/descriptions
    const { data: potentialPrecursors } = await supabase
      .from('events')
      .select('occurred_at, title, description')
      .eq('country_code', countryCode)
      .gte('occurred_at', lookbackDate)
      .order('occurred_at', { ascending: false })
      .limit(50)

    if (!potentialPrecursors) continue

    for (const event of potentialPrecursors as Array<{
      occurred_at: string
      title: string
      description: string | null
    }>) {
      const text = `${event.title} ${event.description || ''}`.toLowerCase()

      // Check if this event matches the precursor type
      if (text.includes(precursorType.replace(/_/g, ' ').toLowerCase())) {
        const eventTime = new Date(event.occurred_at).getTime()
        const daysSinceEvent = (now - eventTime) / (24 * 60 * 60 * 1000)

        // Only include if within recent timeframe and we haven't seen follow-ons yet
        if (daysSinceEvent <= pattern.timeline_days[1]) {
          precursors.push({
            type: precursorType,
            detected_at: event.occurred_at,
            expected_follow_on: pattern.follow_on.join(' or '),
            timeline_days: pattern.timeline_days[1],
            confidence: pattern.confidence,
          })
          // Only add once per precursor type
          break
        }
      }
    }
  }

  return precursors
}

export async function aggregateStrategicContext(
  countryCode: string
): Promise<StrategicAssessment> {
  const longTermTrend =
    (await analyzeLongTermTrend(countryCode)) ||
    ({
      slope: 0,
      direction: 'stable',
      confidence: 0,
      event_count_90d: 0,
      severity_trend_90d: 0,
      casualty_trend_90d: 0,
    } as LongTermTrend)

  const cyclicalContext =
    (await findCyclicalPatterns(countryCode)) ||
    ({
      is_seasonal: false,
      deviation_from_cycle: 0,
      historical_pattern: 'unknown',
      quarter_comparison: { current_30d: 0, prior_year_same_period: 0, difference_pct: 0 },
    } as CyclicalContext)

  const activePrecursors = await detectActivePrecursors(countryCode)

  // Determine phase based on trend and current state
  let phase: 'escalation' | 'peak' | 'de-escalation' | 'dormant'
  if (longTermTrend.direction === 'escalating' && longTermTrend.slope > 1) {
    phase = 'escalation'
  } else if (longTermTrend.direction === 'de-escalating') {
    phase = 'de-escalation'
  } else if (longTermTrend.event_count_90d > 50) {
    phase = 'peak'
  } else {
    phase = 'dormant'
  }

  // Calculate strategic risk level (0-100)
  const trendRisk = longTermTrend.direction === 'escalating' ? 40 : longTermTrend.direction === 'de-escalating' ? 10 : 25
  const precursorRisk = Math.min(activePrecursors.length * 15, 40)
  const cyclicalRisk = cyclicalContext.is_seasonal ? 10 : 0
  const strategicRiskLevel = Math.round(trendRisk + precursorRisk + cyclicalRisk)

  // Generate forecast note
  const forecastNote = generateForecastNote(
    countryCode,
    phase,
    longTermTrend,
    cyclicalContext,
    activePrecursors,
    strategicRiskLevel
  )

  return {
    country_code: countryCode,
    phase,
    long_term_trend: longTermTrend,
    cyclical_context: cyclicalContext,
    active_precursors: activePrecursors,
    strategic_risk_level: strategicRiskLevel,
    forecast_note: forecastNote,
  }
}

function generateForecastNote(
  countryCode: string,
  phase: string,
  trend: LongTermTrend,
  cyclical: CyclicalContext,
  precursors: PrecursorEvent[],
  riskLevel: number
): string {
  const parts: string[] = []

  if (phase === 'escalation') {
    parts.push(`${countryCode} is in escalation phase with ${trend.event_count_90d} events over 90 days.`)
  } else if (phase === 'peak') {
    parts.push(`${countryCode} is at peak activity levels with sustained high event frequency.`)
  } else if (phase === 'de-escalation') {
    parts.push(`${countryCode} shows de-escalation trend over the past 90 days.`)
  } else {
    parts.push(`${countryCode} is in a dormant phase with low activity.`)
  }

  if (precursors.length > 0) {
    parts.push(`${precursors.length} active precursor event(s) detected: ${precursors.map((p) => p.type).join(', ')}.`)
  }

  if (cyclical.is_seasonal) {
    const direction = cyclical.deviation_from_cycle > 0 ? 'above' : 'below'
    parts.push(`Current activity is ${Math.abs(cyclical.deviation_from_cycle).toFixed(0)}% ${direction} seasonal baseline.`)
  }

  return parts.slice(0, 2).join(' ')
}

export async function storeStrategicAssessment(
  assessment: StrategicAssessment
): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase.from('strategic_assessments').upsert({
    country_code: assessment.country_code,
    phase: assessment.phase,
    long_term_trend: assessment.long_term_trend,
    cyclical_context: assessment.cyclical_context,
    active_precursors: assessment.active_precursors,
    strategic_risk_level: assessment.strategic_risk_level,
    forecast_note: assessment.forecast_note,
    updated_at: new Date().toISOString(),
  })

  return !error
}
