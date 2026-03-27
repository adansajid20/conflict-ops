/**
 * ReliefWeb Ingest — UN OCHA
 * Source: reliefweb.int — FREE, via rss2json.com proxy (reliefweb.int blocks cloud IPs via Cloudflare)
 * Attribution: "Powered by ReliefWeb (reliefweb.int)"
 */

import { createServiceClient } from '@/lib/supabase/server'

// rss2json proxies reliefweb RSS to bypass Cloudflare bot protection on cloud IPs
const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url='
const REPORTS_RSS = 'https://reliefweb.int/updates/rss.xml'
const DISASTERS_RSS = 'https://reliefweb.int/disasters/rss.xml'

function stripTags(input: string): string {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractCountry(html: string): string | null {
  // rss2json returns decoded HTML in description field
  const m = html.match(/Country:\s*([^<\n]+)/i)
  return m?.[1]?.trim() ?? null
}

function extractSourceName(html: string): string | null {
  const m = html.match(/Source:\s*([^<\n]+)/i)
  return m?.[1]?.trim() ?? null
}

function iso3ToIso2(iso3: string): string {
  const MAP: Record<string, string> = {
    UKR: 'UA', RUS: 'RU', SYR: 'SY', YEM: 'YE', SDN: 'SD', SSD: 'SS',
    ETH: 'ET', LBY: 'LY', IRQ: 'IQ', AFG: 'AF', MMR: 'MM', COD: 'CD',
    SOM: 'SO', MLI: 'ML', BFA: 'BF', NER: 'NE', CAF: 'CF', MOZ: 'MZ',
    NGA: 'NG', CMR: 'CM', PSE: 'PS', ISR: 'IL', LBN: 'LB', IRN: 'IR',
    PAK: 'PK', IND: 'IN', CHN: 'CN', TWN: 'TW', PRK: 'KP', COL: 'CO',
    VEN: 'VE', HTI: 'HT', MEX: 'MX', BRA: 'BR', GRC: 'GR', LKA: 'LK',
  }
  return MAP[iso3.toUpperCase()] ?? iso3.slice(0, 2).toUpperCase()
}

function countryNameToCode(country: string | null): string | null {
  if (!country) return null
  const MAP: Record<string, string> = {
    ukraine: 'UA', russia: 'RU', syria: 'SY', 'syrian arab republic': 'SY',
    yemen: 'YE', sudan: 'SD', 'south sudan': 'SS', ethiopia: 'ET', libya: 'LY',
    iraq: 'IQ', afghanistan: 'AF', myanmar: 'MM', 'dr congo': 'CD',
    'democratic republic of the congo': 'CD', somalia: 'SO', mali: 'ML',
    'burkina faso': 'BF', niger: 'NE', nigeria: 'NG', 'central african republic': 'CF',
    mozambique: 'MZ', palestine: 'PS', 'state of palestine': 'PS', israel: 'IL',
    lebanon: 'LB', iran: 'IR', 'iran (islamic republic of)': 'IR', pakistan: 'PK',
    taiwan: 'TW', mexico: 'MX', colombia: 'CO', venezuela: 'VE', haiti: 'HT',
    greece: 'GR', brazil: 'BR', kenya: 'KE', chad: 'TD', eritrea: 'ER',
    'south africa': 'ZA', zimbabwe: 'ZW', zambia: 'ZM', angola: 'AO',
    rwanda: 'RW', burundi: 'BI', tanzania: 'TZ', uganda: 'UG',
    egypt: 'EG', tunisia: 'TN', algeria: 'DZ', morocco: 'MA',
    indonesia: 'ID', philippines: 'PH', bangladesh: 'BD', nepal: 'NP',
  }
  return MAP[country.toLowerCase().trim()] ?? null
}

function getRegionFromCode(iso2: string | null): string {
  if (!iso2) return 'Global'
  const REGIONS: Record<string, string> = {
    UA: 'Eastern Europe', RU: 'Eastern Europe',
    SY: 'Middle East', IQ: 'Middle East', IR: 'Middle East', YE: 'Middle East',
    LB: 'Middle East', IL: 'Middle East', PS: 'Middle East',
    SD: 'East Africa', SS: 'East Africa', ET: 'East Africa', SO: 'East Africa',
    KE: 'East Africa', RW: 'East Africa', BI: 'East Africa', TZ: 'East Africa', UG: 'East Africa',
    CD: 'Central Africa', CF: 'Central Africa', TD: 'Central Africa',
    ML: 'West Africa', NE: 'West Africa', NG: 'West Africa', BF: 'West Africa', CM: 'West Africa',
    LY: 'North Africa', EG: 'North Africa', TN: 'North Africa', DZ: 'North Africa', MA: 'North Africa',
    AF: 'South Asia', PK: 'South Asia', BD: 'South Asia', NP: 'South Asia',
    MM: 'Southeast Asia', ID: 'Southeast Asia', PH: 'Southeast Asia',
    KP: 'East Asia', TW: 'East Asia', CN: 'East Asia',
    MX: 'North America', CO: 'South America', VE: 'South America', HT: 'Caribbean',
    AO: 'Southern Africa', ZW: 'Southern Africa', ZM: 'Southern Africa', MZ: 'Southern Africa',
  }
  return REGIONS[iso2] ?? 'Global'
}

function severityFromText(text: string): number {
  const v = text.toLowerCase()
  if (/war|armed conflict|airstrike|offensive|mass casualty|siege|famine/.test(v)) return 4
  if (/conflict|violence|displacement|refugee|flood|earthquake|cyclone|outbreak|humanitarian/.test(v)) return 3
  return 2
}

type Rss2JsonItem = {
  title: string
  pubDate: string
  link: string
  guid: string
  author: string
  description: string
  content: string
  categories: string[]
}

type Rss2JsonResponse = {
  status: string
  items?: Rss2JsonItem[]
  message?: string
}

export async function ingestReliefWeb(): Promise<{ stored: number; skipped: number; error?: string }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0
  const fetchErrors: string[] = []

  const feeds: Array<[string, 'report' | 'disaster']> = [
    [REPORTS_RSS, 'report'],
    [DISASTERS_RSS, 'disaster'],
  ]

  for (const [feedUrl, kind] of feeds) {
    const proxyUrl = `${RSS2JSON_BASE}${encodeURIComponent(feedUrl)}`

    let items: Rss2JsonItem[] = []
    try {
      const res = await fetch(proxyUrl, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        fetchErrors.push(`rss2json HTTP ${res.status} for ${feedUrl}`)
        continue
      }
      const json = await res.json() as Rss2JsonResponse
      if (json.status !== 'ok') {
        fetchErrors.push(`rss2json error: ${json.message ?? json.status} for ${feedUrl}`)
        continue
      }
      items = json.items ?? []
    } catch (err) {
      fetchErrors.push(`${String(err)} for ${feedUrl}`)
      continue
    }

    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000

    for (const item of items) {
      const title = item.title?.trim() ?? ''
      const link = item.link?.trim() ?? ''
      const guid = item.guid?.trim() || link

      // pubDate from rss2json: "2026-03-27 19:33:31" (UTC, space separator)
      let occurredAt = new Date().toISOString()
      if (item.pubDate) {
        try {
          occurredAt = new Date(item.pubDate.replace(' ', 'T') + 'Z').toISOString()
        } catch { /* keep default */ }
      }
      if (new Date(occurredAt).getTime() < cutoff) continue

      // Country: prefer first category (reliefweb puts country first), fallback to description parse
      const categoryCountry = item.categories?.[0] ?? null
      const descCountry = extractCountry(item.description ?? '')
      const countryName = categoryCountry ?? descCountry
      const countryCode = countryNameToCode(countryName)

      const description = stripTags(item.description ?? '').slice(0, 1000) || title
      const sourceName = item.author || extractSourceName(item.description ?? '') || null
      const text = `${title} ${description} ${countryName ?? ''}`

      const { error } = await supabase.from('events').upsert(
        {
          source: 'reliefweb',
          source_id: `rw-${kind}-${guid}`,
          event_type:
            kind === 'disaster'
              ? 'natural_disaster'
              : /conflict|violence|displacement|refugee|humanitarian/i.test(text)
              ? 'humanitarian'
              : 'report',
          title,
          description,
          region: getRegionFromCode(countryCode),
          country_code: countryCode,
          severity: severityFromText(text),
          status: 'pending',
          occurred_at: occurredAt,
          heavy_lane_processed: false,
          provenance_raw: {
            source: 'ReliefWeb',
            attribution: 'Powered by ReliefWeb (reliefweb.int)',
            url: link,
            publisher: sourceName,
            country: countryName,
          },
          raw: { title, link, guid, categories: item.categories } as Record<string, unknown>,
        },
        { onConflict: 'source,source_id', ignoreDuplicates: true }
      )

      if (!error) stored++
      else skipped++
    }
  }

  return { stored, skipped, error: fetchErrors.length > 0 ? fetchErrors.join(' | ') : undefined }
}
