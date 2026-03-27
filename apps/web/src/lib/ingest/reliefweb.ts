/**
 * ReliefWeb Ingest — UN OCHA
 * Source: reliefweb.int — FREE, public RSS feeds
 * Attribution: "Powered by ReliefWeb (reliefweb.int)"
 */

import { createServiceClient } from '@/lib/supabase/server'

const REPORTS_RSS = 'https://reliefweb.int/updates/rss.xml'
const DISASTERS_RSS = 'https://reliefweb.int/disasters/rss.xml'

function decodeHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(input: string): string {
  return decodeHtml(input).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Extract text content of a tag (handles CDATA, attributes on the opening tag) */
function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m?.[1] != null ? decodeHtml(m[1]).trim() : null
}

/** Pull all <item> blocks out of RSS XML */
function extractItems(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1] ?? '')
}

function extractCountry(descriptionHtml: string): string | null {
  // Description HTML is entity-encoded so decode first
  const decoded = decodeHtml(descriptionHtml)
  const m = decoded.match(/Country:\s*([^<\n]+)/i)
  return m?.[1]?.trim() ?? null
}

function extractSource(descriptionHtml: string): string | null {
  const decoded = decodeHtml(descriptionHtml)
  const m = decoded.match(/Source:\s*([^<\n]+)/i)
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

function countryToCode(country: string | null): string | null {
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
  }
  return MAP[country.toLowerCase().trim()] ?? null
}

function getRegionFromCountry(countryOrIso: string | null): string {
  if (!countryOrIso) return 'Global'
  const value = countryOrIso.toUpperCase()
  const REGIONS: Record<string, string> = {
    UA: 'Eastern Europe', RU: 'Eastern Europe',
    SY: 'Middle East', IQ: 'Middle East', IR: 'Middle East', YE: 'Middle East',
    LB: 'Middle East', IL: 'Middle East', PS: 'Middle East',
    SD: 'East Africa', SS: 'East Africa', ET: 'East Africa', SO: 'East Africa',
    KE: 'East Africa', RW: 'East Africa', BI: 'East Africa', TZ: 'East Africa', UG: 'East Africa',
    CD: 'Central Africa', CF: 'Central Africa', TD: 'Central Africa',
    ML: 'West Africa', NE: 'West Africa', NG: 'West Africa', BF: 'West Africa',
    LY: 'North Africa', EG: 'North Africa', TN: 'North Africa', DZ: 'North Africa', MA: 'North Africa',
    AF: 'South Asia', PK: 'South Asia', MM: 'Southeast Asia', KP: 'East Asia', TW: 'East Asia',
    MX: 'North America', CO: 'South America', VE: 'South America', HT: 'Caribbean',
    AO: 'Southern Africa', ZW: 'Southern Africa', ZM: 'Southern Africa', MZ: 'Southern Africa',
  }
  return REGIONS[value] ?? 'Global'
}

function severityFromText(text: string): number {
  const value = text.toLowerCase()
  if (/war|armed conflict|airstrike|offensive|mass casualty|siege|famine/.test(value)) return 4
  if (/conflict|violence|displacement|refugee|flood|earthquake|cyclone|outbreak|humanitarian/.test(value)) return 3
  return 2
}

export async function ingestReliefWeb(): Promise<{ stored: number; skipped: number; error?: string }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0

  const feeds: Array<[string, 'report' | 'disaster']> = [
    [REPORTS_RSS, 'report'],
    [DISASTERS_RSS, 'disaster'],
  ]

  for (const [feedUrl, kind] of feeds) {
    let xml: string
    try {
      const res = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'ConflictOps/1.0 (conflictradar.co)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) {
        console.error(`[reliefweb] feed ${feedUrl} HTTP ${res.status}`)
        continue
      }
      xml = await res.text()
    } catch (err) {
      console.error(`[reliefweb] fetch error for ${feedUrl}:`, err)
      continue
    }

    const items = extractItems(xml)
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000

    for (const item of items) {
      const title = stripTags(extractTag(item, 'title') ?? '')
      const link = stripTags(extractTag(item, 'link') ?? '')
      const guid = stripTags(extractTag(item, 'guid') ?? link)
      const descriptionHtml = extractTag(item, 'description') ?? ''
      const description = stripTags(descriptionHtml)
      const pubDate = stripTags(extractTag(item, 'pubDate') ?? '')

      const occurredAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
      if (new Date(occurredAt).getTime() < cutoff) continue

      const countryName = extractCountry(descriptionHtml)
      const countryCode = countryToCode(countryName)
      const sourceName = extractSource(descriptionHtml)
      const text = `${title} ${description} ${countryName ?? ''}`

      const { error } = await supabase.from('events').upsert(
        {
          source: 'reliefweb',
          source_id: `rw-${kind}-${guid || link || title}`,
          event_type:
            kind === 'disaster'
              ? 'natural_disaster'
              : /conflict|violence|displacement|refugee|humanitarian/i.test(text)
              ? 'humanitarian'
              : 'report',
          title,
          description: description.slice(0, 1000) || title,
          region: getRegionFromCountry(countryCode),
          country_code: countryCode,
          severity: severityFromText(text),
          status: 'pending',
          occurred_at: occurredAt,
          heavy_lane_processed: false,
          provenance_raw: {
            source: 'ReliefWeb',
            attribution: 'Powered by ReliefWeb (reliefweb.int)',
            url: link,
            feed: feedUrl,
            publisher: sourceName,
            country: countryName,
          },
          raw: { title, link, guid, description_snippet: description.slice(0, 200) } as Record<string, unknown>,
        },
        { onConflict: 'source,source_id', ignoreDuplicates: true }
      )

      if (!error) stored++
      else skipped++
    }
  }

  return { stored, skipped }
}
