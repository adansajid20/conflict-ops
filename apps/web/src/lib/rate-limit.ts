/**
 * Simple rate limiter using Upstash Redis.
 * Falls back to deny requests if Redis is unavailable (fail-closed).
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (!url || !token) return null
  try {
    _redis = new Redis({ url, token })
    return _redis
  } catch {
    return null
  }
}

// Pre-built rate limiters for different tiers
const limiters: Record<string, Ratelimit | null> = {}

function getLimiter(prefix: string, maxRequests: number, windowSeconds: number): Ratelimit | null {
  const key = `${prefix}:${maxRequests}:${windowSeconds}`
  if (limiters[key] !== undefined) return limiters[key]
  const redis = getRedis()
  if (!redis) { limiters[key] = null; return null }
  limiters[key] = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix: `rl:${prefix}`,
    analytics: false,
  })
  return limiters[key]
}

export type RateLimitResult = { allowed: boolean; remaining: number; reset: number }

/**
 * Check rate limit for a given identifier.
 * Returns { allowed: false } if Redis unavailable (fail-closed).
 */
export async function checkRateLimit(
  identifier: string,
  prefix: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const limiter = getLimiter(prefix, maxRequests, windowSeconds)
    if (!limiter) return { allowed: false, remaining: 0, reset: 0 }
    const { success, remaining, reset } = await limiter.limit(identifier)
    return { allowed: success, remaining, reset }
  } catch {
    // Fail closed if Redis errors
    return { allowed: false, remaining: 0, reset: 0 }
  }
}

// Convenience presets
export const AI_RATE_LIMIT = { prefix: 'ai', maxRequests: 20, windowSeconds: 60 } as const
export const AI_HEAVY_RATE_LIMIT = { prefix: 'ai-heavy', maxRequests: 5, windowSeconds: 60 } as const
export const REPORT_RATE_LIMIT = { prefix: 'report-gen', maxRequests: 3, windowSeconds: 300 } as const
