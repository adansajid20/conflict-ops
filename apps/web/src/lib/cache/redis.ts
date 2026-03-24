import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

export const redis = new Redis({
  url: process.env['UPSTASH_REDIS_REST_URL']!,
  token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
})

// Rate limiter for API routes — 100 requests per 10 seconds per org
export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '10 s'),
  analytics: true,
})

// Cache TTLs (seconds)
export const TTL = {
  DASHBOARD: 60,
  FEED: 30,
  FORECAST: 300,
  MAP_CLUSTERS: 60,
  SYSTEM_FLAGS: 10,
} as const

export async function getSystemFlag(key: string): Promise<{ value: boolean; reason?: string; set_at?: string } | null> {
  try {
    const val = await redis.get<{ value: boolean; reason?: string; set_at?: string }>(`system:flag:${key}`)
    return val
  } catch {
    return null
  }
}

export async function setSystemFlag(
  key: string,
  value: boolean,
  setBy: string,
  reason: string,
  ttlSeconds?: number
): Promise<void> {
  const data = { value, set_by: setBy, reason, set_at: new Date().toISOString() }
  if (ttlSeconds) {
    await redis.setex(`system:flag:${key}`, ttlSeconds, JSON.stringify(data))
  } else {
    await redis.set(`system:flag:${key}`, JSON.stringify(data))
  }
}

export async function isSafeMode(): Promise<boolean> {
  const flag = await getSystemFlag('safe_mode')
  return flag?.value === true
}

// Get cached snapshot or null
export async function getCachedSnapshot<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(`snapshot:${key}`)
  } catch {
    return null
  }
}

// Set cached snapshot with TTL
export async function setCachedSnapshot<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.setex(`snapshot:${key}`, ttlSeconds, JSON.stringify(data))
  } catch {
    // Non-fatal — cache write failure
  }
}
