import { NextRequest, NextResponse } from 'next/server'
import { aggregateStrategicContext, storeStrategicAssessment } from '@/lib/intelligence/extended-lookback'

export async function GET(req: NextRequest) {
  const countryCode = new URL(req.url).searchParams.get('country_code')

  if (!countryCode || countryCode.length !== 2) {
    return NextResponse.json(
      { error: 'country_code parameter required (2-letter ISO code)' },
      { status: 400 }
    )
  }

  try {
    const assessment = await aggregateStrategicContext(countryCode.toUpperCase())

    // Store the assessment in the database
    await storeStrategicAssessment(assessment)

    return NextResponse.json({
      success: true,
      data: assessment,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
