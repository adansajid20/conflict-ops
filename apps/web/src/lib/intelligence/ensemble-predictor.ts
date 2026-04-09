import { createServiceClient } from '@/lib/supabase/server'
import { calculateAdjustmentFactors } from './prediction-feedback'

export type PredictionDirection = 'escalate' | 'stable' | 'de-escalate'

export type ModelPrediction = {
  probability: number
  predicted_direction: PredictionDirection
  metadata?: Record<string, unknown>
}

export type IndividualModel = {
  model_name: string
  probability: number
  direction: PredictionDirection
  weight: number
}

export type EnsemblePrediction = {
  ensemble_probability: number
  ensemble_direction: PredictionDirection
  confidence: number
  model_agreement: number
  individual_models: IndividualModel[]
  reasoning: string
}

/**
 * Statistical Model: Uses event frequency trends and severity momentum
 */
async function statisticalModel(
  countryCode: string,
  days: number = 30
): Promise<ModelPrediction> {
  const supabase = createServiceClient()

  const now = Date.now()
  const timeWindow = days * 24 * 60 * 60 * 1000
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  const { data: events } = await supabase
    .from('events')
    .select('ingested_at, severity, escalation_indicator')
    .eq('country_code', countryCode)
    .gte('ingested_at', new Date(now - timeWindow).toISOString())

  if (!events || events.length === 0) {
    return {
      probability: 0.3,
      predicted_direction: 'stable',
      metadata: { reason: 'No events found' },
    }
  }

  // Bucket events by day
  const dailyCounts = new Map<string, { count: number; severity_sum: number }>()
  const dailyEscalations = new Map<string, number>()

  for (const event of events) {
    const day = new Date(event.ingested_at as string).toISOString().split('T')[0] || ''
    if (!day) continue
    const entry = dailyCounts.get(day) ?? { count: 0, severity_sum: 0 }
    entry.count += 1
    entry.severity_sum += (event.severity as number) || 1
    dailyCounts.set(day, entry)

    if (event.escalation_indicator) {
      dailyEscalations.set(day, (dailyEscalations.get(day) ?? 0) + 1)
    }
  }

  // Linear regression on daily counts
  const days_sorted = Array.from(dailyCounts.keys()).sort()
  if (days_sorted.length < 2) {
    return {
      probability: 0.35,
      predicted_direction: 'stable',
      metadata: { reason: 'Insufficient data points' },
    }
  }

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0
  const counts = days_sorted.map((d) => dailyCounts.get(d)?.count ?? 0)

  for (let i = 0; i < counts.length; i++) {
    sumX += i
    sumY += counts[i]!
    sumXY += i * counts[i]!
    sumX2 += i * i
  }

  const n = counts.length
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Trend direction from slope
  let frequencyTrend = 0
  if (slope > 0.1) frequencyTrend = 0.3
  else if (slope < -0.1) frequencyTrend = -0.3

  // Severity momentum: 7d weighted average vs 30d baseline
  const recentDays = days_sorted.slice(-7)
  const recentSeverity =
    recentDays.reduce((sum, d) => sum + (dailyCounts.get(d)?.severity_sum ?? 0) / (dailyCounts.get(d)?.count ?? 1), 0) / recentDays.length
  const baselineSeverity =
    days_sorted.reduce((sum, d) => sum + (dailyCounts.get(d)?.severity_sum ?? 0) / (dailyCounts.get(d)?.count ?? 1), 0) / days_sorted.length

  let severityMomentum = 0
  if (recentSeverity > baselineSeverity * 1.2) severityMomentum = 0.25
  else if (recentSeverity < baselineSeverity * 0.8) severityMomentum = -0.25

  // Casualty trajectory (escalation indicator acceleration)
  const recentEscalations = recentDays.reduce((sum, d) => sum + (dailyEscalations.get(d) ?? 0), 0)
  const baselineEscalations = days_sorted.reduce((sum, d) => sum + (dailyEscalations.get(d) ?? 0), 0)
  let casualtyTrend = 0
  if (recentEscalations > baselineEscalations * 0.3 * 1.3) casualtyTrend = 0.2
  else if (recentEscalations < baselineEscalations * 0.3 * 0.7) casualtyTrend = -0.2

  const direction_score = frequencyTrend + severityMomentum + casualtyTrend
  let direction: PredictionDirection = 'stable'
  if (direction_score > 0.3) direction = 'escalate'
  else if (direction_score < -0.3) direction = 'de-escalate'

  const probability = Math.min(0.95, Math.max(0.1, 0.5 + direction_score))

  return {
    probability,
    predicted_direction: direction,
    metadata: {
      frequency_trend: frequencyTrend,
      severity_momentum: severityMomentum,
      casualty_trend: casualtyTrend,
      slope,
      days_analyzed: n,
    },
  }
}

/**
 * Pattern-Based Model: Uses correlation signals and multi-signal convergence
 */
async function patternModel(countryCode: string): Promise<ModelPrediction> {
  const supabase = createServiceClient()

  const { data: signals } = await supabase
    .from('correlation_signals')
    .select('pattern_type, confidence, expires_at')
    .eq('country_code', countryCode)
    .gt('expires_at', new Date().toISOString())

  if (!signals || signals.length === 0) {
    return {
      probability: 0.25,
      predicted_direction: 'stable',
      metadata: { reason: 'No active signals' },
    }
  }

  // Weight by confidence
  let totalConfidence = 0
  let escalationSignals = 0
  let de_escalationSignals = 0

  for (const signal of signals) {
    const conf = (signal.confidence as number) || 0.5
    totalConfidence += conf

    const pattern = (signal.pattern_type as string) || ''
    if (pattern.includes('escalation') || pattern === 'rhetoric_escalation' || pattern === 'escalation_language') {
      escalationSignals += conf
    } else if (pattern === 'long_term_trend' && conf < 0.5) {
      de_escalationSignals += conf
    }
  }

  const avgConfidence = totalConfidence / signals.length

  // Multi-signal convergence: 3+ signals = high risk
  const convergenceBoost = signals.length >= 3 ? 0.2 : signals.length >= 2 ? 0.1 : 0

  // Check for escalation indicators in recent events
  const { data: recentEvents } = await supabase
    .from('events')
    .select('escalation_indicator')
    .eq('country_code', countryCode)
    .gte('occurred_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())

  const escalationRate = recentEvents ? recentEvents.filter((e) => e.escalation_indicator).length / recentEvents.length : 0

  const escalationProb = Math.min(1, (escalationSignals / totalConfidence) * 0.6 + escalationRate * 0.4 + convergenceBoost)
  const de_escalationProb = Math.min(1, de_escalationSignals / totalConfidence)

  let direction: PredictionDirection = 'stable'
  let probability = 0.5
  if (escalationProb > de_escalationProb) {
    direction = 'escalate'
    probability = escalationProb
  } else if (de_escalationProb > escalationProb) {
    direction = 'de-escalate'
    probability = de_escalationProb
  } else {
    probability = avgConfidence
  }

  return {
    probability,
    predicted_direction: direction,
    metadata: {
      signal_count: signals.length,
      escalation_signals: escalationSignals,
      de_escalation_signals: de_escalationSignals,
      avg_confidence: avgConfidence,
      recent_escalation_rate: escalationRate,
    },
  }
}

/**
 * Momentum Model: Uses derivatives of event intensity
 */
async function momentumModel(countryCode: string): Promise<ModelPrediction> {
  const supabase = createServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events } = await supabase
    .from('events')
    .select('ingested_at, severity')
    .eq('country_code', countryCode)
    .gte('ingested_at', thirtyDaysAgo)
    .order('ingested_at', { ascending: true })

  if (!events || events.length < 7) {
    return {
      probability: 0.35,
      predicted_direction: 'stable',
      metadata: { reason: 'Insufficient events for momentum calculation' },
    }
  }

  // Calculate daily counts with exponential moving average (alpha=0.3)
  const dailyCounts = new Map<string, number>()
  const alpha = 0.3

  for (const event of events) {
    const day = new Date(event.ingested_at as string).toISOString().split('T')[0] || ''
    if (!day) continue
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1)
  }

  const days = Array.from(dailyCounts.keys()).sort()
  let ema = dailyCounts.get(days[0] ?? '') ?? 1

  const emaValues: number[] = [ema]
  for (let i = 1; i < days.length; i++) {
    const day = days[i] ?? ''
    const count = dailyCounts.get(day) ?? 0
    ema = alpha * count + (1 - alpha) * ema
    emaValues.push(ema)
  }

  // First derivative (speed): is event rate increasing?
  const recentSpeed = (emaValues[emaValues.length - 1] ?? 0) - (emaValues[Math.max(0, emaValues.length - 8)] ?? 0)
  const speedTrend = recentSpeed > 0.5 ? 0.3 : recentSpeed < -0.5 ? -0.3 : 0

  // Second derivative (acceleration): is the change accelerating?
  const derivativeWindow = Math.min(7, Math.floor(emaValues.length / 2))
  const firstDerivative: number[] = []
  for (let i = 1; i < emaValues.length; i++) {
    firstDerivative.push((emaValues[i] ?? 0) - (emaValues[i - 1] ?? 0))
  }

  const recentAccel = (firstDerivative[firstDerivative.length - 1] ?? 0) - (firstDerivative[Math.max(0, firstDerivative.length - derivativeWindow)] ?? 0)
  const accelTrend = recentAccel > 0.1 ? 0.25 : recentAccel < -0.1 ? -0.25 : 0

  const momentumScore = speedTrend + accelTrend
  let direction: PredictionDirection = 'stable'
  if (momentumScore > 0.3) direction = 'escalate'
  else if (momentumScore < -0.3) direction = 'de-escalate'

  const probability = Math.min(0.9, Math.max(0.2, 0.5 + momentumScore))

  return {
    probability,
    predicted_direction: direction,
    metadata: {
      momentum_score: momentumScore,
      speed_trend: speedTrend,
      acceleration_trend: accelTrend,
      ema_current: ema,
      days_analyzed: days.length,
    },
  }
}

/**
 * Historical Analogue Model: Finds similar historical patterns and predicts outcomes
 */
async function historicalAnalogueModel(countryCode: string): Promise<ModelPrediction> {
  const supabase = createServiceClient()

  const today = new Date()
  const oneEightyDaysAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Get last 30 days of data (current pattern)
  const { data: currentEvents } = await supabase
    .from('events')
    .select('ingested_at, severity')
    .eq('country_code', countryCode)
    .gte('ingested_at', thirtyDaysAgo)
    .order('ingested_at', { ascending: true })

  if (!currentEvents || currentEvents.length === 0) {
    return {
      probability: 0.4,
      predicted_direction: 'stable',
      metadata: { reason: 'No current pattern data' },
    }
  }

  // Create feature vector for current window (daily event counts)
  const currentDailyCounts = new Map<string, number>()
  for (const event of currentEvents) {
    const day = new Date(event.ingested_at as string).toISOString().split('T')[0] || ''
    if (!day) continue
    currentDailyCounts.set(day, (currentDailyCounts.get(day) ?? 0) + 1)
  }

  // Get historical data (180 days ago up to 30 days ago)
  const { data: historicalEvents } = await supabase
    .from('events')
    .select('ingested_at, severity')
    .eq('country_code', countryCode)
    .gte('ingested_at', oneEightyDaysAgo)
    .lt('ingested_at', thirtyDaysAgo)
    .order('ingested_at', { ascending: true })

  if (!historicalEvents || historicalEvents.length === 0) {
    return {
      probability: 0.4,
      predicted_direction: 'stable',
      metadata: { reason: 'No historical pattern data' },
    }
  }

  // Find 30-day windows in historical data that are similar to current
  const similarities: Array<{
    similarity: number
    outcomeScore: number
  }> = []

  const historicalDates = historicalEvents.map((e) => new Date(e.ingested_at as string))
  const minDate = historicalDates[0] ?? new Date()
  const maxDate = historicalDates[historicalDates.length - 1] ?? new Date()

  // Slide a 30-day window through historical data
  const windowMs = 30 * 24 * 60 * 60 * 1000
  const stepMs = 7 * 24 * 60 * 60 * 1000 // Step by 1 week

  for (let ts = minDate?.getTime(); ts < (maxDate?.getTime() ?? 0) - windowMs; ts += stepMs) {
    const windowStart = new Date(ts).toISOString()
    const windowEnd = new Date(ts + windowMs).toISOString()

    const windowEvents = historicalEvents.filter(
      (e) => (e.ingested_at as string) >= windowStart && (e.ingested_at as string) < windowEnd
    )

    if (windowEvents.length === 0) continue

    // Build daily counts for this historical window
    const historicalDailyCounts = new Map<string, number>()
    for (const event of windowEvents) {
      const day = new Date(event.ingested_at as string).toISOString().split('T')[0] || ''
      if (!day) continue
      historicalDailyCounts.set(day, (historicalDailyCounts.get(day) ?? 0) + 1)
    }

    // Cosine similarity between current and historical pattern
    const allDays = new Set([...currentDailyCounts.keys(), ...historicalDailyCounts.keys()])
    let dotProduct = 0,
      normCurrent = 0,
      normHistorical = 0

    for (const day of allDays) {
      const curr = currentDailyCounts.get(day) ?? 0
      const hist = historicalDailyCounts.get(day) ?? 0
      dotProduct += curr * hist
      normCurrent += curr * curr
      normHistorical += hist * hist
    }

    const denominator = Math.sqrt(normCurrent) * Math.sqrt(normHistorical)
    const similarity = denominator > 0 ? dotProduct / denominator : 0

    if (similarity > 0.6) {
      // Check what happened after this historical window
      const afterWindowStart = new Date(ts + windowMs).toISOString()
      const afterWindowEnd = new Date(ts + windowMs + 14 * 24 * 60 * 60 * 1000).toISOString()

      const afterEvents = historicalEvents.filter(
        (e) => (e.ingested_at as string) >= afterWindowStart && (e.ingested_at as string) < afterWindowEnd
      )

      if (afterEvents.length > 0) {
        const afterAvgSeverity = afterEvents.reduce((sum, e) => sum + ((e.severity as number) || 1), 0) / afterEvents.length

        // Outcome score: 1 if escalation, 0 if de-escalation
        const outcomeScore = afterAvgSeverity > 2.5 ? 1 : 0
        similarities.push({ similarity, outcomeScore })
      }
    }
  }

  if (similarities.length === 0) {
    return {
      probability: 0.4,
      predicted_direction: 'stable',
      metadata: { reason: 'No similar historical patterns found' },
    }
  }

  // Weighted average of outcomes (weighted by similarity)
  const totalWeight = similarities.reduce((sum, s) => sum + s.similarity, 0)
  const weightedOutcome = similarities.reduce((sum, s) => sum + s.similarity * s.outcomeScore, 0) / totalWeight

  let direction: PredictionDirection = 'stable'
  if (weightedOutcome > 0.6) direction = 'escalate'
  else if (weightedOutcome < 0.4) direction = 'de-escalate'

  return {
    probability: Math.abs(weightedOutcome - 0.5) + 0.3, // Closer to 0.5 = more uncertainty = lower probability
    predicted_direction: direction,
    metadata: {
      analogue_confidence: Math.max(...similarities.map((s) => s.similarity)),
      patterns_matched: similarities.length,
      weighted_outcome: weightedOutcome,
    },
  }
}

/**
 * Ensemble Combiner: Takes all 4 model outputs and produces final prediction
 */
async function combineEnsemble(
  modelPredictions: Array<{ model: string; prediction: ModelPrediction }>,
  countryCode: string
): Promise<EnsemblePrediction> {
  const weights = {
    statistical: 0.25,
    pattern: 0.3,
    momentum: 0.2,
    historical: 0.25,
  }

  // Calculate weighted ensemble probability
  let ensembleProbability = 0
  let escalateVotes = 0
  let de_escalateVotes = 0
  let stableVotes = 0

  const individual_models: IndividualModel[] = modelPredictions.map(({ model, prediction }) => {
    const weight = weights[model as keyof typeof weights] || 0.25
    ensembleProbability += prediction.probability * weight

    if (prediction.predicted_direction === 'escalate') escalateVotes += weight
    else if (prediction.predicted_direction === 'de-escalate') de_escalateVotes += weight
    else stableVotes += weight

    return {
      model_name: model,
      probability: prediction.probability,
      direction: prediction.predicted_direction,
      weight,
    }
  })

  // Model agreement: how much consensus?
  const modelAgreement =
    escalateVotes > 0.5 || de_escalateVotes > 0.5 || stableVotes > 0.5
      ? Math.max(escalateVotes, de_escalateVotes, stableVotes)
      : Math.min(...[escalateVotes, de_escalateVotes, stableVotes].filter((v) => v > 0))

  // Determine ensemble direction
  let ensemble_direction: PredictionDirection = 'stable'
  if (escalateVotes > de_escalateVotes + 0.1 && escalateVotes > stableVotes + 0.1) {
    ensemble_direction = 'escalate'
  } else if (de_escalateVotes > escalateVotes + 0.1 && de_escalateVotes > stableVotes + 0.1) {
    ensemble_direction = 'de-escalate'
  }

  // Apply calibration priors if available
  try {
    const factors = await calculateAdjustmentFactors()
    const regionFactor = factors.region[countryCode] ?? 1.0
    ensembleProbability *= regionFactor
  } catch (e) {
    // Calibration lookup failed, use raw ensemble probability
  }

  // Confidence: 3+ models agree = high, 2 agree = moderate, otherwise lower
  const voteCounts = [escalateVotes, de_escalateVotes, stableVotes].filter((v) => v > 0.3)
  const agreementCount = voteCounts.filter((v) => v > 0.25).length
  const confidence =
    agreementCount >= 3
      ? Math.min(0.9, modelAgreement + 0.3)
      : agreementCount === 2
        ? Math.min(0.7, modelAgreement + 0.1)
        : Math.min(0.5, modelAgreement)

  // Build reasoning
  const modelTexts = modelPredictions.map(({ model, prediction }) => {
    const dirLabel =
      prediction.predicted_direction === 'escalate'
        ? 'escalation'
        : prediction.predicted_direction === 'de-escalate'
          ? 'de-escalation'
          : 'stability'
    return `${model} model predicts ${dirLabel} (${(prediction.probability * 100).toFixed(0)}%)`
  })

  const reasoning =
    `Ensemble prediction for ${countryCode}: ${ensemble_direction}. ` +
    `${modelTexts.join('; ')}. ` +
    `Model agreement: ${(modelAgreement * 100).toFixed(0)}%. ` +
    `Confidence: ${(confidence * 100).toFixed(0)}%.`

  return {
    ensemble_probability: Math.min(0.95, Math.max(0.05, ensembleProbability)),
    ensemble_direction,
    confidence,
    model_agreement: modelAgreement,
    individual_models,
    reasoning,
  }
}

/**
 * Main ensemble prediction function
 */
export async function generateEnsemblePrediction(
  countryCode: string,
  horizon: 7 | 14 | 30 = 14
): Promise<EnsemblePrediction> {
  try {
    const [statistical, pattern, momentum, historical] = await Promise.all([
      statisticalModel(countryCode, horizon),
      patternModel(countryCode),
      momentumModel(countryCode),
      historicalAnalogueModel(countryCode),
    ])

    const modelPredictions = [
      { model: 'statistical', prediction: statistical },
      { model: 'pattern', prediction: pattern },
      { model: 'momentum', prediction: momentum },
      { model: 'historical', prediction: historical },
    ]

    return combineEnsemble(modelPredictions, countryCode)
  } catch (error) {
    console.error('[ensemble-predictor] Error generating ensemble prediction:', error)

    return {
      ensemble_probability: 0.5,
      ensemble_direction: 'stable',
      confidence: 0.1,
      model_agreement: 0,
      individual_models: [],
      reasoning: `Error generating ensemble prediction: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
