import { SupabaseClient } from '@supabase/supabase-js'
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

// Country code to ISO 3166-1 alpha-2 mapping for correlation_signals
const COUNTRY_CODE_MAP: Record<string, string> = {
  ukraine: 'UA',
  russia: 'RU',
  gaza: 'PS',
  israel: 'IL',
  palestine: 'PS',
  taiwan: 'TW',
  china: 'CN',
  hong_kong: 'HK',
  north_korea: 'KP',
  korean_peninsula: 'KR',
  south_korea: 'KR',
  iran: 'IR',
  syria: 'SY',
  yemen: 'YE',
  iraq: 'IQ',
  afghanistan: 'AF',
  pakistan: 'PK',
  india: 'IN',
  venezuela: 'VE',
  sudan: 'SD',
  somalia: 'SO',
  myanmar: 'MM',
  ethiopia: 'ET',
  turkey: 'TR',
  lebanon: 'LB',
  sahel: 'ML',
  red_sea: 'ER',
}

const REGION_KEYWORDS = [
  ['ukraine', 'Ukraine'],
  ['russia', 'Russia'],
  ['gaza', 'Gaza'],
  ['israel', 'Israel'],
  ['iran', 'Iran'],
  ['syria', 'Syria'],
  ['taiwan', 'Taiwan'],
  ['china', 'China'],
  ['sudan', 'Sudan'],
  ['yemen', 'Yemen'],
  ['red sea', 'Red Sea'],
  ['lebanon', 'Lebanon'],
  ['sahel', 'Sahel'],
  ['north korea', 'Korean Peninsula'],
] as const

const REGION_TO_GEOPOLITICAL: Record<string, string> = {
  Ukraine: 'Eastern Europe',
  Russia: 'Eastern Europe',
  Gaza: 'Middle East',
  Israel: 'Middle East',
  Iran: 'Middle East',
  Syria: 'Middle East',
  Taiwan: 'Asia-Pacific',
  China: 'Asia-Pacific',
  Sudan: 'Africa',
  Yemen: 'Middle East',
  'Red Sea': 'Middle East',
  Lebanon: 'Middle East',
  Sahel: 'Africa',
  'Korean Peninsula': 'Asia-Pacific',
}

function matchRegion(title: string): string | null {
  const lower = title.toLowerCase()
  const found = REGION_KEYWORDS.find(([kw]) => lower.includes(kw))
  return found ? found[1] : null
}

function getCountryCode(title: string): string | null {
  const lower = title.toLowerCase()
  for (const [keyword, code] of Object.entries(COUNTRY_CODE_MAP)) {
    if (lower.includes(keyword)) {
      return code
    }
  }
  return null
}

/**
 * Fetch prediction market data from Polymarket and Metaculus
 * Returns raw rows for backward compatibility
 */
export async function fetchPredictionMarkets(): Promise<PredictionMarketRow[]> {
  const rows: PredictionMarketRow[] = []
  try {
    const res = await fetch('https://www.metaculus.com/api2/questions/?status=open&format=json', {
      headers: { 'User-Agent': 'ConflictOps/1.0' },
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      const json = (await res.json()) as { results?: Array<Record<string, unknown>> }
      for (const item of json.results ?? []) {
        const predObj = item['community_prediction'] as Record<string, unknown> | null
        const full =
          predObj && typeof predObj['full'] === 'object' ? (predObj['full'] as Record<string, unknown>) : null
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
  } catch (error) {
    console.warn('Metaculus fetch failed:', error)
  }

  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?limit=100&active=true&closed=false', {
      headers: { 'User-Agent': 'ConflictOps/1.0' },
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      const json = (await res.json()) as Array<Record<string, unknown>>
      for (const item of json) {
        const title = String(item['title'] ?? '')
        const markets = Array.isArray(item['markets'])
          ? (item['markets'] as Array<Record<string, unknown>>)
          : []
        const firstMarket = markets[0]
        const probability =
          firstMarket && typeof firstMarket['lastTradePrice'] === 'number'
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
  } catch (error) {
    console.warn('Polymarket fetch failed:', error)
  }

  return rows
}

/**
 * Sync prediction markets to the prediction_markets table
 */
export async function syncPredictionMarkets(): Promise<PredictionMarketRow[]> {
  const rows = await fetchPredictionMarkets()
  if (rows.length === 0) return rows
  const supabase = createServiceClient()
  await supabase.from('prediction_markets').upsert(rows, { onConflict: 'external_id' })
  return rows
}

/**
 * Fetch prediction markets with correlation signal storage
 * Fetches from Polymarket and Metaculus, maps to countries/regions, and stores as intelligence signals
 * Handles API failures gracefully - if one source fails, continues with others
 */
export async function fetchPredictionMarketsWithSignals(
  supabase: SupabaseClient,
): Promise<{
  stored: number
  sources: { polymarket: number; metaculus: number }
  errors: string[]
}> {
  const errors: string[] = []
  const sourceStats = { polymarket: 0, metaculus: 0 }
  let totalStored = 0

  // Fetch Metaculus data
  const metaculusRows: PredictionMarketRow[] = []
  try {
    const res = await fetch('https://www.metaculus.com/api2/questions/?status=open&format=json', {
      headers: { 'User-Agent': 'ConflictOps/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const json = (await res.json()) as { results?: Array<Record<string, unknown>> }
      for (const item of json.results ?? []) {
        const predObj = item['community_prediction'] as Record<string, unknown> | null
        const full =
          predObj && typeof predObj['full'] === 'object' ? (predObj['full'] as Record<string, unknown>) : null
        const q2 = full && typeof full['q2'] === 'number' ? full['q2'] : null
        if (q2 === null || q2 === undefined) continue

        const title = String(item['title'] ?? '')
        const countryCode = getCountryCode(title)
        if (!countryCode) continue

        metaculusRows.push({
          external_id: `metaculus:${String(item['id'] ?? '')}`,
          platform: 'metaculus',
          title,
          probability: q2,
          resolution_date: typeof item['resolve_time'] === 'string' ? item['resolve_time'] : null,
          linked_region: matchRegion(title),
          url: `https://www.metaculus.com/questions/${String(item['id'] ?? '')}/`,
          metadata: { source: 'metaculus', raw_id: item['id'] ?? null, country_code: countryCode },
        })
      }
      sourceStats.metaculus = metaculusRows.length
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    errors.push(`Metaculus fetch failed: ${msg}`)
  }

  // Fetch Polymarket data
  const polymarketRows: PredictionMarketRow[] = []
  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?limit=100&active=true&closed=false', {
      headers: { 'User-Agent': 'ConflictOps/1.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const json = (await res.json()) as Array<Record<string, unknown>>
      for (const item of json) {
        const title = String(item['title'] ?? '')
        const countryCode = getCountryCode(title)
        if (!countryCode) continue

        const markets = Array.isArray(item['markets'])
          ? (item['markets'] as Array<Record<string, unknown>>)
          : []
        const firstMarket = markets[0]
        const probability =
          firstMarket && typeof firstMarket['lastTradePrice'] === 'number'
            ? firstMarket['lastTradePrice']
            : firstMarket && typeof firstMarket['bestAsk'] === 'number'
              ? firstMarket['bestAsk']
              : null

        if (probability === null) continue

        polymarketRows.push({
          external_id: `polymarket:${String(item['id'] ?? '')}`,
          platform: 'polymarket',
          title,
          probability,
          resolution_date: typeof item['endDate'] === 'string' ? item['endDate'] : null,
          linked_region: matchRegion(title),
          url: `https://polymarket.com/event/${String(item['slug'] ?? item['id'] ?? '')}`,
          metadata: { source: 'polymarket', slug: item['slug'] ?? null, country_code: countryCode },
        })
      }
      sourceStats.polymarket = polymarketRows.length
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    errors.push(`Polymarket fetch failed: ${msg}`)
  }

  // Store all rows in correlation_signals
  const allRows = [...metaculusRows, ...polymarketRows]
  if (allRows.length > 0) {
    const signals = allRows.map((row) => {
      const countryCode = (row.metadata.country_code as string) || 'XX'
      return {
        country_code: countryCode,
        region: REGION_TO_GEOPOLITICAL[row.linked_region ?? ''] || 'Global',
        pattern_type: 'prediction_market',
        correlation_strength: row.probability ?? 0,
        source: row.platform,
        metadata: {
          market_id: row.external_id,
          question: row.title,
          resolution_date: row.resolution_date,
          url: row.url,
          ...row.metadata,
        },
        ingested_at: new Date().toISOString(),
      }
    })

    try {
      const { error, data } = await supabase
        .from('correlation_signals')
        .insert(signals)
        .select('id')

      if (error) {
        errors.push(`Supabase insert error: ${error.message}`)
      } else {
        totalStored = data?.length || 0
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      errors.push(`Supabase operation failed: ${msg}`)
    }
  }

  return {
    stored: totalStored,
    sources: sourceStats,
    errors: errors.filter((e) => e),
  }
}
