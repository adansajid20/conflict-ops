/**
 * Polymarket Prediction Market Integration
 * Source: polymarket.com CLOB API — public, no auth required
 * Attribution: "Prediction market data via Polymarket (polymarket.com)"
 *
 * Fetches open geopolitical markets
 * Real money markets = better calibrated than opinion polls
 */

const POLY_BASE = 'https://clob.polymarket.com'
const GAMMA_BASE = 'https://gamma-api.polymarket.com'

export type PolymarketEvent = {
  id: string
  title: string
  description: string
  outcomes: Array<{
    title: string
    price: number  // 0-1 (real money probability)
  }>
  volume_24hr: number
  volume_total: number
  end_date: string
  market_url: string
  is_active: boolean
}

export type PolymarketResult = {
  events: PolymarketEvent[]
  fetched: number
}

const GEOPOLIT_KEYWORDS = ['war', 'conflict', 'military', 'invasion', 'attack', 'nuclear',
  'nato', 'russia', 'ukraine', 'china', 'taiwan', 'iran', 'israel', 'sanctions', 'coup', 'election']

export async function fetchPolymarketEvents(limit = 30): Promise<PolymarketResult> {
  const events: PolymarketEvent[] = []

  try {
    const res = await fetch(`${GAMMA_BASE}/events?limit=${limit}&active=true&closed=false`, {
      headers: { 'User-Agent': 'ConflictOps/1.0' },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return { events: [], fetched: 0 }

    const data = await res.json() as Array<Record<string, unknown>>

    for (const event of data) {
      const title = String(event['title'] ?? '').toLowerCase()
      const isGeopolit = GEOPOLIT_KEYWORDS.some(kw => title.includes(kw))
      if (!isGeopolit) continue

      const markets = (event['markets'] as Array<Record<string, unknown>>) ?? []
      const outcomes = markets.map(m => ({
        title: String(m['question'] ?? m['outcomePrices'] ?? ''),
        price: parseFloat(String(m['bestAsk'] ?? m['lastTradePrice'] ?? '0.5')),
      }))

      events.push({
        id: String(event['id']),
        title: String(event['title'] ?? ''),
        description: String(event['description'] ?? ''),
        outcomes,
        volume_24hr: Number(event['volume24hr'] ?? 0),
        volume_total: Number(event['volume'] ?? 0),
        end_date: String(event['endDate'] ?? ''),
        market_url: `https://polymarket.com/event/${event['slug'] ?? event['id']}`,
        is_active: Boolean(event['active']),
      })
    }
  } catch {
    // non-critical
  }

  return { events, fetched: events.length }
}
