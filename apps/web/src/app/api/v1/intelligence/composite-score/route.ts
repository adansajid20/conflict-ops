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
    if (allCountries) {
      // Calculate composite scores for all major conflict zones
      const scores = await calculateAllCompositeScores()
      return NextResponse.json({
        composite_scores: scores,
        count: scores.length,
        timestamp: new Date().toISOString(),
      })
    }

    if (!countryCode || !countryName) {
      return NextResponse.json(
        { error: 'Missing required parameters: country_code and country_name (or use ?all=true)' },
        { status: 400 }
      )
    }

    // Calculate composite score for specific country
    const score = await calculateCompositeScore(countryCode, countryName)

    return NextResponse.json({
      composite_score: score,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[composite-score] Error:', error)
    return NextResponse.json(
      { error: 'Failed to calculate composite score', details: String(error) },
      { status: 500 }
    )
  }
}
