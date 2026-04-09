export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const url = new URL(req.url)

    // Optional query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const severity = url.searchParams.get('severity') // 'moderate' | 'significant' | 'extreme'
    const country = url.searchParams.get('country')

    let query = supabase
      .from('correlation_signals')
      .select('id, region, description, confidence, pattern_type, detected_at, resolved')
      .eq('pattern_type', 'statistical_anomaly')
      .eq('resolved', false)
      .order('detected_at', { ascending: false })

    // Filter by country if provided
    if (country) {
      query = query.ilike('region', `%${country}%`)
    }

    // Filter by severity if provided
    if (severity) {
      const confidenceThreshold = severity === 'extreme' ? 4.0 : severity === 'significant' ? 3.0 : 2.0
      query = query.gte('confidence', confidenceThreshold)
    }

    const { data: signals, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch anomalies',
          details: error.message,
        },
        { status: 500 }
      )
    }

    // Parse anomalies from signal descriptions and add metadata
    const anomalies = (signals ?? [])
      .map(signal => {
        // Extract z-score from description
        let z_score = 2.5
        let baseline_mean = 0
        let current_value = 0
        let deviation_type = 'events/day'

        const description = (signal.description as string) ?? ''
        const zMatch = description.match(/z-score:\s*([\d.-]+)/)
        if (zMatch && zMatch[1]) z_score = parseFloat(zMatch[1])

        // Extract baseline and current values if present
        const baselineMatch = description.match(/baseline[:\s]+([\d.]+)/)
        if (baselineMatch && baselineMatch[1]) baseline_mean = parseFloat(baselineMatch[1])

        const currentMatch = description.match(/current[:\s]+([\d.]+)/)
        if (currentMatch && currentMatch[1]) current_value = parseFloat(currentMatch[1])

        // If we couldn't parse values, estimate from z-score
        if (baseline_mean === 0 && z_score > 0) {
          baseline_mean = 5.0
          current_value = baseline_mean + z_score * 2.0
        }

        const devMatch = description.match(/deviation[:\s]+(\w+)/)
        if (devMatch && devMatch[1]) deviation_type = devMatch[1]

        return {
          id: signal.id,
          country_code: signal.region ?? '',
          pattern_type: (signal.pattern_type as string) ?? 'statistical_anomaly',
          confidence: signal.confidence,
          metadata: {
            z_score,
            baseline_mean,
            current_value,
            deviation_type,
          },
          detected_at: signal.detected_at,
          region: signal.region ?? undefined,
        }
      })

    // Compute stats for the frontend
    const extreme = anomalies.filter(a => a.metadata.z_score > 4.0).length
    const uniqueCountries = new Set(anomalies.map(a => a.country_code).filter(Boolean))
    const latestDetection = anomalies.length > 0 ? anomalies[0]!.detected_at : new Date().toISOString()

    return NextResponse.json({
      success: true,
      anomalies,
      stats: {
        total: anomalies.length,
        extreme,
        countries: uniqueCountries.size,
        latest: latestDetection,
      },
      pagination: {
        limit,
        offset,
        total: count ?? 0,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[GET /api/v1/anomalies] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * Mark an anomaly as resolved
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { signal_id?: string; action?: string }
    const { signal_id, action } = body

    if (!signal_id || !action) {
      return NextResponse.json(
        {
          error: 'Missing signal_id or action',
        },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    if (action === 'resolve') {
      await supabase.from('correlation_signals').update({ resolved: true }).eq('id', signal_id)
    } else if (action === 'unresolve') {
      await supabase.from('correlation_signals').update({ resolved: false }).eq('id', signal_id)
    } else {
      return NextResponse.json(
        {
          error: 'Invalid action. Use "resolve" or "unresolve"',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      signal_id,
      action,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[PATCH /api/v1/anomalies] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
