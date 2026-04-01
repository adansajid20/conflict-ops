import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'

export type DoctorStatus = 'ok' | 'warn' | 'error'

export type DoctorCheck = {
  name: string
  status: DoctorStatus
  value: number | string
  threshold: string
  message: string
  details?: Record<string, unknown>
}

const DEFAULT_SOURCES = ['gdelt', 'reliefweb', 'gdacs', 'unhcr', 'nasa_eonet', 'news_rss', 'usgs', 'noaa', 'acled']

function getRedisClient(): Redis | null {
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getStatusFromLatency(ms: number): DoctorStatus {
  if (ms > 1500) return 'error'
  if (ms > 700) return 'warn'
  return 'ok'
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function toISOString(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

function extractSourceTimestamps(payload: unknown): Record<string, string> {
  if (!payload || typeof payload !== 'object') return {}
  const objectPayload = payload as Record<string, unknown>
  const candidates = ['sources', 'ingest_sources', 'last_seen', 'source_timestamps']

  for (const key of candidates) {
    const candidate = objectPayload[key]
    if (!candidate || typeof candidate !== 'object') continue
    const out: Record<string, string> = {}
    for (const [source, value] of Object.entries(candidate as Record<string, unknown>)) {
      const iso = toISOString(value)
      if (iso) out[source] = iso
    }
    if (Object.keys(out).length > 0) return out
  }

  const out: Record<string, string> = {}
  for (const [source, value] of Object.entries(objectPayload)) {
    const iso = toISOString(value)
    if (iso) out[source] = iso
  }
  return out
}

export async function checkAPILatency(): Promise<DoctorCheck> {
  const supabase = createServiceClient()

  try {
    const { error: probeError } = await supabase.from('api_logs').select('response_time_ms').limit(1)
    if (probeError) {
      const missingTable = probeError.message.toLowerCase().includes('does not exist') || probeError.message.toLowerCase().includes('could not find')
      if (missingTable) {
        return {
          name: 'API Latency',
          status: 'ok',
          value: 'n/a',
          threshold: 'p95 < 2000ms',
          message: 'api_logs table not available yet; skipping percentile check.',
        }
      }
      throw probeError
    }

    const { data, error } = await supabase
      .from('api_logs')
      .select('response_time_ms, created_at')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const values = (data ?? [])
      .map((row) => parseNumber((row as Record<string, unknown>)['response_time_ms']))
      .filter((row): row is number => row !== null)
      .sort((a, b) => a - b)

    if (values.length === 0) {
      return {
        name: 'API Latency',
        status: 'ok',
        value: 'n/a',
        threshold: 'p95 < 2000ms',
        message: 'No recent api_logs samples found.',
      }
    }

    const p50 = values[Math.floor(values.length * 0.5)] ?? values[0] ?? 0
    const p95 = values[Math.floor(values.length * 0.95)] ?? values[values.length - 1] ?? 0
    const status: DoctorStatus = p95 > 2000 ? 'error' : p95 > 1000 ? 'warn' : 'ok'

    return {
      name: 'API Latency',
      status,
      value: `p50 ${Math.round(p50)}ms / p95 ${Math.round(p95)}ms`,
      threshold: 'warn > 1000ms, error > 2000ms',
      message: `${values.length} recent API samples analysed.`,
      details: { p50, p95, samples: values.length },
    }
  } catch (error) {
    return {
      name: 'API Latency',
      status: 'warn',
      value: 'unavailable',
      threshold: 'p95 < 2000ms',
      message: error instanceof Error ? error.message : 'Unable to inspect API latency.',
    }
  }
}

export async function checkDBPool(): Promise<DoctorCheck> {
  const supabase = createServiceClient()
  const started = Date.now()

  try {
    const { error } = await supabase.from('system_flags').select('key').limit(1)
    if (error) throw error

    const latencyMs = Date.now() - started
    return {
      name: 'DB Pool',
      status: getStatusFromLatency(latencyMs),
      value: latencyMs,
      threshold: 'warn > 700ms, error > 1500ms',
      message: `Supabase connectivity probe completed in ${latencyMs}ms.`,
      details: { latency_ms: latencyMs },
    }
  } catch (error) {
    return {
      name: 'DB Pool',
      status: 'error',
      value: 'down',
      threshold: 'successful probe',
      message: error instanceof Error ? error.message : 'Database connectivity probe failed.',
    }
  }
}

export async function checkCacheHitRate(): Promise<DoctorCheck> {
  const redis = getRedisClient()
  if (!redis) {
    return {
      name: 'Cache Hit Rate',
      status: 'ok',
      value: 'n/a',
      threshold: 'warn < 50%, error < 20%',
      message: 'Redis is not configured; skipping cache stats.',
    }
  }

  try {
    const infoCapableRedis = redis as Redis & { info: (section?: string) => Promise<string> }
    const info = await infoCapableRedis.info('stats')
    const lines = String(info).split('\n')
    const stats = new Map<string, string>()
    for (const line of lines) {
      const [key, ...rest] = line.split(':')
      if (!key || rest.length === 0) continue
      stats.set(key.trim(), rest.join(':').trim())
    }

    const hits = Number.parseFloat(stats.get('keyspace_hits') ?? '0')
    const misses = Number.parseFloat(stats.get('keyspace_misses') ?? '0')
    const total = hits + misses
    const hitRate = total > 0 ? Math.round((hits / total) * 1000) / 10 : 100
    const status: DoctorStatus = hitRate < 20 ? 'error' : hitRate < 50 ? 'warn' : 'ok'

    return {
      name: 'Cache Hit Rate',
      status,
      value: `${hitRate}%`,
      threshold: 'warn < 50%, error < 20%',
      message: `Redis reported ${Math.round(hits)} hits and ${Math.round(misses)} misses.`,
      details: { hit_rate: hitRate, keyspace_hits: hits, keyspace_misses: misses },
    }
  } catch (error) {
    return {
      name: 'Cache Hit Rate',
      status: 'warn',
      value: 'unavailable',
      threshold: 'warn < 50%, error < 20%',
      message: error instanceof Error ? error.message : 'Redis INFO stats unavailable.',
    }
  }
}

export async function checkIngestJobHealth(): Promise<DoctorCheck> {
  const redis = getRedisClient()
  if (!redis) {
    return {
      name: 'Ingest Job Health',
      status: 'warn',
      value: 'redis unavailable',
      threshold: 'warn > 30m, error > 2h',
      message: 'Redis not configured; cannot inspect ingest source heartbeat flags.',
    }
  }

  try {
    const payload = await redis.get<unknown>('system_flags')
    const timestamps = extractSourceTimestamps(payload)
    const sources = Object.keys(timestamps).length > 0 ? Object.keys(timestamps) : DEFAULT_SOURCES
    const now = Date.now()
    const warnSources: string[] = []
    const errorSources: string[] = []

    for (const source of sources) {
      const ts = timestamps[source]
      const ageMs = ts ? now - new Date(ts).getTime() : Number.POSITIVE_INFINITY
      if (ageMs > 2 * 60 * 60 * 1000) errorSources.push(source)
      else if (ageMs > 30 * 60 * 1000) warnSources.push(source)
    }

    const status: DoctorStatus = errorSources.length > 0 ? 'error' : warnSources.length > 0 ? 'warn' : 'ok'
    const value = status === 'ok' ? 'all sources fresh' : `${errorSources.length} error / ${warnSources.length} warn`

    return {
      name: 'Ingest Job Health',
      status,
      value,
      threshold: 'warn > 30m, error > 2h',
      message: status === 'ok'
        ? 'All tracked ingest source heartbeats are fresh.'
        : `Delayed sources: ${[...errorSources, ...warnSources].join(', ')}`,
      details: { source_timestamps: timestamps, delayed_sources: warnSources, failed_sources: errorSources },
    }
  } catch (error) {
    return {
      name: 'Ingest Job Health',
      status: 'warn',
      value: 'unavailable',
      threshold: 'warn > 30m, error > 2h',
      message: error instanceof Error ? error.message : 'Unable to read ingest heartbeats.',
    }
  }
}

export async function checkSourceHealth(): Promise<DoctorCheck> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase
      .from('events')
      .select('source, ingested_at')
      .gte('ingested_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(2000)

    if (error) throw error

    const counts = new Map<string, number>()
    for (const source of DEFAULT_SOURCES) counts.set(source, 0)
    for (const row of data ?? []) {
      const source = String((row as Record<string, unknown>)['source'] ?? '')
      if (!source) continue
      counts.set(source, (counts.get(source) ?? 0) + 1)
    }

    const zeroSources = [...counts.entries()].filter(([, count]) => count === 0).map(([source]) => source)
    const status: DoctorStatus = zeroSources.length > 2 ? 'error' : zeroSources.length > 0 ? 'warn' : 'ok'

    return {
      name: 'Source Health',
      status,
      value: `${counts.size - zeroSources.length}/${counts.size} active`,
      threshold: 'all tracked sources > 0 events in last hour',
      message: zeroSources.length > 0 ? `Zero-event sources: ${zeroSources.join(', ')}` : 'Every tracked source produced at least one event in the last hour.',
      details: { counts: Object.fromEntries(counts), zero_sources: zeroSources },
    }
  } catch (error) {
    return {
      name: 'Source Health',
      status: 'warn',
      value: 'unavailable',
      threshold: 'all tracked sources > 0 events in last hour',
      message: error instanceof Error ? error.message : 'Unable to evaluate source health.',
    }
  }
}

export async function checkQueueDepth(): Promise<DoctorCheck> {
  const signingKey = process.env['INNGEST_SIGNING_KEY']
  const appId = process.env['INNGEST_APP_ID']
  const unavailable: DoctorCheck = {
    name: 'Queue Depth',
    status: 'ok',
    value: 'unavailable',
    threshold: 'n/a',
    message: 'Inngest API not reachable — check INNGEST_SIGNING_KEY',
  }

  if (!signingKey || !appId) {
    console.warn('[doctor] Inngest queue depth unavailable — missing INNGEST_SIGNING_KEY or INNGEST_APP_ID')
    return unavailable
  }

  try {
    const response = await fetch(`https://api.inngest.com/v1/events?app_id=${encodeURIComponent(appId)}`, {
      headers: { Authorization: `Bearer ${signingKey}` },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Inngest API returned ${response.status}`)
    }

    const data = await response.json() as Record<string, unknown>
    const queueDepth = parseNumber(data['count']) ?? parseNumber(data['queue_depth']) ?? parseNumber(data['backlog'])
    if (queueDepth === null) {
      console.warn('[doctor] Inngest queue depth unavailable — unexpected response shape')
      return { ...unavailable, details: data }
    }

    const status: DoctorStatus = queueDepth > 500 ? 'error' : queueDepth > 100 ? 'warn' : 'ok'
    return {
      name: 'Queue Depth',
      status,
      value: queueDepth,
      threshold: 'warn > 100, error > 500',
      message: `Inngest backlog reported as ${queueDepth}.`,
      details: data,
    }
  } catch (error) {
    console.warn('[doctor] Inngest queue depth unavailable:', error)
    return unavailable
  }
}

export async function checkAISpend(): Promise<DoctorCheck> {
  const redis = getRedisClient()
  if (!redis) {
    return {
      name: 'AI Spend',
      status: 'ok',
      value: '$0',
      threshold: 'warn > $5, error > $20',
      message: 'Redis not configured; AI spend counter unavailable.',
    }
  }

  try {
    const raw = await redis.get<unknown>('ai_spend_today')
    const spend = parseNumber(raw) ?? 0
    const status: DoctorStatus = spend > 20 ? 'error' : spend > 5 ? 'warn' : 'ok'
    return {
      name: 'AI Spend',
      status,
      value: `$${spend.toFixed(2)}`,
      threshold: 'warn > $5, error > $20',
      message: `Heavy lane spend today is $${spend.toFixed(2)}.`,
      details: { spend },
    }
  } catch (error) {
    return {
      name: 'AI Spend',
      status: 'warn',
      value: 'unavailable',
      threshold: 'warn > $5, error > $20',
      message: error instanceof Error ? error.message : 'Unable to read AI spend counter.',
    }
  }
}

export async function checkSafeMode(): Promise<DoctorCheck> {
  const supabase = createServiceClient()

  try {
    const { data, error } = await supabase.from('system_flags').select('value, set_at').eq('key', 'safe_mode').single()
    if (error) {
      const notFound = error.message.toLowerCase().includes('no rows')
      if (notFound) {
        return {
          name: 'Safe Mode',
          status: 'ok',
          value: 'off',
          threshold: 'should remain off during normal ops',
          message: 'Safe mode flag is not set.',
        }
      }
      throw error
    }

    const value = (data?.value ?? null) as { enabled?: boolean; value?: boolean } | null
    const enabled = Boolean(value?.enabled ?? value?.value)
    return {
      name: 'Safe Mode',
      status: enabled ? 'warn' : 'ok',
      value: enabled ? 'on' : 'off',
      threshold: 'warn when enabled',
      message: enabled ? `Safe mode enabled at ${data?.set_at ?? 'unknown time'}.` : 'Safe mode inactive.',
      details: { set_at: data?.set_at ?? null },
    }
  } catch (error) {
    return {
      name: 'Safe Mode',
      status: 'warn',
      value: 'unknown',
      threshold: 'warn when enabled',
      message: error instanceof Error ? error.message : 'Unable to read safe mode flag.',
    }
  }
}

export async function runDoctorChecks(): Promise<DoctorCheck[]> {
  return Promise.all([
    checkAPILatency(),
    checkDBPool(),
    checkCacheHitRate(),
    checkIngestJobHealth(),
    checkSourceHealth(),
    checkQueueDepth(),
    checkAISpend(),
    checkSafeMode(),
  ])
}
