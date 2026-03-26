import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { fetchMetaculusQuestions } from '@/lib/markets/metaculus'
import { fetchPolymarketEvents } from '@/lib/markets/polymarket'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'

const DEMO_DATA = {
  metaculus: [
    { id: 1001, title: 'Will Russia capture Kharkiv in 2026?', community_prediction: 0.18, close_time: '2026-12-31T00:00:00.000Z', page_url: 'https://www.metaculus.com/' },
    { id: 1002, title: 'Will there be a ceasefire in Gaza before June 2026?', community_prediction: 0.34, close_time: '2026-06-01T00:00:00.000Z', page_url: 'https://www.metaculus.com/' },
    { id: 1003, title: 'Will Iran conduct a direct military strike on Israel in 2026?', community_prediction: 0.22, close_time: '2026-12-31T00:00:00.000Z', page_url: 'https://www.metaculus.com/' },
    { id: 1004, title: 'Will Sudan conflict fatalities exceed 25,000 additional deaths in 2026?', community_prediction: 0.41, close_time: '2026-12-31T00:00:00.000Z', page_url: 'https://www.metaculus.com/' },
    { id: 1005, title: 'Will a major Taiwan Strait military crisis occur before 2027?', community_prediction: 0.29, close_time: '2026-12-31T00:00:00.000Z', page_url: 'https://www.metaculus.com/' },
  ],
  polymarket: [
    { id: 'pm-1001', title: 'Will Hezbollah-Israel fighting expand into a regional war in 2026?', outcomes: [{ title: 'Yes', price: 0.27 }, { title: 'No', price: 0.73 }], volume_24hr: 12400, market_url: 'https://polymarket.com/' },
    { id: 'pm-1002', title: 'Will shipping disruption in the Red Sea materially worsen this quarter?', outcomes: [{ title: 'Yes', price: 0.46 }, { title: 'No', price: 0.54 }], volume_24hr: 9800, market_url: 'https://polymarket.com/' },
    { id: 'pm-1003', title: 'Will North Korea conduct another ICBM test before Q4 2026?', outcomes: [{ title: 'Yes', price: 0.58 }, { title: 'No', price: 0.42 }], volume_24hr: 8600, market_url: 'https://polymarket.com/' },
    { id: 'pm-1004', title: 'Will Ukraine receive new long-range strike approvals this year?', outcomes: [{ title: 'Yes', price: 0.63 }, { title: 'No', price: 0.37 }], volume_24hr: 11750, market_url: 'https://polymarket.com/' },
    { id: 'pm-1005', title: 'Will a Niger/Burkina Faso security bloc deploy across a border crisis zone in 2026?', outcomes: [{ title: 'Yes', price: 0.31 }, { title: 'No', price: 0.69 }], volume_24hr: 5400, market_url: 'https://polymarket.com/' },
  ],
  fetched_at: new Date().toISOString(),
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const source = url.searchParams.get('source') ?? 'all'
  const cacheKey = `markets:questions:${source}`

  const cached = await getCachedSnapshot<typeof DEMO_DATA>(cacheKey)
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

  const finalData = data.metaculus.length || data.polymarket.length ? data : DEMO_DATA
  await setCachedSnapshot(cacheKey, finalData, 3600)
  return NextResponse.json({ success: true, data: finalData, meta: { demo: finalData === DEMO_DATA } })
}
