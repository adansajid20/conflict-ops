import { createServiceClient } from '@/lib/supabase/server'

export type PredictionMarketRow = {
  external_id: string
  platform: 'metaculus' | 'polymarket'
  title: string
  probability: number | null
  resolution_date: string | null
  linked_region: string | null
  url: string | null
  metadata: Record<string, unknown>
}

const REGION_KEYWORDS = [
  ['ukraine', 'Ukraine'], ['russia', 'Russia'], ['gaza', 'Gaza'], ['israel', 'Israel'], ['iran', 'Iran'], ['syria', 'Syria'],
  ['taiwan', 'Taiwan'], ['china', 'China'], ['sudan', 'Sudan'], ['yemen', 'Yemen'], ['red sea', 'Red Sea'], ['lebanon', 'Lebanon'], ['sahel', 'Sahel'], ['north korea', 'Korean Peninsula'],
] as const

function matchRegion(title: string): string | null {
  const lower = title.toLowerCase()
  const found = REGION_KEYWORDS.find(([kw]) => lower.includes(kw))
  return found ? found[1] : null
}

export async function fetchPredictionMarkets(): Promise<PredictionMarketRow[]> {
  const rows: PredictionMarketRow[] = []
  try {
    const res = await fetch('https://www.metaculus.com/api2/questions/?status=open&format=json', { headers: { 'User-Agent': 'ConflictOps/1.0' }, signal: AbortSignal.timeout(12000) })
    if (res.ok) {
      const json = await res.json() as { results?: Array<Record<string, unknown>> }
      for (const item of json.results ?? []) {
        const predObj = item['community_prediction'] as Record<string, unknown> | null
        const full = predObj && typeof predObj['full'] === 'object' ? predObj['full'] as Record<string, unknown> : null
        const q2 = full && typeof full['q2'] === 'number' ? full['q2'] : null
        const title = String(item['title'] ?? '')
        rows.push({
          external_id: `metaculus:${String(item['id'] ?? '')}`,
          platform: 'metaculus',
          title,
          probability: q2,
          resolution_date: typeof item['resolve_time'] === 'string' ? item['resolve_time'] : null,
          linked_region: matchRegion(title),
          url: `https://www.metaculus.com/questions/${String(item['id'] ?? '')}/`,
          metadata: { source: 'metaculus', raw_id: item['id'] ?? null },
        })
      }
    } else {
      console.warn('Metaculus fetch failed:', res.status)
    }
  } catch (error) { console.warn('Metaculus fetch failed:', error) }

  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?limit=100&active=true&closed=false', { headers: { 'User-Agent': 'ConflictOps/1.0' }, signal: AbortSignal.timeout(12000) })
    if (res.ok) {
      const json = await res.json() as Array<Record<string, unknown>>
      for (const item of json) {
        const title = String(item['title'] ?? '')
        const markets = Array.isArray(item['markets']) ? item['markets'] as Array<Record<string, unknown>> : []
        const firstMarket = markets[0]
        const probability = firstMarket && typeof firstMarket['lastTradePrice'] === 'number'
          ? firstMarket['lastTradePrice']
          : firstMarket && typeof firstMarket['bestAsk'] === 'number'
          ? firstMarket['bestAsk']
          : null
        rows.push({
          external_id: `polymarket:${String(item['id'] ?? '')}`,
          platform: 'polymarket',
          title,
          probability,
          resolution_date: typeof item['endDate'] === 'string' ? item['endDate'] : null,
          linked_region: matchRegion(title),
          url: `https://polymarket.com/event/${String(item['slug'] ?? item['id'] ?? '')}`,
          metadata: { source: 'polymarket', slug: item['slug'] ?? null },
        })
      }
    } else {
      console.warn('Polymarket fetch failed:', res.status)
    }
  } catch (error) { console.warn('Polymarket fetch failed:', error) }

  return rows
}

export async function syncPredictionMarkets(): Promise<PredictionMarketRow[]> {
  const rows = await fetchPredictionMarkets()
  if (rows.length === 0) return rows
  const supabase = createServiceClient()
  await supabase.from('prediction_markets').upsert(rows, { onConflict: 'external_id' })
  return rows
}
