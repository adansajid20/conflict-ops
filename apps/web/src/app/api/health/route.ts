export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase/server'
import { pingRedis, isSafeMode, getRedisInitError } from '@/lib/cache/redis'

const ENABLED_SOURCES = ['gdelt', 'reliefweb', 'gdacs', 'unhcr', 'nasa-eonet']

export async function GET() {
  const start = Date.now()
  const errors: string[] = []

  let dbOk = false
  let redisOk = false
  let safeMode = false
  let lastIngestAt: string | null = null
  let eventCount = 0
  let sourcesLastSeen: Record<string, string | null> = {}

  // --- DB check ---
  try {
    const supabase = createServiceClient()
    const [countResult, lastIngestResult, sourceResult] = await Promise.allSettled([
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('ingested_at').order('ingested_at', { ascending: false }).limit(1).single(),
      supabase.from('events').select('source, ingested_at').order('ingested_at', { ascending: false }).limit(100),
    ])

    if (countResult.status === 'fulfilled' && !countResult.value.error) {
      dbOk = true
      eventCount = countResult.value.count ?? 0
    } else {
      const msg = countResult.status === 'rejected' ? String(countResult.reason) : countResult.value.error?.message
      errors.push(`db: ${msg}`)
    }

    if (lastIngestResult.status === 'fulfilled' && lastIngestResult.value.data) {
      lastIngestAt = lastIngestResult.value.data.ingested_at
    }

    if (sourceResult.status === 'fulfilled' && sourceResult.value.data) {
      for (const row of (sourceResult.value.data as Array<{ source: string; ingested_at: string }>)) {
        if (!sourcesLastSeen[row.source]) sourcesLastSeen[row.source] = row.ingested_at
      }
    }
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
  if (!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']) missingEnvs.push('CLERK_PUBLISHABLE_KEY')
  if (!process.env['INNGEST_SIGNING_KEY']) missingEnvs.push('INNGEST_SIGNING_KEY')
  if (!process.env['GEMINI_API_KEY']) missingEnvs.push('GEMINI_API_KEY')
  if (missingEnvs.length > 0) errors.push(`missing_env: ${missingEnvs.join(', ')}`)

  const ingestAgeMs = lastIngestAt ? Date.now() - new Date(lastIngestAt).getTime() : Infinity
  const ingestOk = isFinite(ingestAgeMs) && ingestAgeMs < 2 * 3600 * 1000

  const enabledSources = ENABLED_SOURCES.map(source => {
    const lastSeen = sourcesLastSeen[source] ?? null
    const ageMs = lastSeen ? Date.now() - new Date(lastSeen).getTime() : Infinity
    return { name: source, ok: isFinite(ageMs) && ageMs < 3 * 3600 * 1000, last_seen_at: lastSeen, stale: !isFinite(ageMs) || ageMs > 3 * 3600 * 1000 }
  })

  // Health ok = db works AND no critical errors (Redis optional)
  const ok = dbOk && errors.filter(e => e.startsWith('db:')).length === 0

  return Response.json({
    ok,
    versionSha: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? 'local',
    timestamp: new Date().toISOString(),
    dbOk, redisOk,
    authOk: !!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    schedulerOk: !!process.env['INNGEST_SIGNING_KEY'],
    ingestOk, lastIngestAt, eventCount, safeMode,
    enabledSources, errors,
    latencyMs: Date.now() - start,
    // legacy aliases
    build_sha: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? 'local',
    env: process.env['VERCEL_ENV'] ?? 'development',
    db_ok: dbOk, auth_ok: !!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    scheduler_ok: !!process.env['INNGEST_SIGNING_KEY'], redis_ok: redisOk,
    last_ingest_at: lastIngestAt, event_count: eventCount, last_error: errors[0] ?? null,
    latency_ms: Date.now() - start,
  }, { headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } })
}
