/**
 * Redis cache layer — fault-tolerant.
 * Client is created lazily so a bad URL doesn't crash module imports.
 * All functions return safe defaults on error — Redis is never required for correctness.
 */
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null
let _initError: string | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  if (_initError) return null

  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']

  if (!url || !token) {
    _initError = 'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN'
    console.warn('[redis] ' + _initError)
    return null
  }

  if (!url.startsWith('https://')) {
    _initError = `Invalid Redis URL (must start with https://): ${url.slice(0, 30)}...`
    console.warn('[redis] ' + _initError)
    return null
  }

  try {
    _redis = new Redis({ url, token })
    return _redis
  } catch (e) {
    _initError = String(e)
    console.warn('[redis] init error:', _initError)
    return null
  }
}

export function getRedisInitError(): string | null {
  getRedis() // ensure init attempted
  return _initError
}

// Cache TTLs (seconds)
export const TTL = {
  DASHBOARD: 60,
  FEED: 30,
  FORECAST: 300,
  MAP_CLUSTERS: 60,
  MAP_EVENTS: 120,
  HOT_REGIONS: 120,
  SYSTEM_FLAGS: 10,
} as const

export async function isSafeMode(): Promise<boolean> {
  try {
    const r = getRedis()
    if (!r) return false // Redis down → assume NOT safe mode so jobs run
    const val = await r.get<string>('system:safe_mode')
    return !!val
  } catch {
    return false // Redis error → don't block jobs
  }
}

export async function setSafeMode(enabled: boolean): Promise<void> {
  const r = getRedis()
  if (!r) throw new Error('Redis unavailable')
  if (enabled) {
    await r.set('system:safe_mode', '1', { ex: 3600 })
  } else {
    await r.del('system:safe_mode')
  }
}

export async function getCachedSnapshot<T>(key: string): Promise<T | null> {
  try {
    const r = getRedis()
    if (!r) return null
    return await r.get<T>(`snapshot:${key}`)
  } catch {
    return null
  }
}

export async function setCachedSnapshot<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  try {
    const r = getRedis()
    if (!r) return
    await r.setex(`snapshot:${key}`, ttlSeconds, JSON.stringify(data))
  } catch {
    // Non-fatal — cache write failure is fine
  }
}

export async function deleteCachedSnapshot(key: string): Promise<void> {
  try {
    const r = getRedis()
    if (!r) return
    await r.del(`snapshot:${key}`)
  } catch {
    // Non-fatal — cache delete failure is fine
  }
}

export async function getSystemFlag(key: string): Promise<{ value: boolean; reason?: string; set_at?: string } | null> {
  try {
    const r = getRedis()
    if (!r) return null
    return await r.get<{ value: boolean; reason?: string; set_at?: string }>(`system:flag:${key}`)
  } catch {
    return null
  }
}

export async function setSystemFlag(key: string, value: boolean, setBy: string, reason: string, ttlSeconds?: number): Promise<void> {
  const r = getRedis()
  if (!r) throw new Error('Redis unavailable')
  const data = { value, set_by: setBy, reason, set_at: new Date().toISOString() }
  if (ttlSeconds) {
    await r.setex(`system:flag:${key}`, ttlSeconds, JSON.stringify(data))
  } else {
    await r.set(`system:flag:${key}`, JSON.stringify(data))
  }
}

// Health check — returns true if Redis is reachable
export async function pingRedis(): Promise<boolean> {
  try {
    const r = getRedis()
    if (!r) return false
    return (await r.ping()) === 'PONG'
  } catch {
    return false
  }
}
