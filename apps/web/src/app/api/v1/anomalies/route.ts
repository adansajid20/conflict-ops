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
        // Extract z-score and anomaly level from description
        let anomaly_level: 'moderate' | 'significant' | 'extreme' = 'moderate'
        let z_score = 2.5

        const description = (signal.description as string) ?? ''
        const zMatch = description.match(/z-score:\s*([\d.-]+)/)
        if (zMatch && zMatch[1]) z_score = parseFloat(zMatch[1])

        if (description.includes('extreme level')) anomaly_level = 'extreme'
        else if (description.includes('significant level')) anomaly_level = 'significant'
        else if (description.includes('moderate level')) anomaly_level = 'moderate'

        return {
          id: signal.id,
          country: signal.region,
          description: signal.description,
          anomaly_level,
          z_score,
          confidence: signal.confidence,
          detected_at: signal.detected_at,
          resolved: signal.resolved,
        }
      })

    return NextResponse.json({
      success: true,
      data: anomalies,
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
