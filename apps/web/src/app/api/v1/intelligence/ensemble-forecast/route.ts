export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { generateEnsemblePrediction } from '@/lib/intelligence/ensemble-predictor'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const countryCode = url.searchParams.get('country_code')
    const horizonStr = url.searchParams.get('horizon') ?? '14'

    if (!countryCode || countryCode.length !== 2) {
      return NextResponse.json(
        { success: false, error: 'country_code parameter required (2-letter ISO code)' },
        { status: 400 }
      )
    }

    const horizon = parseInt(horizonStr)
    if (![7, 14, 30].includes(horizon)) {
      return NextResponse.json(
        { success: false, error: 'horizon must be 7, 14, or 30 days' },
        { status: 400 }
      )
    }

    const prediction = await generateEnsemblePrediction(countryCode.toUpperCase(), horizon as 7 | 14 | 30)

    return NextResponse.json({
      success: true,
      data: {
        country_code: countryCode.toUpperCase(),
        horizon_days: horizon,
        prediction,
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[ensemble-forecast] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
