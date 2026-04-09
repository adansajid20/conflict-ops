import { createServiceClient } from '@/lib/supabase/server'

export type PredictionAccuracy = {
  overall_accuracy: number
  by_type: Record<string, number>
  by_region: Record<string, number>
  calibration_curve: Array<{
    predicted_prob: number
    actual_rate: number
    count: number
  }>
}

export type PredictionAdjustmentFactors = {
  region: Record<string, number>
  type: Record<string, number>
}

export type CalibrationMetrics = {
  by_type: Record<
    string,
    {
      brier_score: number
      accuracy: number
      sample_count: number
    }
  >
  by_region: Record<
    string,
    {
      brier_score: number
      accuracy: number
      sample_count: number
    }
  >
}

/**
 * Calculate prediction accuracy metrics from outcomes over the last 90 days
 * Returns hit rates by type, region, and calibration curve (predicted vs actual probability)
 */
export async function calculateAccuracyMetrics(): Promise<PredictionAccuracy> {
  const supabase = createServiceClient()
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('id, prediction_type, region, probability, outcome')
    .gte('created_at', since90d)
    .not('outcome', 'is', null)

  if (error || !predictions) {
    return {
      overall_accuracy: 0,
      by_type: {},
      by_region: {},
      calibration_curve: [],
    }
  }

  // Overall accuracy (confirmed / total)
  const confirmed = predictions.filter(p => p.outcome === 'confirmed').length
  const overall_accuracy = predictions.length > 0 ? confirmed / predictions.length : 0

  // Accuracy by type
  const byTypeObj: Record<string, { confirmed: number; total: number }> = {}
  for (const pred of predictions) {
    const type = (pred.prediction_type as string) ?? 'unknown'
    const entry = byTypeObj[type] ?? { confirmed: 0, total: 0 }
    entry.total++
    if (pred.outcome === 'confirmed') entry.confirmed++
    byTypeObj[type] = entry
  }

  const by_type: Record<string, number> = {}
  for (const type of Object.keys(byTypeObj)) {
    const { confirmed, total } = byTypeObj[type]!
    by_type[type] = total > 0 ? confirmed / total : 0
  }

  // Accuracy by region
  const byRegionObj: Record<string, { confirmed: number; total: number }> = {}
  for (const pred of predictions) {
    const region = (pred.region as string) ?? 'unknown'
    const entry = byRegionObj[region] ?? { confirmed: 0, total: 0 }
    entry.total++
    if (pred.outcome === 'confirmed') entry.confirmed++
    byRegionObj[region] = entry
  }

  const by_region: Record<string, number> = {}
  for (const region of Object.keys(byRegionObj)) {
    const { confirmed, total } = byRegionObj[region]!
    by_region[region] = total > 0 ? confirmed / total : 0
  }

  // Calibration curve: bin predictions by probability, calculate actual hit rate
  const binsObj: Record<string, { confirmed: number; total: number }> = {}
  for (const pred of predictions) {
    const prob = (pred.probability as number) ?? 0.5
    const bin = (Math.round(prob * 10) / 10).toString() // Round to nearest 0.1
    const entry = binsObj[bin] ?? { confirmed: 0, total: 0 }
    entry.total++
    if (pred.outcome === 'confirmed') entry.confirmed++
    binsObj[bin] = entry
  }

  const calibration_curve = Object.keys(binsObj)
    .map(bin => ({ bin: parseFloat(bin), ...(binsObj[bin] ?? { confirmed: 0, total: 0 }) }))
    .sort((a, b) => a.bin - b.bin)
    .map(({ bin, confirmed, total }) => {
      const totalCount = (total as number) ?? 0
      const confirmedCount = (confirmed as number) ?? 0
      return {
        predicted_prob: bin,
        actual_rate: totalCount > 0 ? confirmedCount / totalCount : 0,
        count: totalCount,
      }
    })

  return {
    overall_accuracy,
    by_type,
    by_region,
    calibration_curve,
  }
}

/**
 * Generate adjustment factors based on historical accuracy
 * If we overpredicted in a region, generate dampening factors
 * If we underpredicted, generate boosting factors
 */
export async function calculateAdjustmentFactors(): Promise<PredictionAdjustmentFactors> {
  const supabase = createServiceClient()
  const metrics = await calculateAccuracyMetrics()
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: predictions } = await supabase
    .from('predictions')
    .select('prediction_type, region, probability, outcome')
    .gte('created_at', since90d)
    .not('outcome', 'is', null)

  const region: Record<string, number> = {}
  const type: Record<string, number> = {}

  // Calculate average predicted prob by region
  const avgPredByRegion: Record<string, number> = {}
  const regionCounts: Record<string, number> = {}
  for (const pred of predictions ?? []) {
    const regionName = (pred.region as string) ?? 'unknown'
    avgPredByRegion[regionName] = (avgPredByRegion[regionName] ?? 0) + ((pred.probability as number) ?? 0.5)
    regionCounts[regionName] = (regionCounts[regionName] ?? 0) + 1
  }
  for (const regionName of Object.keys(avgPredByRegion)) {
    const count = regionCounts[regionName]
    if (count) avgPredByRegion[regionName]! /= count
  }

  // Calculate average predicted prob by type
  const avgPredByType: Record<string, number> = {}
  const typeCounts: Record<string, number> = {}
  for (const pred of predictions ?? []) {
    const typeName = (pred.prediction_type as string) ?? 'unknown'
    avgPredByType[typeName] = (avgPredByType[typeName] ?? 0) + ((pred.probability as number) ?? 0.5)
    typeCounts[typeName] = (typeCounts[typeName] ?? 0) + 1
  }
  for (const typeName of Object.keys(avgPredByType)) {
    const count = typeCounts[typeName]
    if (count) avgPredByType[typeName]! /= count
  }

  // Regional factors: actual_accuracy / predicted_average_prob
  // If we predicted 0.7 but actual hit rate is 0.3, factor = 0.3/0.7 = 0.43 (dampen)
  for (const [regionName, accuracy] of Object.entries(metrics.by_region)) {
    if (accuracy === 0) {
      region[regionName] = 0.5 // Conservative dampening for 0% accuracy
    } else {
      const avgPredicted = avgPredByRegion[regionName] ?? 0.6
      region[regionName] = Math.min(2.0, Math.max(0.3, accuracy / avgPredicted))
    }
  }

  // Type factors: same logic
  for (const [typeName, accuracy] of Object.entries(metrics.by_type)) {
    if (accuracy === 0) {
      type[typeName] = 0.5
    } else {
      const avgPredicted = avgPredByType[typeName] ?? 0.6
      type[typeName] = Math.min(2.0, Math.max(0.3, accuracy / avgPredicted))
    }
  }

  return { region, type }
}

/**
 * Calculate Brier score (mean squared error of probability vs outcome)
 * Lower is better (0 = perfect calibration, 1 = worst)
 */
export async function calculateBrierScores(): Promise<CalibrationMetrics> {
  const supabase = createServiceClient()
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('id, prediction_type, region, probability, outcome')
    .gte('created_at', since90d)
    .not('outcome', 'is', null)

  if (error || !predictions) {
    return { by_type: {}, by_region: {} }
  }

  // By type
  const byTypeObj: Record<
    string,
    {
      brier_sum: number
      confirmed: number
      total: number
    }
  > = {}

  for (const pred of predictions) {
    const type = (pred.prediction_type as string) ?? 'unknown'
    const prob = (pred.probability as number) ?? 0.5
    const outcome = pred.outcome === 'confirmed' ? 1 : 0

    const entry = byTypeObj[type] ?? { brier_sum: 0, confirmed: 0, total: 0 }
    entry.brier_sum += Math.pow(prob - outcome, 2)
    entry.total++
    if (outcome === 1) entry.confirmed++
    byTypeObj[type] = entry
  }

  const by_type: Record<
    string,
    {
      brier_score: number
      accuracy: number
      sample_count: number
    }
  > = {}

  for (const typeName of Object.keys(byTypeObj)) {
    const { brier_sum, confirmed, total } = byTypeObj[typeName]!
    by_type[typeName] = {
      brier_score: total > 0 ? brier_sum / total : 0,
      accuracy: total > 0 ? confirmed / total : 0,
      sample_count: total,
    }
  }

  // By region
  const byRegionObj: Record<
    string,
    {
      brier_sum: number
      confirmed: number
      total: number
    }
  > = {}

  for (const pred of predictions) {
    const region = (pred.region as string) ?? 'unknown'
    const prob = (pred.probability as number) ?? 0.5
    const outcome = pred.outcome === 'confirmed' ? 1 : 0

    const entry = byRegionObj[region] ?? { brier_sum: 0, confirmed: 0, total: 0 }
    entry.brier_sum += Math.pow(prob - outcome, 2)
    entry.total++
    if (outcome === 1) entry.confirmed++
    byRegionObj[region] = entry
  }

  const by_region: Record<
    string,
    {
      brier_score: number
      accuracy: number
      sample_count: number
    }
  > = {}

  for (const regionName of Object.keys(byRegionObj)) {
    const { brier_sum, confirmed, total } = byRegionObj[regionName]!
    by_region[regionName] = {
      brier_score: total > 0 ? brier_sum / total : 0,
      accuracy: total > 0 ? confirmed / total : 0,
      sample_count: total,
    }
  }

  return { by_type, by_region }
}

/**
 * Store calibration results in the database
 */
export async function storePredictionCalibration(): Promise<{
  metrics_stored: boolean
  factors_stored: boolean
  scores_stored: boolean
}> {
  const supabase = createServiceClient()

  try {
    // Store accuracy metrics
    const metrics = await calculateAccuracyMetrics()
    await supabase.from('prediction_accuracy_scores').upsert(
      {
        id: 'overall',
        overall_accuracy: metrics.overall_accuracy,
        by_type: metrics.by_type,
        by_region: metrics.by_region,
        calibration_curve: metrics.calibration_curve,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    // Store adjustment factors
    const factors = await calculateAdjustmentFactors()
    await supabase.from('prediction_priors').upsert(
      {
        id: 'adjustment_factors',
        region_factors: factors.region,
        type_factors: factors.type,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    // Store Brier scores
    const scores = await calculateBrierScores()
    await supabase.from('prediction_brier_scores').upsert(
      {
        id: 'calibration',
        by_type: scores.by_type,
        by_region: scores.by_region,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    return { metrics_stored: true, factors_stored: true, scores_stored: true }
  } catch (error) {
    console.error('[prediction-feedback] Storage error:', error)
    return { metrics_stored: false, factors_stored: false, scores_stored: false }
  }
}
