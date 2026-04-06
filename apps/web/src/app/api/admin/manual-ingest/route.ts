export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://conflictradar.co'
const SECRET = process.env.INTERNAL_SECRET ?? ''

const CRONS = [
  '/api/cron/ingest',
  '/api/cron/collect-seismic',
  '/api/cron/collect-fires',
  '/api/cron/collect-flights',
  '/api/cron/enrich-events',
  '/api/cron/calculate-risk-scores',
  '/api/cron/correlate',
]

export async function POST(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, { status: number; data?: unknown; error?: string }> = {}

  for (const cron of CRONS) {
    try {
      const res = await fetch(`${BASE}${cron}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${SECRET}` },
        signal: AbortSignal.timeout(55000),
      })
      results[cron] = { status: res.status, data: await res.json().catch(() => null) }
    } catch (err) {
      results[cron] = { status: 0, error: String(err) }
    }
  }

  return NextResponse.json({ triggered: CRONS.length, results })
}

// Also allow GET for easy browser testing from admin panel
export async function GET(req: NextRequest) {
  return POST(req)
}
