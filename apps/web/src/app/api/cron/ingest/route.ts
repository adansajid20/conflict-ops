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
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Write heartbeat to Redis — Redis only, never touch event ingested_at (corrupts timestamps)
  const heartbeatTs = new Date().toISOString()
  try {
    const { getCachedSnapshot, setCachedSnapshot } = await import('@/lib/cache/redis')
    const lastRetentionRun = await getCachedSnapshot<{ ts: string }>('retention:last_run_at')
    const lastRunTs = lastRetentionRun?.ts ? new Date(lastRetentionRun.ts).getTime() : 0
    const shouldRunRetention = !lastRunTs || (Date.now() - lastRunTs) > (23 * 60 * 60 * 1000)
    if (shouldRunRetention) {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const { enforceRetention } = await import('@/lib/compliance/retention')
      const supabase = createServiceClient()
      const { data: orgs } = await supabase.from('orgs').select('id')
      await Promise.all((orgs ?? []).map(async (org) => enforceRetention(org.id)))
      await setCachedSnapshot('retention:last_run_at', { ts: heartbeatTs }, 24 * 3600)
    }
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

  await runSource('rss_live', async () => { const { ingestRSSLive } = await import('@/lib/ingest/rss-live'); return ingestRSSLive() })
  await runSource('news_rss', async () => { const { ingestNewsRSS } = await import('@/lib/ingest/news-rss'); return ingestNewsRSS() })
  await runSource('gdelt', async () => { const { ingestGDELT } = await import('@/lib/ingest/gdelt'); return ingestGDELT() })
  await runSource('acled', async () => { const { ingestACLED } = await import('@/lib/ingest/acled'); return ingestACLED() })
  // DISABLED: ReliefWeb produces bureaucratic documents, not breaking news
  // await runSource('reliefweb', async () => { const { ingestReliefWeb } = await import('@/lib/ingest/reliefweb'); return ingestReliefWeb() })

  // DISABLED: UNHCR produces housing bulletins and meeting minutes, not intelligence
  // await runSource('unhcr', async () => { const { ingestUNHCR } = await import('@/lib/ingest/unhcr'); return ingestUNHCR() })
  await runSource('usgs', async () => { const { ingestUSGS } = await import('@/lib/ingest/usgs'); return ingestUSGS() })
  await runSource('nasa-eonet', async () => { const { ingestNASAEONET } = await import('@/lib/ingest/nasa-eonet'); return ingestNASAEONET() })
  await runSource('gdacs', async () => { const { ingestGDACS } = await import('@/lib/ingest/gdacs'); return ingestGDACS() })
  // NOAA disabled — injects domestic US weather alerts (tornado/flood/storm warnings), not conflict intel
  // await runSource('noaa', async () => { const { ingestNOAA } = await import('@/lib/ingest/noaa'); return ingestNOAA() })
  await runSource('cloudflare-radar', async () => { const { ingestCloudflareRadar } = await import('@/lib/ingest/tracking/cloudflare-radar'); return ingestCloudflareRadar() })

  let newsApiSkipped = false
  try {
    const { getCachedSnapshot, setCachedSnapshot } = await import('@/lib/cache/redis')
    const lastNewsApiRun = await getCachedSnapshot<{ ts: string }>('newsapi:last_run')
    const lastRunMs = lastNewsApiRun?.ts ? new Date(lastNewsApiRun.ts).getTime() : 0
    const shouldRunNewsApi = !lastRunMs || (Date.now() - lastRunMs) > (6 * 60 * 60 * 1000)

    if (shouldRunNewsApi) {
      await runSource('newsapi', async () => { const { ingestNewsAPI } = await import('@/lib/ingest/newsapi'); return ingestNewsAPI() })
      await setCachedSnapshot('newsapi:last_run', { ts: new Date().toISOString() }, 6 * 60 * 60)
    } else {
      newsApiSkipped = true
      results['newsapi'] = { skipped: true, reason: '6h guard active' }
    }
  } catch {
    await runSource('newsapi', async () => { const { ingestNewsAPI } = await import('@/lib/ingest/newsapi'); return ingestNewsAPI() })
  }

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

  return Response.json({ success: true, data: { totalInserted, results, newsApiSkipped } })
}
