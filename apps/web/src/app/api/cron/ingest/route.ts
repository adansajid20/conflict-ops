/**
 * GET /api/cron/ingest?token=<INTERNAL_SECRET>
 * Public cron trigger — for use with cron-job.org (free tier, GET only, no custom headers)
 * Runs ingest directly (no internal HTTP round-trip).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  const validSecret = process.env['INTERNAL_SECRET'] ?? ''

  if (!token || token !== validSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Write heartbeat to Redis immediately
  const heartbeatTs = new Date().toISOString()
  try {
    const { setCachedSnapshot } = await import('@/lib/cache/redis')
    await setCachedSnapshot('ingest:last_run_at', { ts: heartbeatTs }, 3600)
  } catch { /* best effort */ }

  // Run all ingest sources directly
  const results: Record<string, unknown> = {}
  const runSource = async (name: string, fn: () => Promise<unknown>) => {
    try {
      results[name] = await fn()
    } catch (e) {
      results[name] = { error: String(e) }
    }
  }

  await runSource('newsapi', async () => { const { ingestNewsAPI } = await import('@/lib/ingest/newsapi'); return ingestNewsAPI() })
  await runSource('gdelt', async () => { const { ingestGDELT } = await import('@/lib/ingest/gdelt'); return ingestGDELT() })
  await runSource('reliefweb', async () => { const { ingestReliefWeb } = await import('@/lib/ingest/reliefweb'); return ingestReliefWeb() })
  await runSource('gdacs', async () => { const { ingestGDACS } = await import('@/lib/ingest/gdacs'); return ingestGDACS() })
  await runSource('unhcr', async () => { const { ingestUNHCR } = await import('@/lib/ingest/unhcr'); return ingestUNHCR() })
  await runSource('nasa-eonet', async () => { const { ingestNASAEONET } = await import('@/lib/ingest/nasa-eonet'); return ingestNASAEONET() })
  await runSource('news_rss', async () => { const { ingestNewsRSS } = await import('@/lib/ingest/news-rss'); return ingestNewsRSS() })
  await runSource('usgs', async () => { const { ingestUSGS } = await import('@/lib/ingest/usgs'); return ingestUSGS() })
  await runSource('noaa', async () => { const { ingestNOAA } = await import('@/lib/ingest/noaa'); return ingestNOAA() })

  // Final heartbeat with completed timestamp
  try {
    const { setCachedSnapshot } = await import('@/lib/cache/redis')
    await setCachedSnapshot('ingest:last_run_at', { ts: new Date().toISOString() }, 3600)
  } catch { /* best effort */ }

  let totalInserted = 0
  for (const r of Object.values(results)) {
    if (r && typeof r === 'object') {
      const v = r as Record<string, unknown>
      totalInserted += Number(v['stored'] ?? v['inserted'] ?? 0)
    }
  }

  return Response.json({ ok: true, totalInserted, results })
}
