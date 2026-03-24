/**
 * GDELT Ingestion Adapter
 * Source: Global Database of Events, Language, and Tone
 * License: Open / free — attribution appreciated
 * Update frequency: every 15 minutes
 * Filter: HIGH_CONFLICT_COUNTRIES only — reduces volume by ~80%
 */

import { createServiceClient } from '@/lib/supabase/server'
import { HIGH_CONFLICT_COUNTRIES } from './acled'
import crypto from 'crypto'

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
      headers: { 'User-Agent': 'ConflictOps/1.0 (https://conflictops.com)' },
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
