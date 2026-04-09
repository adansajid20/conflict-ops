export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Public ingest trigger — rate limited to once per 2 minutes via Redis.
 * Called by the client every 3 minutes to keep data fresh when users are active.
 * Uses timing-safe auth (cronAuthOk) to prevent timing attacks.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

const RATE_LIMIT_KEY = 'ingest:client_trigger:last_run'
const RATE_LIMIT_MS = 2 * 60 * 1000 // 2 minutes

export async function POST(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    // Rate limit: only allow trigger once per 2 minutes
    const lastRun = await getCachedSnapshot<number>(RATE_LIMIT_KEY)
    if (lastRun && Date.now() - lastRun < RATE_LIMIT_MS) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'rate_limited',
        next_in_ms: RATE_LIMIT_MS - (Date.now() - lastRun),
      })
    }

    await setCachedSnapshot(RATE_LIMIT_KEY, Date.now(), 180) // 3 min TTL

    // Trigger ingest in the background using internal secret
    const secret = process.env['INTERNAL_SECRET'] ?? ''
    const ingestUrl = `${process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://conflictradar.co'}/api/v1/admin/run-ingest`

    // Fire and forget — don't await (would timeout)
    fetch(ingestUrl, {
      method: 'POST',
      headers: { 'x-internal-secret': secret, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(55000),
    }).catch(() => {}) // intentionally fire-and-forget

    return NextResponse.json({ ok: true, triggered: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
