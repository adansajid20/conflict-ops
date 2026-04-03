export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { detectCorrelationSignals } from '@/lib/pipeline/correlate'
import { updateAllRegionRiskScores } from '@/lib/pipeline/risk'

const CRON_SECRET = process.env.INTERNAL_SECRET ?? ''

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (token !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
