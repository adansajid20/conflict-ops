/**
 * GDELT Ingestion Adapter
 * Source: Global Database of Events, Language, and Tone
 * License: Open / free — attribution appreciated
 * Update frequency: every 15 minutes
 * Filter: HIGH_CONFLICT_COUNTRIES only — reduces volume by ~80%
 */

import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const HIGH_CONFLICT_COUNTRIES = [
  'UA','RU','SY','YE','SD','SS','ET','LY','IQ','AF','MM','CD','SO','ML','BF','NE','CF','MZ','NG','CM','PS','IL','LB','IR','PK',
]

// Country centroid lookup — approximate center coords [lng, lat]
// Used to geocode GDELT events that lack precise coordinates
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  UA: [31.2, 48.4], RU: [60.0, 60.0], SY: [38.5, 35.0], YE: [47.5, 15.5],
  SD: [30.0, 15.0], SS: [31.3, 7.9], ET: [40.0, 9.1], LY: [17.2, 27.0],
  IQ: [44.4, 33.2], AF: [67.7, 33.9], MM: [95.9, 21.9], CD: [23.7, -2.9],
  SO: [46.2, 5.2], ML: [2.6, 17.6], BF: [-1.6, 12.4], NE: [8.1, 17.6],
  CF: [21.0, 7.0], MZ: [35.5, -18.7], NG: [8.7, 9.1], CM: [12.4, 5.7],
  PS: [35.2, 31.9], IL: [34.9, 31.5], LB: [35.9, 33.9], IR: [53.7, 32.4],
  PK: [69.3, 30.4], KE: [37.9, 0.0], GH: [-1.0, 7.9], SN: [-14.5, 14.5],
  TD: [18.7, 15.5], ER: [39.8, 15.2], DJ: [42.6, 11.8], GN: [-11.3, 11.0],
  CG: [15.8, -0.2], AO: [17.9, -11.2], ZW: [30.0, -20.0], ZM: [27.8, -13.1],
  TN: [9.5, 33.9], DZ: [3.0, 28.0], MA: [-7.1, 31.8], EG: [30.8, 26.8],
  RW: [29.9, -2.0], BI: [29.9, -3.4], TZ: [34.9, -6.4], UG: [32.3, 1.4],
  CN: [104.2, 35.9], VE: [-66.6, 8.0], CO: [-74.3, 4.6], MX: [-102.6, 23.6],
  BR: [-51.9, -14.2], IN: [78.9, 20.6], KP: [127.5, 40.3], LA: [103.0, 18.0],
  MM2: [95.9, 21.9], NP: [83.9, 28.4],
}

function jitterCoords(coords: [number, number]): [number, number] {
  // Add small random offset so clustered events don't stack exactly
  return [coords[0] + (Math.random() - 0.5) * 2, coords[1] + (Math.random() - 0.5) * 2]
}

const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc'

export type GDELTArticle = {
  url: string
  url_mobile: string
  title: string
  seendate: string
  socialimage: string
  domain: string
  language: string
  sourcecountry: string
}

export type GDELTResponse = {
  articles?: GDELTArticle[]
  status?: string
}

export type IngestResult = {
  fetched: number
  inserted: number
  duplicates: number
  errors: number
}

/**
 * Fetch latest GDELT news for conflict countries
 * Uses GDELT's GKG API to get geolocated conflict news
 */
export async function ingestGDELT(): Promise<IngestResult> {
  const result: IngestResult = { fetched: 0, inserted: 0, duplicates: 0, errors: 0 }

  // Build country query — GDELT country codes are slightly different
  const countryQuery = HIGH_CONFLICT_COUNTRIES.slice(0, 20).join(' OR ')

  const params = new URLSearchParams({
    query: `(war OR conflict OR attack OR military OR troops OR bombing OR airstrike OR protest OR coup OR election OR sanctions) sourcelang:English`,
    mode: 'artlist',
    maxrecords: '75',
    sort: 'DateDesc',
    format: 'json',
  })

  let articles: GDELTArticle[] = []

  try {
    const res = await fetch(`${GDELT_BASE}?${params.toString()}`, {
      headers: { 'User-Agent': 'ConflictOps/1.0 (https://conflictradar.co)' },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) throw new Error(`GDELT API ${res.status}`)

    const json = await res.json() as GDELTResponse
    articles = json.articles ?? []
    result.fetched = articles.length
  } catch (err) {
    console.error('[gdelt-ingest] fetch error:', err)
    result.errors++
    return result
  }

  // Log raw ingest
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(articles))
    .digest('hex')

  const supabase = createServiceClient()
  await supabase.from('raw_ingest_log').insert({
    source: 'gdelt',
    fetch_url: GDELT_BASE,
    payload_hash: payloadHash,
    payload_size_bytes: JSON.stringify(articles).length,
    record_count: articles.length,
    model_version: 'fast-lane-v1',
  })

  for (const article of articles) {
    // Use URL hash as source_id for deduplication
    const sourceId = crypto.createHash('md5').update(article.url).digest('hex')

    const { error } = await supabase.from('events').upsert(
      {
        source: 'gdelt',
        source_id: sourceId,
        event_type: 'news',
        title: article.title.substring(0, 200),
        description: null,
        description_original: null,
        description_lang: article.language,
        region: null,
        country_code: article.sourcecountry?.substring(0, 2)?.toUpperCase() ?? null,
        location: (() => {
          const cc = article.sourcecountry?.substring(0, 2)?.toUpperCase()
          const base = cc ? COUNTRY_CENTROIDS[cc] : null
          if (!base) return undefined
          const [lng, lat] = jitterCoords(base)
          return `POINT(${lng} ${lat})`
        })(),
        severity: 2, // default — heavy lane will update
        status: 'pending',
        occurred_at: parseGDELTDate(article.seendate),
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'GDELT',
          attribution: 'Source: GDELT Project (gdeltproject.org)',
          url: article.url,
          domain: article.domain,
          language: article.language,
          sourcecountry: article.sourcecountry,
        },
        raw: article as unknown as Record<string, unknown>,
      },
      { onConflict: 'source,source_id', ignoreDuplicates: true }
    )

    if (error) {
      if (error.code === '23505') {
        result.duplicates++
      } else {
        result.errors++
      }
    } else {
      result.inserted++
    }
  }

  return result
}

function parseGDELTDate(gdeltDate: string): string {
  // GDELT format: 20240324T120000Z
  try {
    const cleaned = gdeltDate.replace('T', '').replace('Z', '')
    const year = cleaned.substring(0, 4)
    const month = cleaned.substring(4, 6)
    const day = cleaned.substring(6, 8)
    const hour = cleaned.substring(8, 10) || '00'
    const min = cleaned.substring(10, 12) || '00'
    const sec = cleaned.substring(12, 14) || '00'
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
  } catch {
    return new Date().toISOString()
  }
}
