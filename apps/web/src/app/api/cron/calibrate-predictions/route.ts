export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import {
  calculateAccuracyMetrics,
  calculateAdjustmentFactors,
  calculateBrierScores,
  storePredictionCalibration,
} from '@/lib/intelligence/prediction-feedback'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [metrics, factors, scores] = await Promise.all([
      calculateAccuracyMetrics(),
      calculateAdjustmentFactors(),
      calculateBrierScores(),
    ])

    const stored = await storePredictionCalibration()

    return NextResponse.json({
      success: true,
      metrics: {
        overall_accuracy: metrics.overall_accuracy,
        type_count: Object.keys(metrics.by_type).length,
        region_count: Object.keys(metrics.by_region).length,
        calibration_points: metrics.calibration_curve.length,
      },
      factors: {
        regions_adjusted: Object.keys(factors.region).length,
        types_adjusted: Object.keys(factors.type).length,
      },
      scores: {
        types_evaluated: Object.keys(scores.by_type).length,
        regions_evaluated: Object.keys(scores.by_region).length,
      },
      stored,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[calibrate-predictions] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
