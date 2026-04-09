export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { detectAnomaliesForCountries } from '@/lib/intelligence/anomaly-detection'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createServiceClient()

    // Get top 40 active countries by event count in last 7 days
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: activeCountries, error } = await supabase
      .from('events')
      .select('country_code')
      .gte('occurred_at', since7d)
      .not('country_code', 'is', null)

    if (error || !activeCountries) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch active countries',
        },
        { status: 500 }
      )
    }

    // Count events per country and get top 40
    const countryCounts = new Map<string, number>()
    for (const evt of activeCountries) {
      const cc = evt.country_code as string
      countryCounts.set(cc, (countryCounts.get(cc) ?? 0) + 1)
    }

    const topCountries = Array.from(countryCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 40)
      .map(([country]) => country)

    // Run anomaly detection
    const results = await detectAnomaliesForCountries(topCountries)

    // Update tracking stats
    await supabase.from('tracking_stats').upsert(
      {
        stat_type: 'anomalies_detected',
        count: results.anomalies_detected,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stat_type' }
    )

    return NextResponse.json({
      success: true,
      countries_analyzed: topCountries.length,
      ...results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[detect-anomalies] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
