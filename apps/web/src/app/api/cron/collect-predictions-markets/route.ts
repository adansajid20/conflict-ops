export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { fetchPredictionMarketsWithSignals } from '@/lib/ingest/prediction-markets'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const result = await fetchPredictionMarketsWithSignals(supabase)

    return NextResponse.json({
      success: true,
      message: 'Prediction markets data ingested successfully',
      stored: result.stored,
      sources: result.sources,
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Cron job error:', errorMessage, error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to ingest prediction markets',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
