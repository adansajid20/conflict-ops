export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('role').eq('clerk_user_id', userId).single()
  if (!user || !['owner', 'admin'].includes(user.role ?? '')) {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  const t0 = Date.now()
  const checks: Record<string, { ok: boolean; latency_ms: number; detail?: string }> = {}

  // DB check
  const t1 = Date.now()
  try {
    const { count, error } = await supabase.from('events').select('id', { count: 'exact', head: true })
    checks['database'] = { ok: !error, latency_ms: Date.now() - t1, detail: error?.message ?? `${count} events` }
  } catch (e) {
    checks['database'] = { ok: false, latency_ms: Date.now() - t1, detail: String(e) }
  }

  // Redis check
  const t2 = Date.now()
  try {
    const redis = new Redis({
      url: process.env['UPSTASH_REDIS_REST_URL']!,
      token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
    })
    await redis.ping()
    checks['redis'] = { ok: true, latency_ms: Date.now() - t2 }
  } catch (e) {
    checks['redis'] = { ok: false, latency_ms: Date.now() - t2, detail: String(e) }
  }

  // Inngest check
  checks['inngest'] = {
    ok: !!process.env['INNGEST_SIGNING_KEY'] && !!process.env['INNGEST_EVENT_KEY'],
    latency_ms: 0,
    detail: process.env['INNGEST_SIGNING_KEY'] ? 'Keys configured' : 'Missing signing key',
  }

  // Gemini check
  checks['ai'] = {
    ok: !!process.env['GEMINI_API_KEY'],
    latency_ms: 0,
    detail: process.env['GEMINI_API_KEY'] ? 'Gemini 2.0 Flash configured' : 'Missing API key',
  }

  // Last ingest stats
  const { data: lastEvents } = await supabase
    .from('events')
    .select('ingested_at, source')
    .order('ingested_at', { ascending: false })
    .limit(5)

  const { data: sourceStats } = await supabase
    .from('events')
    .select('source')
    .gte('ingested_at', new Date(Date.now() - 24 * 3600000).toISOString())

  const sourceCounts: Record<string, number> = {}
  for (const e of (sourceStats ?? [])) {
    sourceCounts[e.source] = (sourceCounts[e.source] ?? 0) + 1
  }

  // Safe mode check
  let safeMode = false
  try {
    const redis = new Redis({ url: process.env['UPSTASH_REDIS_REST_URL']!, token: process.env['UPSTASH_REDIS_REST_TOKEN']! })
    safeMode = !!(await redis.get('system:safe_mode'))
  } catch {}

  return Response.json({
    ok: Object.values(checks).every(c => c.ok),
    checks,
    safe_mode: safeMode,
    last_events: lastEvents ?? [],
    source_counts_24h: sourceCounts,
    env: {
      vercel_env: process.env['VERCEL_ENV'] ?? 'local',
      build_sha: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? 'local',
      region: process.env['VERCEL_REGION'] ?? 'unknown',
    },
    total_latency_ms: Date.now() - t0,
    timestamp: new Date().toISOString(),
  })
}
