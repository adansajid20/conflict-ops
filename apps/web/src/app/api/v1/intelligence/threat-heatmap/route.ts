export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

interface HeatmapEntry {
  country_code: string
  threat_score: number
  event_count: number
  dominant_severity: string
  latest_event: string | null
}

interface HeatmapResponse {
  success: boolean
  data: HeatmapEntry[]
  count: number
  timestamp: string
}

export async function GET(req: NextRequest): Promise<NextResponse<HeatmapResponse>> {
  try {
    const url = new URL(req.url)
    const minScore = parseInt(url.searchParams.get('min_score') ?? '0')

    const supabase = createServiceClient()

    // Get events from last 30 days grouped by country
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const { data: events, error } = await supabase
      .from('events')
      .select('country_code, severity, occurred_at')
      .gte('occurred_at', thirtyDaysAgo.toISOString())

    if (error) {
      throw new Error(`Failed to fetch events: ${error.message}`)
    }

    // Group and calculate threat scores by country
    const countryMap = new Map<
      string,
      {
        events: Array<{ severity: string; occurred_at: string }>
      }
    >()

    for (const event of events || []) {
      const countryCode = event.country_code || 'XX'
      if (!countryMap.has(countryCode)) {
        countryMap.set(countryCode, { events: [] })
      }
      countryMap.get(countryCode)!.events.push({
        severity: (event.severity || 'low').toLowerCase(),
        occurred_at: event.occurred_at || new Date().toISOString(),
      })
    }

    // Convert to heatmap entries with threat scores
    const heatmapEntries: HeatmapEntry[] = Array.from(countryMap.entries()).map(
      ([country_code, data]) => {
        const eventCount = data.events.length

        // Calculate threat score based on:
        // - Event count (base)
        // - Severity distribution (weighted)
        // - Recency (more recent = higher score)
        const severityWeights = { critical: 4, high: 2, medium: 1, low: 0.25 }
        const now = Date.now()
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

        let severityScore = 0
        let recencyScore = 0

        for (const evt of data.events) {
          const weight = severityWeights[evt.severity as keyof typeof severityWeights] || 0.25
          severityScore += weight

          // Recency: events from today are 100%, from 30 days ago are 0%
          const eventAge = now - new Date(evt.occurred_at).getTime()
          const recencyFactor = Math.max(0, 1 - eventAge / thirtyDaysMs)
          recencyScore += recencyFactor
        }

        // Normalize threat score to 0-100
        // Consider event count: base multiplier for number of events
        const threatScore = Math.min(100, Math.round((severityScore + recencyScore * 0.5) / 2))

        // Find dominant severity
        const severityCounts: Record<string, number> = {}
        for (const evt of data.events) {
          severityCounts[evt.severity] = (severityCounts[evt.severity] || 0) + 1
        }
        const dominantSeverity = Object.entries(severityCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'low'

        // Get latest event timestamp
        const latestEvent = data.events.reduce((latest, evt) => {
          const latestTime = new Date(latest.occurred_at).getTime()
          const evtTime = new Date(evt.occurred_at).getTime()
          return evtTime > latestTime ? evt : latest
        })?.occurred_at

        return {
          country_code,
          threat_score: threatScore,
          event_count: eventCount,
          dominant_severity: dominantSeverity,
          latest_event: latestEvent || null,
        }
      }
    )

    // Filter by min_score if provided
    const filtered = heatmapEntries.filter((entry) => entry.threat_score >= minScore)

    // Sort by threat_score descending
    filtered.sort((a, b) => b.threat_score - a.threat_score)

    return NextResponse.json<HeatmapResponse>({
      success: true,
      data: filtered,
      count: filtered.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[threat-heatmap] Error:', error)
    return NextResponse.json<HeatmapResponse>(
      {
        success: false,
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
