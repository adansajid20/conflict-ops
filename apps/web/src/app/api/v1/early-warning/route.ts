export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateEarlyWarning, calculateEarlyWarningsForCountries } from '@/lib/intelligence/early-warning'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country_code')

    // If country_code is provided, return single assessment
    if (countryCode) {
      const assessment = await calculateEarlyWarning(countryCode)

      return NextResponse.json(
        {
          success: true,
          data: assessment,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300',
          },
        }
      )
    }

    // If no country_code: fetch top 30 countries by event count in last 30 days, calculate for each
    const supabase = createServiceClient()
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
            'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300',
          },
        }
      )
    }

    // Count events per country and get top 30
    const countryEventCounts: Record<string, number> = {}
    for (const event of events) {
      const code = (event.country_code as string) || 'UNKNOWN'
      countryEventCounts[code] = (countryEventCounts[code] || 0) + 1
    }

    const topCountries = Object.entries(countryEventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([code]) => code)

    // Calculate assessments in parallel
    const assessments = await calculateEarlyWarningsForCountries(topCountries)

    // Sort by warning level (descending)
    const sorted = assessments.sort((a, b) => b.warning_level - a.warning_level)

    return NextResponse.json(
      {
        success: true,
        data: sorted,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error('[early-warning] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate early warning assessments',
      },
      { status: 500 }
    )
  }
}
