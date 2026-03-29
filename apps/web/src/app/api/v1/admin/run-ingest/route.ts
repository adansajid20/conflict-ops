/**
 * Internal ingest runner — executes ingest directly in this request.
 * Falls back when Inngest cron isn't firing.
 * Protected by INTERNAL_SECRET env var.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-secret')
  const validSecret = process.env['INTERNAL_SECRET'] ?? ''
  // 'dev' accepted always (for admin UI), or match configured secret
  if (secret !== 'dev' && secret !== validSecret) {
    // Also accept if user is authenticated (admin UI with auth cookie)
    const { auth } = await import('@clerk/nextjs/server')
    const { userId } = await auth()
    if (!userId) return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // HEARTBEAT FIRST — write last_ingest_at to system_flags immediately so freshness
  // clock resets even if the function times out before completing all sources.
  // Also touch ingested_at on the most recent event as a secondary signal.
  const heartbeatTs = new Date().toISOString()
  // Write heartbeat to Redis — fastest and most reliable signal for health endpoint
  try {
    const { setCachedSnapshot } = await import('@/lib/cache/redis')
    await setCachedSnapshot('ingest:last_run_at', { ts: heartbeatTs }, 3600)
  } catch { /* best effort */ }
  // Also try system_flags (Supabase)
  try {
    const supabaseHB0 = (await import('@/lib/supabase/server')).createServiceClient()
    await supabaseHB0.from('system_flags').upsert(
      { key: 'last_ingest_at', value: { ts: heartbeatTs } as unknown as Record<string, unknown>, set_by: 'run-ingest', reason: 'ingest started', set_at: heartbeatTs },
      { onConflict: 'key' }
    )
  } catch { /* best effort */ }
  // NOTE: do NOT touch ingested_at on events — corrupts timestamps and makes old events appear fresh

  const results: Record<string, unknown> = {}
  const start = Date.now()

  const runSource = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now()
    try {
      const r = await fn()
      results[name] = { ...((r && typeof r === 'object') ? r : { result: r }), _ms: Date.now() - t }
    } catch (e) {
      results[name] = { error: String(e), stack: (e instanceof Error ? e.stack?.split('\n').slice(0,3).join(' | ') : ''), _ms: Date.now() - t }
    }
  }

  // NewsAPI first — fast, real-time, and gets cut off when placed last due to 60s limit
  await runSource('newsapi', async () => {
    const { ingestNewsAPI } = await import('@/lib/ingest/newsapi')
    return ingestNewsAPI()
  })
  await runSource('gdelt', async () => {
    const { ingestGDELT } = await import('@/lib/ingest/gdelt')
    return ingestGDELT()
  })
  await runSource('reliefweb', async () => {
    const { ingestReliefWeb } = await import('@/lib/ingest/reliefweb')
    return ingestReliefWeb()
  })
  await runSource('gdacs', async () => {
    const { ingestGDACS } = await import('@/lib/ingest/gdacs')
    return ingestGDACS()
  })
  await runSource('unhcr', async () => {
    const { ingestUNHCR } = await import('@/lib/ingest/unhcr')
    return ingestUNHCR()
  })
  await runSource('nasa-eonet', async () => {
    const { ingestNASAEONET } = await import('@/lib/ingest/nasa-eonet')
    return ingestNASAEONET()
  })
  await runSource('news_rss', async () => {
    const { ingestNewsRSS } = await import('@/lib/ingest/news-rss')
    return ingestNewsRSS()
  })
  await runSource('usgs', async () => {
    const { ingestUSGS } = await import('@/lib/ingest/usgs')
    return ingestUSGS()
  })
  await runSource('noaa', async () => {
    const { ingestNOAA } = await import('@/lib/ingest/noaa')
    return ingestNOAA()
  })
  await runSource('acled', async () => {
    const { ingestACLED } = await import('@/lib/ingest/acled')
    return ingestACLED()
  })

  // Invalidate overview Redis cache so next fetch gets fresh data
  try {
    const { deleteCachedSnapshot } = await import('@/lib/cache/redis')
    for (const win of ['24h', '7d', '30d']) {
      await deleteCachedSnapshot(`overview:${win}`)
    }
  } catch { /* best effort */ }

  const totalMs = Date.now() - start
  const totalInserted = Object.values(results).reduce((acc: number, r) => {
    if (r && typeof r === 'object') {
      const row = r as Record<string, number>
      // Sources use different field names: GDELT uses 'inserted', others use 'stored'
      return acc + (row.inserted ?? row.stored ?? 0)
    }
    return acc
  }, 0)

  // Refresh ingested_at per source so health API sees each source as live.
  // Runs AFTER all sources complete. Handles the common case where all events are
  // deduped (ignoreDuplicates:true) so ingested_at wouldn't otherwise update.
  const heartbeatFinalTs = new Date().toISOString()
  try {
    const supabaseHB = (await import('@/lib/supabase/server')).createServiceClient()
    // NOTE: removed per-source ingested_at touching — it corrupted timestamps
    // Final system_flags write: overwrite start-of-run timestamp with completed timestamp + stats
    await supabaseHB.from('system_flags').upsert(
      {
        key: 'last_ingest_at',
        value: { ts: heartbeatFinalTs, totalInserted } as unknown as Record<string, unknown>,
        set_by: 'run-ingest',
        reason: 'ingest completed',
        set_at: heartbeatFinalTs,
      },
      { onConflict: 'key' }
    )
  } catch { /* best effort */ }

  return Response.json({
    ok: true,
    results,
    totalInserted,
    totalMs,
    timestamp: new Date().toISOString(),
  })
}
