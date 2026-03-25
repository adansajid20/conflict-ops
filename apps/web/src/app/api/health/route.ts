export const dynamic = 'force-dynamic'

import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const start = Date.now()
  let db_ok = false
  let last_ingest_at: string | null = null
  let last_error: string | null = null
  let event_count = 0

  try {
    const supabase = createServiceClient()
    const [healthCheck, lastEvent, lastLog] = await Promise.allSettled([
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('ingested_at').order('ingested_at', { ascending: false }).limit(1).single(),
      supabase.from('raw_ingest_log').select('fetched_at,source').order('fetched_at', { ascending: false }).limit(1).single(),
    ])

    if (healthCheck.status === 'fulfilled' && !healthCheck.value.error) {
      db_ok = true
      event_count = healthCheck.value.count ?? 0
    }

    if (lastEvent.status === 'fulfilled' && lastEvent.value.data) {
      last_ingest_at = lastEvent.value.data.ingested_at
    }

    if (lastLog.status === 'fulfilled' && lastLog.value.data) {
      last_ingest_at = last_ingest_at ?? lastLog.value.data.fetched_at
    }
  } catch (e) {
    last_error = String(e)
  }

  const build_sha = process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? 'local'
  const env = process.env['VERCEL_ENV'] ?? 'development'

  return Response.json({
    ok: db_ok,
    build_sha,
    env,
    db_ok,
    auth_ok: !!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    scheduler_ok: !!process.env['INNGEST_SIGNING_KEY'],
    redis_ok: !!process.env['UPSTASH_REDIS_REST_URL'],
    last_ingest_at,
    event_count,
    last_error,
    latency_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    }
  })
}
