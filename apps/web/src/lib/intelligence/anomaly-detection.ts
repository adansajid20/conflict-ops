import { createServiceClient } from '@/lib/supabase/server'

export type BaselineMetrics = {
  country: string
  mean_daily_events: number
  std_dev_events: number
  mean_severity: number
  seasonal_factor: number
}

export type AnomalyDetection = {
  country: string
  date: string
  event_count: number
  z_score: number
  severity: number
  anomaly_level: 'none' | 'moderate' | 'significant' | 'extreme'
}

export type ChangePoint = {
  country: string
  detected_at: string
  cusum_score: number
  baseline_rate: number
  current_rate: number
  shift_magnitude: number
}

/**
 * Calculate baseline metrics for a country:
 * - Mean daily event count (90-day rolling)
 * - Standard deviation
 * - Mean severity (weighted)
 * - Seasonal adjustment factor (same week last quarter vs 3-month average)
 */
export async function calculateCountryBaseline(country: string): Promise<BaselineMetrics> {
  const supabase = createServiceClient()

  // Get 90 days of events
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data: events, error } = await supabase
    .from('events')
    .select('occurred_at, severity')
    .eq('country_code', country)
    .gte('occurred_at', since90d)
    .order('occurred_at')

  if (error || !events || events.length === 0) {
    return {
      country,
      mean_daily_events: 0,
      std_dev_events: 0,
      mean_severity: 0,
      seasonal_factor: 1.0,
    }
  }

  // Group events by day
  const dailyCountsObj: Record<string, { count: number; totalSeverity: number }> = {}
  for (const evt of events) {
    const date = new Date(evt.occurred_at as string).toISOString().split('T')[0] || ''
    if (!date) continue
    const entry = dailyCountsObj[date] ?? { count: 0, totalSeverity: 0 }
    entry.count++
    entry.totalSeverity += (evt.severity as number) ?? 1
    dailyCountsObj[date] = entry
  }

  // Calculate mean and std dev of daily event counts
  const counts = Object.keys(dailyCountsObj).map(date => dailyCountsObj[date]!.count)
  const mean = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
  const variance = counts.length > 1 ? counts.reduce((acc, c) => acc + Math.pow(c - mean, 2), 0) / (counts.length - 1) : 0
  const std_dev = Math.sqrt(variance)

  // Calculate mean severity
  const severities = Object.keys(dailyCountsObj).map(
    date => (dailyCountsObj[date]!.totalSeverity / dailyCountsObj[date]!.count) * dailyCountsObj[date]!.count // weighted average per day
  )
  const mean_severity = severities.length > 0 ? severities.reduce((a, b) => a + b, 0) / severities.length : 0

  // Seasonal adjustment: compare current week to same week 3 months ago
  const today = new Date()
  const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
  const weekNumber = Math.floor((today.getTime() - threeMonthsAgo.getTime()) / (7 * 24 * 60 * 60 * 1000))
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - today.getDay())

  // Find same week last quarter
  const lastQuarterDate = new Date(today)
  lastQuarterDate.setDate(lastQuarterDate.getDate() - 90)
  lastQuarterDate.setDate(lastQuarterDate.getDate() - lastQuarterDate.getDay()) // align to week start

  const lastQuarterIsoStart = lastQuarterDate.toISOString().split('T')[0] || ''
  const lastQuarterIsoEnd = new Date(lastQuarterDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || ''
  const currentWeekIsoStart = currentWeekStart.toISOString().split('T')[0] || ''
  const currentWeekIsoEnd = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || ''

  const lastQuarterWeekCount = Object.keys(dailyCountsObj)
    .filter(date => date >= lastQuarterIsoStart && date <= lastQuarterIsoEnd)
    .reduce((sum, date) => sum + (dailyCountsObj[date]?.count ?? 0), 0)

  const currentWeekCount = Object.keys(dailyCountsObj)
    .filter(date => date >= currentWeekIsoStart && date <= currentWeekIsoEnd)
    .reduce((sum, date) => sum + (dailyCountsObj[date]?.count ?? 0), 0)

  const seasonal_factor = lastQuarterWeekCount > 0 ? currentWeekCount / lastQuarterWeekCount : 1.0

  return {
    country,
    mean_daily_events: mean,
    std_dev_events: std_dev,
    mean_severity,
    seasonal_factor: Math.max(0.5, Math.min(2.0, seasonal_factor)), // Clamp to reasonable range
  }
}

/**
 * Detect anomalies for a given country on a specific day using z-score
 * z > 2.0 = moderate, z > 3.0 = significant, z > 4.0 = extreme
 */
export async function detectAnomaliesForCountry(country: string, date?: string): Promise<AnomalyDetection | null> {
  const supabase = createServiceClient()
  const targetDate = date ?? (new Date().toISOString().split('T')[0] || '')
  const dateStart = `${targetDate}T00:00:00Z`
  const dateEnd = `${targetDate}T23:59:59Z`

  const baseline = await calculateCountryBaseline(country)

  // Get events for the target date
  const { data: dayEvents, error } = await supabase
    .from('events')
    .select('severity')
    .eq('country_code', country)
    .gte('occurred_at', dateStart)
    .lte('occurred_at', dateEnd)

  if (error) return null

  const count = dayEvents?.length ?? 0
  const severity = dayEvents && dayEvents.length > 0
    ? dayEvents.reduce((sum, e) => sum + (e.severity as number || 1), 0) / dayEvents.length
    : 0

  // Z-score calculation
  let z_score = 0
  if (baseline.std_dev_events > 0) {
    z_score = (count - baseline.mean_daily_events) / baseline.std_dev_events
  } else if (count > baseline.mean_daily_events) {
    z_score = 2.0 // moderate if we have high variance
  }

  // Determine anomaly level
  let anomaly_level: 'none' | 'moderate' | 'significant' | 'extreme' = 'none'
  if (z_score > 4.0) anomaly_level = 'extreme'
  else if (z_score > 3.0) anomaly_level = 'significant'
  else if (z_score > 2.0) anomaly_level = 'moderate'

  if (anomaly_level === 'none') return null

  return {
    country,
    date: targetDate,
    event_count: count,
    z_score,
    severity,
    anomaly_level,
  }
}

/**
 * CUSUM (Cumulative Sum Control Chart) algorithm for changepoint detection
 * Detects when a country's event rate shifts persistently, not just a spike
 */
export async function detectChangepoint(country: string, window_days: number = 30): Promise<ChangePoint | null> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - window_days * 24 * 60 * 60 * 1000).toISOString()

  const { data: events, error } = await supabase
    .from('events')
    .select('occurred_at')
    .eq('country_code', country)
    .gte('occurred_at', since)
    .order('occurred_at')

  if (error || !events) return null

  // Daily event counts
  const dailyCountsObj: Record<string, number> = {}
  for (const evt of events) {
    const date = new Date(evt.occurred_at as string).toISOString().split('T')[0] || ''
    if (!date) continue
    dailyCountsObj[date] = (dailyCountsObj[date] ?? 0) + 1
  }

  const dateKeys = Object.keys(dailyCountsObj)
  if (dateKeys.length < 14) return null // Need at least 2 weeks

  const counts = dateKeys.map(date => dailyCountsObj[date]!)
  const firstHalf = counts.slice(0, Math.floor(counts.length / 2))
  const secondHalf = counts.slice(Math.floor(counts.length / 2))

  const baselineRate = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0
  const currentRate = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0

  // CUSUM calculation (simplified): accumulate differences from baseline
  let cusum = 0
  let maxCusum = 0
  const k = baselineRate * 0.5 // Detection threshold (half the baseline)

  for (const count of counts) {
    cusum = Math.max(0, cusum + (count - baselineRate - k))
    maxCusum = Math.max(maxCusum, cusum)
  }

  // Determine if significant changepoint detected
  const shift_magnitude = Math.abs(currentRate - baselineRate)
  const threshold = baselineRate * 0.3 // 30% shift required

  if (shift_magnitude < threshold) return null

  return {
    country,
    detected_at: new Date().toISOString(),
    cusum_score: maxCusum,
    baseline_rate: baselineRate,
    current_rate: currentRate,
    shift_magnitude,
  }
}

/**
 * Generate correlation signal when anomaly detected
 */
export async function createAnomalySignal(anomaly: AnomalyDetection): Promise<boolean> {
  const supabase = createServiceClient()

  const confidenceMap = {
    moderate: 0.6,
    significant: 0.8,
    extreme: 0.95,
    none: 0,
  }

  try {
    await supabase.from('correlation_signals').insert({
      pattern_type: 'statistical_anomaly',
      description: `Statistical anomaly detected in ${anomaly.country}: ${anomaly.event_count} events on ${anomaly.date} (z-score: ${anomaly.z_score.toFixed(2)}, ${anomaly.anomaly_level} level). Mean severity: ${anomaly.severity.toFixed(2)}.`,
      region: anomaly.country,
      confidence: confidenceMap[anomaly.anomaly_level],
      resolved: false,
      detected_at: new Date().toISOString(),
    })
    return true
  } catch (error) {
    console.error('[anomaly-detection] Signal creation error:', error)
    return false
  }
}

/**
 * Run full anomaly detection pipeline for a set of countries
 */
export async function detectAnomaliesForCountries(
  countries: string[]
): Promise<{
  anomalies_detected: number
  signals_created: number
  changepoints_detected: number
}> {
  let anomalies_detected = 0
  let signals_created = 0
  let changepoints_detected = 0

  for (let i = 0; i < countries.length; i++) {
    const country = countries[i] || ''
    if (!country) continue
    try {
      // Check for daily anomalies
      const anomaly = await detectAnomaliesForCountry(country)
      if (anomaly) {
        anomalies_detected++
        const created = await createAnomalySignal(anomaly)
        if (created) signals_created++
      }

      // Check for changepoints
      const changepoint = await detectChangepoint(country)
      if (changepoint) {
        changepoints_detected++
        // Optionally create a signal for changepoint too
        try {
          const supabase = createServiceClient()
          await supabase.from('correlation_signals').insert({
            pattern_type: 'statistical_anomaly',
            description: `Changepoint detected in ${country}: event rate shifted from ${changepoint.baseline_rate.toFixed(1)} to ${changepoint.current_rate.toFixed(1)} events/day (shift: ${(changepoint.shift_magnitude * 100).toFixed(1)}%).`,
            region: country,
            confidence: Math.min(0.9, 0.5 + changepoint.shift_magnitude),
            resolved: false,
            detected_at: new Date().toISOString(),
          })
        } catch (e) {
          console.warn('[anomaly-detection] Changepoint signal creation error:', e)
        }
      }
    } catch (error) {
      console.error(`[anomaly-detection] Error processing ${country}:`, error)
    }
  }

  return {
    anomalies_detected,
    signals_created,
    changepoints_detected,
  }
}
