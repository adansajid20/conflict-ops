export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface SeverityBreakdown {
  critical: number
  high: number
  medium: number
  low: number
}

interface TrendingRegion {
  country_code: string
  event_count: number
  previous_count: number
  trend: number
}

interface GlobalSummaryResponse {
  success: boolean
  data: {
    global_threat_level: number
    severity_breakdown: SeverityBreakdown
    top_countries: Array<{ country_code: string; event_count: number }>
    trending_regions: TrendingRegion[]
    event_count: number
    period: { start: string; end: string }
  }
  timestamp: string
}

export async function GET(req: NextRequest): Promise<NextResponse<GlobalSummaryResponse>> {
  try {
    const supabase = createServiceClient()

    // Get current 7-day window
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Query events from last 7 days
    const { data: recentEvents, error: recentError } = await supabase
      .from('events')
      .select('severity, country_code, occurred_at')
      .gte('occurred_at', sevenDaysAgo.toISOString())
      .lte('occurred_at', now.toISOString())

    if (recentError) {
      throw new Error(`Failed to fetch recent events: ${recentError.message}`)
    }

    // Query events from previous 7 days (for trend calculation)
    const { data: previousEvents, error: previousError } = await supabase
      .from('events')
      .select('country_code')
      .gte('occurred_at', fourteenDaysAgo.toISOString())
      .lt('occurred_at', sevenDaysAgo.toISOString())

    if (previousError) {
      throw new Error(`Failed to fetch previous events: ${previousError.message}`)
    }

    // Calculate severity breakdown
    const severityBreakdown: SeverityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }

    const countryEventMap = new Map<string, number>()
    const countryPreviousMap = new Map<string, number>()

    // Process recent events
    for (const event of recentEvents || []) {
      // Map severity number (1-4) to string name
      let severity: string
      switch (event.severity) {
        case 1:
          severity = 'low'
          break
        case 2:
          severity = 'medium'
          break
        case 3:
          severity = 'high'
          break
        case 4:
          severity = 'critical'
          break
        default:
          severity = 'low'
      }

      if (severity === 'critical') severityBreakdown.critical++
      else if (severity === 'high') severityBreakdown.high++
      else if (severity === 'medium') severityBreakdown.medium++
      else severityBreakdown.low++

      const code = event.country_code || 'XX'
      countryEventMap.set(code, (countryEventMap.get(code) || 0) + 1)
    }

    // Process previous events
    for (const event of previousEvents || []) {
      const code = event.country_code || 'XX'
      countryPreviousMap.set(code, (countryPreviousMap.get(code) || 0) + 1)
    }

    // Get top 5 countries
    const topCountries = Array.from(countryEventMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([country_code, event_count]) => ({ country_code, event_count }))

    // Calculate trending regions (increased activity)
    const trendingRegions: TrendingRegion[] = Array.from(countryEventMap.entries())
      .map(([country_code, event_count]) => ({
        country_code,
        event_count,
        previous_count: countryPreviousMap.get(country_code) || 0,
        trend: event_count - (countryPreviousMap.get(country_code) || 0),
      }))
      .filter((r) => r.trend > 0)
      .sort((a, b) => b.trend - a.trend)
      .slice(0, 5)

    // Calculate global threat level (0-100 scale)
    // Weighted by severity: critical=4, high=2, medium=1, low=0.25
    const totalEventWeight =
      severityBreakdown.critical * 4 +
      severityBreakdown.high * 2 +
      severityBreakdown.medium * 1 +
      severityBreakdown.low * 0.25

    // Normalize to 0-100 scale (assume max expected weight in 7 days is around 500)
    const globalThreatLevel = Math.min(100, Math.round((totalEventWeight / 500) * 100))

    const totalEventCount = (recentEvents || []).length

    return NextResponse.json<GlobalSummaryResponse>({
      success: true,
      data: {
        global_threat_level: globalThreatLevel,
        severity_breakdown: severityBreakdown,
        top_countries: topCountries,
        trending_regions: trendingRegions,
        event_count: totalEventCount,
        period: {
          start: sevenDaysAgo.toISOString(),
          end: now.toISOString(),
        },
      },
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error('[global-summary] Error:', error)
    return NextResponse.json<GlobalSummaryResponse>(
      {
        success: false,
        data: {
          global_threat_level: 0,
          severity_breakdown: { critical: 0, high: 0, medium: 0, low: 0 },
          top_countries: [],
          trending_regions: [],
          event_count: 0,
          period: { start: '', end: '' },
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
