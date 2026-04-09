export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { calculateCompositeScore, calculateAllCompositeScores } from '@/lib/intelligence/signal-aggregator'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const countryCode = url.searchParams.get('country_code')
  const countryName = url.searchParams.get('country_name')
  const allCountries = url.searchParams.get('all') === 'true'

  try {
    const timestamp = new Date().toISOString()
    if (allCountries) {
      // Calculate composite scores for all major conflict zones
      const scores = await calculateAllCompositeScores()
      return NextResponse.json({
        success: true,
        data: {
          composite_scores: scores,
          count: scores.length,
        },
        timestamp,
      })
    }

    if (!countryCode || !countryName) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: country_code and country_name (or use ?all=true)' },
        { status: 400 }
      )
    }

    // Calculate composite score for specific country
    const score = await calculateCompositeScore(countryCode, countryName)

    return NextResponse.json({
      success: true,
      data: {
        composite_score: score,
      },
      timestamp,
    })
  } catch (error) {
    console.error('[composite-score] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to calculate composite score', details: String(error) },
      { status: 500 }
    )
  }
}
