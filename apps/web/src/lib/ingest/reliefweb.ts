/**
 * ReliefWeb Ingest — UN OCHA
 * Source: reliefweb.int — FREE, public JSON API
 * Attribution: "Powered by ReliefWeb (reliefweb.int)"
 */

import { createServiceClient } from '@/lib/supabase/server'

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

function iso3ToIso2(iso3: string): string {
  const MAP: Record<string, string> = {
    UKR: 'UA', RUS: 'RU', SYR: 'SY', YEM: 'YE', SDN: 'SD', SSD: 'SS',
    ETH: 'ET', LBY: 'LY', IRQ: 'IQ', AFG: 'AF', MMR: 'MM', COD: 'CD',
    SOM: 'SO', MLI: 'ML', BFA: 'BF', NER: 'NE', CAF: 'CF', MOZ: 'MZ',
    NGA: 'NG', CMR: 'CM', PSE: 'PS', ISR: 'IL', LBN: 'LB', IRN: 'IR',
    PAK: 'PK', IND: 'IN', CHN: 'CN', TWN: 'TW', PRK: 'KP', COL: 'CO',
    VEN: 'VE', HTI: 'HT', MEX: 'MX', BRA: 'BR', GRC: 'GR', LKA: 'LK',
    KEN: 'KE', TCD: 'TD', ERI: 'ER', DJI: 'DJ', GIN: 'GN', COG: 'CG',
    AGO: 'AO', ZWE: 'ZW', ZMB: 'ZM', TUN: 'TN', DZA: 'DZ', MAR: 'MA',
    EGY: 'EG', RWA: 'RW', BDI: 'BI', TZA: 'TZ', UGA: 'UG',
  }
  return MAP[iso3.toUpperCase()] ?? iso3.slice(0, 2).toUpperCase()
}

function getRegionFromCountry(countryOrIso: string | null): string {
  if (!countryOrIso) return 'Global'
  const value = countryOrIso.toUpperCase()
  const REGIONS: Record<string, string> = {
    UA: 'Eastern Europe', RU: 'Eastern Europe', SY: 'Middle East', IQ: 'Middle East',
    IR: 'Middle East', YE: 'Middle East', LB: 'Middle East', IL: 'Middle East',
    PS: 'Middle East', SD: 'East Africa', SS: 'East Africa', ET: 'East Africa',
    SO: 'East Africa', CD: 'Central Africa', CF: 'Central Africa', ML: 'West Africa',
    NE: 'West Africa', NG: 'West Africa', BF: 'West Africa', LY: 'North Africa',
    AF: 'South Asia', PK: 'South Asia', MM: 'Southeast Asia', KP: 'East Asia',
    TW: 'East Asia', MX: 'North America', CO: 'South America', VE: 'South America',
    HT: 'Caribbean', KE: 'East Africa', TD: 'Central Africa', RW: 'East Africa',
    BI: 'East Africa', TZ: 'East Africa', UG: 'East Africa', EG: 'North Africa',
    DZ: 'North Africa', TN: 'North Africa', MA: 'North Africa', AO: 'Southern Africa',
    ZW: 'Southern Africa', ZM: 'Southern Africa', MZ: 'Southern Africa',
  }
  return REGIONS[value] ?? 'Global'
}

function severityFromText(text: string): number {
  const value = text.toLowerCase()
  if (/war|armed conflict|airstrike|offensive|mass casualty|siege|famine/.test(value)) return 4
  if (/conflict|violence|displacement|refugee|flood|earthquake|cyclone|outbreak|humanitarian/.test(value)) return 3
  return 2
}

type ReliefWebReport = {
  id: string
  fields: {
    title?: string
    url?: string
    date?: { created?: string }
    country?: Array<{ iso3?: string; name?: string }>
    source?: Array<{ name?: string }>
    'body-html'?: string
    primary_country?: { iso3?: string; name?: string }
  }
}

export async function ingestReliefWeb(): Promise<{ stored: number; skipped: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const apiUrl =
    `https://api.reliefweb.int/v1/reports?appname=conflictradar` +
    `&fields[include][]=title` +
    `&fields[include][]=url` +
    `&fields[include][]=date.created` +
    `&fields[include][]=country` +
    `&fields[include][]=source` +
    `&fields[include][]=body-html` +
    `&fields[include][]=primary_country` +
    `&filter[field]=date.created&filter[value][from]=${cutoff}` +
    `&sort[]=date.created:desc&limit=50`

  try {
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'ConflictOps/1.0 (conflictradar.co)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      console.error(`[reliefweb] API returned HTTP ${res.status}`)
      return { stored, skipped }
    }

    const json = await res.json() as { data?: ReliefWebReport[] }
    const reports = json.data ?? []

    for (const report of reports) {
      const f = report.fields
      const title = f.title ?? ''
      const link = f.url ?? ''
      const descriptionRaw = f['body-html'] ?? ''
      const description = stripTags(descriptionRaw)
      const occurredAt = f.date?.created
        ? new Date(f.date.created).toISOString()
        : new Date().toISOString()

      // Prefer primary_country, fall back to first country in array
      const primaryIso3 = f.primary_country?.iso3 ?? f.country?.[0]?.iso3
      const countryCode = primaryIso3 ? iso3ToIso2(primaryIso3) : null
      const sourceName = f.source?.[0]?.name ?? null
      const text = `${title} ${description}`

      const { error } = await supabase.from('events').upsert(
        {
          source: 'reliefweb',
          source_id: `rw-${report.id}`,
          event_type: /conflict|violence|displacement|refugee|humanitarian/i.test(text)
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
            publisher: sourceName,
          },
          raw: { id: report.id, title, url: link } as Record<string, unknown>,
        },
        { onConflict: 'source,source_id', ignoreDuplicates: true }
      )

      if (!error) stored++
      else skipped++
    }
  } catch (err) {
    console.error('[reliefweb] ingest error:', err)
  }

  return { stored, skipped }
}
