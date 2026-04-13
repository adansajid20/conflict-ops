import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function POST(req: Request) {
  const headerSecret = req.headers.get('x-internal-secret')
  if (headerSecret !== process.env.INTERNAL_SECRET) {
    const { userId } = await safeAuth()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const redis = getRedis()
  if (!redis) return NextResponse.json({ success: true, cleared: 0, warning: 'Redis not configured' })

  const patterns = ['ingest:*', 'markets:*', 'health:*', 'snapshot:markets:*']
  const keys = new Set<string>()

  for (const pattern of patterns) {
    let cursor = '0'
    do {
      const result = await redis.scan(cursor, { match: pattern, count: 200 }) as [string, string[]]
      cursor = result[0]
      for (const key of result[1] ?? []) keys.add(key)
    } while (cursor !== '0')
  }

  const keyList = [...keys]
  if (keyList.length) await redis.del(...keyList)

  return NextResponse.json({ success: true, cleared: keyList.length, keys: keyList })
}
