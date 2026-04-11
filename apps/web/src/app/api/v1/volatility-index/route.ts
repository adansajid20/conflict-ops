export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateVolatilityIndex, calculateGlobalVolatilityIndex } from '@/lib/intelligence/volatility-index'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country_code')
    const global = searchParams.get('global') === 'true'

    const supabase = createServiceClient()

    // Case 1: global=true - return global index
    if (global) {
      const globalIndex = await calculateGlobalVolatilityIndex(supabase)

      return NextResponse.json(
        {
          success: true,
          data: globalIndex,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
          },
        }
      )
    }

    // Case 2: country_code provided - return single country volatility
    if (countryCode) {
      const volatility = await calculateVolatilityIndex(countryCode, supabase)

      return NextResponse.json(
        {
          success: true,
          data: volatility,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
          },
        }
      )
    }

    // Case 3: neither global nor country_code - return top 20 most volatile countries
    // Fetch all events from last 30 days to determine volatility per country
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: events, error } = await supabase
      .from('events')
      .select('country_code')
      .gte('occurred_at', thirtyDaysAgo)

    if (error || !events) {
      return NextResponse.json(
        {
          success: true,
          data: [],
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
          },
        }
      )
    }

    // Count events per country
    const countryEventCounts: Record<string, number> = {}
    for (const event of events) {
      const code = (event.country_code as string) || 'UNKNOWN'
      countryEventCounts[code] = (countryEventCounts[code] || 0) + 1
    }

    // Get top 20 countries by event count (as proxy for volatility candidates)
    const topCountries = Object.entries(countryEventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([code]) => code)

    // Calculate volatility for each top country
    const volatilityAssessments = await Promise.all(
      topCountries.map(code => calculateVolatilityIndex(code, supabase))
    )

    // Sort by CR-VIX score descending
    const sorted = volatilityAssessments.sort((a, b) => b.cr_vix_score - a.cr_vix_score)

    return NextResponse.json(
      {
        success: true,
        data: sorted,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
      }
    )
  } catch (error) {
    console.error('[volatility-index] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate volatility index',
      },
      { status: 500 }
    )
  }
}
