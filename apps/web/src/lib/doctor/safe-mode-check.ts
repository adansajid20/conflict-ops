import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'

const CACHE_KEY = 'doctor:safe_mode'
const CACHE_TTL_SECONDS = 60

function getRedisClient(): Redis | null {
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function isSafeMode(): Promise<boolean> {
  const redis = getRedisClient()

  try {
    const cached = redis ? await redis.get<string>(CACHE_KEY) : null
    if (cached === '1') return true
    if (cached === '0') return false
  } catch {
    // cache miss path
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('system_flags').select('value').eq('key', 'safe_mode').single()
    if (error) {
      const notFound = error.message.toLowerCase().includes('no rows')
      if (!notFound) throw error
      if (redis) await redis.set(CACHE_KEY, '0', { ex: CACHE_TTL_SECONDS })
      return false
    }

    const value = (data?.value ?? null) as { enabled?: boolean; value?: boolean } | null
    const enabled = Boolean(value?.enabled ?? value?.value)
    if (redis) await redis.set(CACHE_KEY, enabled ? '1' : '0', { ex: CACHE_TTL_SECONDS })
    return enabled
  } catch {
    return false
  }
}
