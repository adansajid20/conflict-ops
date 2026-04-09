export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { detectCorrelationSignals } from '@/lib/pipeline/correlate'
import { updateAllRegionRiskScores } from '@/lib/pipeline/risk'

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [correlate, risk] = await Promise.all([
    detectCorrelationSignals(),
    updateAllRegionRiskScores(),
  ])

  return NextResponse.json({
    success: true,
    signals_created: correlate.signals_created,
    risk_scores_updated: risk.updated,
    timestamp: new Date().toISOString(),
  })
}
