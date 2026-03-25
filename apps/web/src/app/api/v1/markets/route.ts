import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { fetchMetaculusQuestions } from '@/lib/markets/metaculus'
import { fetchPolymarketEvents } from '@/lib/markets/polymarket'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const source = url.searchParams.get('source') ?? 'all'

  const cacheKey = `markets:${source}`
  const cached = await getCachedSnapshot(cacheKey)
  if (cached) return NextResponse.json({ success: true, data: cached, meta: { cached: true } })

  const [metaculus, polymarket] = await Promise.allSettled([
    source !== 'polymarket' ? fetchMetaculusQuestions(30) : Promise.resolve({ questions: [], fetched: 0 }),
    source !== 'metaculus' ? fetchPolymarketEvents(20) : Promise.resolve({ events: [], fetched: 0 }),
  ])

  const data = {
    metaculus: metaculus.status === 'fulfilled' ? metaculus.value.questions : [],
    polymarket: polymarket.status === 'fulfilled' ? polymarket.value.events : [],
    fetched_at: new Date().toISOString(),
  }

  await setCachedSnapshot(cacheKey, data, 240) // 4 hour cache
  return NextResponse.json({ success: true, data })
}
