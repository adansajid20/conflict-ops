export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { collectEconomicSignals } from '@/lib/ingest/economic-signals'

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await collectEconomicSignals()

    return NextResponse.json({
      success: true,
      commodity_spikes_detected: result.commodity_spikes,
      stress_scores: result.stress_scores,
      correlations_detected: result.correlations_detected,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[economic-signals cron] Error:', error)
    return NextResponse.json(
      { error: 'Failed to collect economic signals', details: String(error) },
      { status: 500 }
    )
  }
}
