export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase/server'
import { pingRedis, isSafeMode, getRedisInitError } from '@/lib/cache/redis'

const ENABLED_SOURCES = ['gdelt', 'reliefweb', 'gdacs', 'unhcr', 'nasa_eonet', 'news_rss', 'usgs', 'noaa']
const STALE_THRESHOLD_MS = 12 * 3600 * 1000  // 12h = degraded
const SOURCE_STALE_MS    = 72 * 3600 * 1000  // 72h per source — dedup means ingested_at only updates on genuinely new events

export async function GET() {
  const start = Date.now()
  const errors: string[] = []

  let dbOk = false
  let redisOk = false
  let safeMode = false
  let lastIngestAt: string | null = null
  let eventCount = 0
  let inserted24h = 0
  let deduped24h = 0
  let sourcesLastSeen: Record<string, string | null> = {}

  // --- DB check ---
  try {
    const supabase = createServiceClient()
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [countResult, lastIngestResult, sourceResult, ingest24h, flagResult] = await Promise.allSettled([
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('ingested_at').order('ingested_at', { ascending: false }).limit(1).single(),
      supabase.from('events').select('source, ingested_at').order('ingested_at', { ascending: false }).limit(500),
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('ingested_at', h24),
      supabase.from('system_flags').select('value').eq('key', 'last_ingest_at').single(),
    ])

    if (countResult.status === 'fulfilled' && !countResult.value.error) {
      dbOk = true
      eventCount = countResult.value.count ?? 0
    } else {
      const msg = countResult.status === 'rejected' ? String(countResult.reason) : countResult.value.error?.message
      errors.push(`db: ${msg}`)
    }

    // Priority 1: Redis heartbeat (most reliable — written at start of every ingest run)
    try {
      const { getCachedSnapshot } = await import('@/lib/cache/redis')
      const redisHB = await getCachedSnapshot<{ ts: string }>('ingest:last_run_at')
      if (redisHB?.ts) lastIngestAt = redisHB.ts
    } catch { /* fallback */ }
    // Priority 2: system_flags
    if (!lastIngestAt && flagResult.status === 'fulfilled' && flagResult.value.data) {
      const flagVal = flagResult.value.data.value as { ts?: string } | null
      if (flagVal?.ts) lastIngestAt = flagVal.ts
    }
    // Priority 3: max ingested_at on events table
    if (!lastIngestAt && lastIngestResult.status === 'fulfilled' && lastIngestResult.value.data) {
      lastIngestAt = lastIngestResult.value.data.ingested_at as string
    }
    // Fallback: if last_success_at is >2h old but we have recent 24h inserts,
    // find the most recent event from the last 72h (wider window catches dedup gaps)
    if (!lastIngestAt || (Date.now() - new Date(lastIngestAt).getTime() > 2 * 3600_000)) {
      const supabase2 = createServiceClient()
      const { data: recent } = await supabase2
        .from('events')
        .select('ingested_at')
        .gte('ingested_at', new Date(Date.now() - 72 * 3600_000).toISOString())
        .order('ingested_at', { ascending: false })
        .limit(1)
        .single()
      if (recent?.ingested_at) lastIngestAt = recent.ingested_at as string
    }

    if (sourceResult.status === 'fulfilled' && sourceResult.value.data) {
      for (const row of (sourceResult.value.data as Array<{ source: string; ingested_at: string }>)) {
        if (!sourcesLastSeen[row.source]) sourcesLastSeen[row.source] = row.ingested_at
      }
    }

    if (ingest24h.status === 'fulfilled' && ingest24h.value) {
      inserted24h = ingest24h.value.count ?? 0
    }

    // Check raw_ingest_log for dedup stats
    try {
      const logResult = await supabase
        .from('raw_ingest_log')
        .select('record_count')
        .gte('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      if (!logResult.error && logResult.data) {
        const fetched = logResult.data.reduce((a, r) => a + ((r as { record_count: number }).record_count ?? 0), 0)
        deduped24h = Math.max(0, fetched - inserted24h)
      }
    } catch { /* best effort */ }
  } catch (e) {
    errors.push(`db: ${String(e)}`)
  }

  // --- Redis check ---
  try {
    redisOk = await pingRedis()
    safeMode = await isSafeMode()
    if (!redisOk) {
      const initErr = getRedisInitError()
      errors.push(`redis: ${initErr ?? 'ping failed'}`)
    }
  } catch (e) {
    errors.push(`redis: ${String(e)}`)
  }

  // --- Env check ---
  const missingEnvs: string[] = []
  if (!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']) missingEnvs.push('CLERK_KEY')
  if (!process.env['INNGEST_SIGNING_KEY']) missingEnvs.push('INNGEST_KEY')
  if (missingEnvs.length > 0) errors.push(`missing_env: ${missingEnvs.join(', ')}`)

  const ingestAgeMs = lastIngestAt ? Date.now() - new Date(lastIngestAt).getTime() : Infinity
  // Ingest is OK if: recently ran AND last insert within threshold, OR 50+ events inserted in last 24h (dedup means ingested_at doesn't refresh on duplicates)
  const ingestOk = (isFinite(ingestAgeMs) && ingestAgeMs < STALE_THRESHOLD_MS) || (inserted24h > 50)

  const enabledSources = ENABLED_SOURCES.map(source => {
    const lastSeen = sourcesLastSeen[source] ?? null
    const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Infinity
    const ok = isFinite(ageMs) && ageMs < SOURCE_STALE_MS
    return { name: source, ok, last_seen_at: lastSeen, stale: !ok }
  })

  const liveSources = enabledSources.filter(s => s.ok).length
  const failingSources = enabledSources.filter(s => s.stale).map(s => s.name)

  const ok = dbOk && errors.filter(e => e.startsWith('db:')).length === 0
  const degradedReasons: string[] = []
  if (!ingestOk) degradedReasons.push(`ingest stale: ${lastIngestAt ? Math.round(ingestAgeMs / 3600000) + 'h ago' : 'never'}`)
  if (liveSources === 0) degradedReasons.push('no sources live')
  if (!redisOk) degradedReasons.push('redis unavailable')
  if (safeMode) degradedReasons.push('safe mode active')

  const latencyMs = Date.now() - start
  const versionSha = process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? 'local'

  const body = {
    ok,
    version_sha: versionSha,
    now_utc: new Date().toISOString(),
    db_ok: dbOk,
    redis_ok: redisOk,
    auth_ok: !!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    scheduler_ok: !!process.env['INNGEST_SIGNING_KEY'],
    ingest: {
      ok: ingestOk,
      last_success_at: lastIngestAt,
      last_run_at: lastIngestAt,
      inserted_24h: inserted24h,
      deduped_24h: deduped24h,
      sources_live: liveSources,
      sources_total: ENABLED_SOURCES.length,
    },
    sources: {
      enabled: ENABLED_SOURCES.length,
      live: liveSources,
      failing: failingSources,
      detail: enabledSources,
    },
    events: {
      total: eventCount,
      inserted_24h: inserted24h,
    },
    safe_mode: safeMode,
    degraded_reasons: degradedReasons,
    errors,
    latency_ms: latencyMs,
    // Legacy aliases for backward compat
    dbOk, redisOk, ingestOk, lastIngestAt, eventCount, safeMode,
    enabledSources,
    versionSha,
    latencyMs,
  }

  return Response.json(body, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
