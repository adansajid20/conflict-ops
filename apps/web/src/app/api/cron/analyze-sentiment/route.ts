export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { processSentimentAnalysis } from '@/lib/intelligence/sentiment-engine'

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processSentimentAnalysis()

    return NextResponse.json({
      success: true,
      countries_processed: result.processed,
      signals_created: result.signals_created,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
