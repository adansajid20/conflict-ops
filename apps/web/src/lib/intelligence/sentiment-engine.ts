import { createServiceClient } from '@/lib/supabase/server'

type EventRow = {
  sentiment_score: number | null
  occurred_at: string
  title: string
  description: string | null
  country_code: string
}

type RhetoricAnalysis = {
  country_code: string
  baseline_sentiment: number
  recent_sentiment: number
  sentiment_shift: number
  std_dev: number
  rolling_avg_7d: number
  is_significant_negative_shift: boolean
  shift_magnitude: 'minimal' | 'moderate' | 'significant' | 'critical'
}

type EscalationLanguageResult = {
  country_code: string
  escalation_language_score: number
  category_scores: {
    military_mobilization: number
    diplomatic_breakdown: number
    weapons_escalation: number
    humanitarian_crisis: number
  }
  detected_keywords: string[]
  sample_events: Array<{ title: string; matches: string[] }>
}

type ToneShiftSignal = {
  pattern_type: 'rhetoric_escalation'
  country_code: string
  confidence: number
  description: string
  shift_magnitude: string
  baseline_sentiment: number
  recent_sentiment: number
  change_percentage: number
  detected_at: string
  expires_at: string
}

// Keywords organized by escalation category
const ESCALATION_KEYWORDS = {
  military_mobilization: [
    'deployment',
    'mobilization',
    'reinforcement',
    'buildup',
    'troops',
    'battalions',
    'brigades',
    'divisions',
    'military exercise',
    'military maneuver',
    'troop movement',
    'arms shipment',
    'military aid',
    'weapons delivery',
  ],
  diplomatic_breakdown: [
    'ultimatum',
    'recall ambassador',
    'severed ties',
    'sanctions',
    'embargo',
    'expelled',
    'diplomatic crisis',
    'negotiations collapsed',
    'diplomatic isolation',
    'tension escalates',
    'provocation',
    'violation',
    'aggression',
  ],
  weapons_escalation: [
    'nuclear',
    'chemical',
    'ballistic',
    'hypersonic',
    'icbm',
    'warhead',
    'missile test',
    'weapons test',
    'atomic',
    'thermonuclear',
    'drone strike',
    'air strike',
    'artillery strike',
  ],
  humanitarian_crisis: [
    'famine',
    'genocide',
    'ethnic cleansing',
    'mass displacement',
    'refugee crisis',
    'humanitarian disaster',
    'mass casualties',
    'civilian deaths',
    'forced migration',
    'starvation',
    'cholera',
    'disease outbreak',
    'humanitarian emergency',
  ],
}

export async function analyzeRhetoricShift(
  countryCode: string
): Promise<RhetoricAnalysis | null> {
  const supabase = createServiceClient()

  // Get 30-day baseline and recent 7-day sentiment
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: events, error } = await supabase
    .from('events')
    .select('sentiment_score, occurred_at')
    .eq('country_code', countryCode)
    .gte('occurred_at', thirtyDaysAgo)
    .not('sentiment_score', 'is', null)
    .order('occurred_at', { ascending: true })

  if (error || !events || events.length === 0) return null

  const eventRows = events as EventRow[]

  // Calculate baseline (first 20 days)
  const baselineEvents = eventRows.filter(
    (e) => new Date(e.occurred_at).getTime() < new Date(sevenDaysAgo).getTime()
  )
  const recentEvents = eventRows.filter(
    (e) => new Date(e.occurred_at).getTime() >= new Date(sevenDaysAgo).getTime()
  )

  if (baselineEvents.length === 0 || recentEvents.length === 0) return null

  const baselineSentiment =
    baselineEvents.reduce((sum, e) => sum + (e.sentiment_score || 0), 0) /
    baselineEvents.length
  const recentSentiment =
    recentEvents.reduce((sum, e) => sum + (e.sentiment_score || 0), 0) /
    recentEvents.length

  // Calculate rolling 7-day average
  const rolling7d =
    recentEvents.reduce((sum, e) => sum + (e.sentiment_score || 0), 0) /
    Math.max(recentEvents.length, 1)

  // Calculate standard deviation of baseline
  const meanBaseline = baselineSentiment
  const variance =
    baselineEvents.reduce(
      (sum, e) => sum + Math.pow((e.sentiment_score || 0) - meanBaseline, 2),
      0
    ) / baselineEvents.length
  const stdDev = Math.sqrt(variance)

  const sentimentShift = recentSentiment - baselineSentiment
  const isSignificantShift = sentimentShift < -stdDev
  const shiftMagnitude =
    sentimentShift <= -2 * stdDev
      ? 'critical'
      : sentimentShift <= -1.5 * stdDev
        ? 'significant'
        : sentimentShift <= -stdDev
          ? 'moderate'
          : 'minimal'

  return {
    country_code: countryCode,
    baseline_sentiment: Number(baselineSentiment.toFixed(3)),
    recent_sentiment: Number(recentSentiment.toFixed(3)),
    sentiment_shift: Number(sentimentShift.toFixed(3)),
    std_dev: Number(stdDev.toFixed(3)),
    rolling_avg_7d: Number(rolling7d.toFixed(3)),
    is_significant_negative_shift: isSignificantShift,
    shift_magnitude: shiftMagnitude as 'minimal' | 'moderate' | 'significant' | 'critical',
  }
}

export async function detectEscalationLanguage(
  countryCode: string,
  lookbackDays: number = 14
): Promise<EscalationLanguageResult> {
  const supabase = createServiceClient()

  const lookbackDate = new Date(
    Date.now() - lookbackDays * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: events, error } = await supabase
    .from('events')
    .select('title, description')
    .eq('country_code', countryCode)
    .gte('occurred_at', lookbackDate)

  if (error || !events) {
    return {
      country_code: countryCode,
      escalation_language_score: 0,
      category_scores: {
        military_mobilization: 0,
        diplomatic_breakdown: 0,
        weapons_escalation: 0,
        humanitarian_crisis: 0,
      },
      detected_keywords: [],
      sample_events: [],
    }
  }

  const eventRows = events as EventRow[]
  const categoryScores: Record<string, number> = {
    military_mobilization: 0,
    diplomatic_breakdown: 0,
    weapons_escalation: 0,
    humanitarian_crisis: 0,
  }
  const detectedKeywords = new Set<string>()
  const keywordMatches = new Map<string, string[]>()

  for (const event of eventRows) {
    const text = `${event.title || ''} ${event.description || ''}`.toLowerCase()

    for (const [category, keywords] of Object.entries(ESCALATION_KEYWORDS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          detectedKeywords.add(keyword)
          categoryScores[category] = (categoryScores[category] || 0) + 1
          if (!keywordMatches.has(event.title || 'unknown')) {
            keywordMatches.set(event.title || 'unknown', [])
          }
          keywordMatches.get(event.title || 'unknown')!.push(keyword)
        }
      }
    }
  }

  // Normalize scores to 0-100
  const maxScore = Math.max(...Object.values(categoryScores), 1)
  const normalizedScores: Record<string, number> = {
    military_mobilization: 0,
    diplomatic_breakdown: 0,
    weapons_escalation: 0,
    humanitarian_crisis: 0,
  }

  for (const [k, v] of Object.entries(categoryScores)) {
    if (k in normalizedScores) {
      normalizedScores[k] = Math.round((v / maxScore) * 100)
    }
  }

  // Calculate overall escalation score as weighted average
  const overallScore =
    ((normalizedScores['military_mobilization'] ?? 0) * 0.35 +
      (normalizedScores['diplomatic_breakdown'] ?? 0) * 0.25 +
      (normalizedScores['weapons_escalation'] ?? 0) * 0.3 +
      (normalizedScores['humanitarian_crisis'] ?? 0) * 0.1) /
    100

  const sampleEvents = Array.from(keywordMatches.entries())
    .slice(0, 3)
    .map(([title, matches]) => ({ title, matches: [...matches] }))

  return {
    country_code: countryCode,
    escalation_language_score: Math.round(overallScore * 100),
    category_scores: {
      military_mobilization: normalizedScores['military_mobilization'] ?? 0,
      diplomatic_breakdown: normalizedScores['diplomatic_breakdown'] ?? 0,
      weapons_escalation: normalizedScores['weapons_escalation'] ?? 0,
      humanitarian_crisis: normalizedScores['humanitarian_crisis'] ?? 0,
    },
    detected_keywords: Array.from(detectedKeywords),
    sample_events: sampleEvents,
  }
}

export async function generateToneShiftSignal(
  rhetoric: RhetoricAnalysis,
  escalationLanguage: EscalationLanguageResult
): Promise<ToneShiftSignal | null> {
  if (
    !rhetoric.is_significant_negative_shift ||
    escalationLanguage.escalation_language_score < 30
  ) {
    return null
  }

  // Confidence based on magnitude of shift and language escalation
  const shiftConfidence =
    Math.abs(rhetoric.sentiment_shift) / Math.max(rhetoric.std_dev, 0.1)
  const languageConfidence =
    escalationLanguage.escalation_language_score / 100
  const confidence = Math.min(
    0.99,
    (shiftConfidence * 0.6 + languageConfidence * 0.4) / 2
  )

  const changePercentage = (rhetoric.sentiment_shift / Math.max(Math.abs(rhetoric.baseline_sentiment), 0.01)) * 100

  const description = `
Rhetoric shift detected in ${rhetoric.country_code}: sentiment declined from ${rhetoric.baseline_sentiment.toFixed(2)} to ${rhetoric.recent_sentiment.toFixed(2)}
(${Math.abs(rhetoric.sentiment_shift).toFixed(2)} point change, ${rhetoric.shift_magnitude}).
Escalation language score: ${escalationLanguage.escalation_language_score}/100, with detected keywords in
${Object.entries(escalationLanguage.category_scores)
  .filter(([, score]) => score > 0)
  .map(([cat]) => cat.replace(/_/g, ' '))
  .join(', ')}.`.trim()

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  return {
    pattern_type: 'rhetoric_escalation',
    country_code: rhetoric.country_code,
    confidence: Number(confidence.toFixed(2)),
    description,
    shift_magnitude: rhetoric.shift_magnitude,
    baseline_sentiment: rhetoric.baseline_sentiment,
    recent_sentiment: rhetoric.recent_sentiment,
    change_percentage: Number(changePercentage.toFixed(1)),
    detected_at: new Date().toISOString(),
    expires_at: expiresAt,
  }
}

export async function storeCorrelationSignal(signal: ToneShiftSignal): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase.from('correlation_signals').upsert({
    country_code: signal.country_code,
    pattern_type: signal.pattern_type,
    confidence: signal.confidence,
    description: signal.description,
    detected_at: signal.detected_at,
    expires_at: signal.expires_at,
    metadata: {
      shift_magnitude: signal.shift_magnitude,
      baseline_sentiment: signal.baseline_sentiment,
      recent_sentiment: signal.recent_sentiment,
      change_percentage: signal.change_percentage,
    },
  })

  return !error
}

export async function processSentimentAnalysis(): Promise<{
  processed: number
  signals_created: number
}> {
  const supabase = createServiceClient()

  // Get top 30 active countries in the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activeCountries, error: countriesError } = await supabase.rpc(
    'get_top_active_countries',
    { days: 30, limit: 30 }
  )

  if (countriesError || !activeCountries) {
    return { processed: 0, signals_created: 0 }
  }

  const countryList = (activeCountries as Array<{ country_code: string }>).map(
    (c) => c.country_code
  )

  let processed = 0
  let signalsCreated = 0

  for (const countryCode of countryList) {
    const rhetoric = await analyzeRhetoricShift(countryCode)
    if (!rhetoric) continue

    const escalationLanguage = await detectEscalationLanguage(countryCode)
    const signal = await generateToneShiftSignal(rhetoric, escalationLanguage)

    if (signal) {
      const stored = await storeCorrelationSignal(signal)
      if (stored) signalsCreated++
    }

    processed++
  }

  return { processed, signals_created: signalsCreated }
}
