/**
 * ACLED Ingestion Adapter
 * Source: Armed Conflict Location & Event Data Project
 * License: Commercial SaaS license required (~$500-2000/year) — email acleddata.com before launch
 * Attribution required: "Source: ACLED (acleddata.com)"
 * Rate limit: 500 requests/day on free tier
 */

import { createServiceClient } from '@/lib/supabase/server'
import { getEmbedding } from '@/lib/ai/openai'
import crypto from 'crypto'

const ACLED_BASE = 'https://api.acleddata.com/acled/read'

// High-conflict country list — filter to reduce GDELT/ACLED volume by ~80%
export const HIGH_CONFLICT_COUNTRIES = [
  'AF', 'CG', 'CD', 'CF', 'TD', 'SO', 'SS', 'SD', 'ET', 'ER',
  'NG', 'ML', 'BF', 'NE', 'MZ', 'ZW', 'MG', 'CM', 'GN', 'SL',
  'LR', 'CI', 'GH', 'TG', 'BJ', 'SN', 'GM', 'GW', 'CV', 'MR',
  'LY', 'TN', 'EG', 'DZ', 'MA', 'SY', 'IQ', 'YE', 'LB', 'PS',
  'IR', 'AF', 'PK', 'IN', 'MM', 'TH', 'PH', 'ID', 'UA', 'RU',
  'BY', 'MD', 'GE', 'AZ', 'AM', 'MX', 'CO', 'VE', 'HT', 'HN',
]

export type ACLEDEvent = {
  data_id: string
  event_date: string
  event_type: string
  sub_event_type: string
  actor1: string
  actor2: string
  country: string
  iso3: string
  admin1: string
  admin2: string
  location: string
  latitude: string
  longitude: string
  geo_precision: string
  fatalities: string
  notes: string
  source: string
}

export type IngestResult = {
  fetched: number
  inserted: number
  duplicates: number
  errors: number
}

/**
 * Fetch recent ACLED events (last 48 hours)
 * Fast lane: store raw, skip embedding
 */
export async function ingestACLED(hoursBack = 48): Promise<IngestResult> {
  const result: IngestResult = { fetched: 0, inserted: 0, duplicates: 0, errors: 0 }

  const sinceDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const params = new URLSearchParams({
    key: process.env['ACLED_API_KEY'] ?? '',
    email: process.env['ACLED_EMAIL'] ?? '',
    event_date: `${sinceDate}|${new Date().toISOString().split('T')[0]}`,
    event_date_where: 'BETWEEN',
    iso: HIGH_CONFLICT_COUNTRIES.join('|'),
    limit: '500',
    fields: 'data_id|event_date|event_type|sub_event_type|actor1|actor2|country|iso3|admin1|admin2|location|latitude|longitude|fatalities|notes|source',
  })

  let rawData: ACLEDEvent[] = []

  try {
    const res = await fetch(`${ACLED_BASE}?${params.toString()}`)
    if (!res.ok) throw new Error(`ACLED API ${res.status}`)

    const json = await res.json() as { data?: ACLEDEvent[]; status?: number }
    rawData = json.data ?? []
    result.fetched = rawData.length
  } catch (err) {
    console.error('[acled-ingest] fetch error:', err)
    result.errors++
    return result
  }

  // Log raw ingest
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(rawData))
    .digest('hex')

  const supabase = createServiceClient()
  await supabase.from('raw_ingest_log').insert({
    source: 'acled',
    fetch_url: ACLED_BASE,
    payload_hash: payloadHash,
    payload_size_bytes: JSON.stringify(rawData).length,
    record_count: rawData.length,
    model_version: 'fast-lane-v1',
  })

  // Upsert events (fast lane — no embedding yet)
  for (const event of rawData) {
    const lat = parseFloat(event.latitude)
    const lng = parseFloat(event.longitude)
    const hasLocation = !isNaN(lat) && !isNaN(lng)

    const { error } = await supabase.from('events').upsert(
      {
        source: 'acled',
        source_id: event.data_id,
        event_type: event.event_type.toLowerCase().replace(/\s+/g, '_'),
        title: `${event.event_type}: ${event.location}, ${event.country}`,
        description: event.notes,
        description_original: event.notes,
        region: event.admin1,
        country_code: event.iso3?.substring(0, 2) ?? null,
        location: hasLocation
          ? `POINT(${lng} ${lat})`
          : null,
        severity: fatalitiesToSeverity(parseInt(event.fatalities) || 0),
        status: 'pending',
        occurred_at: new Date(event.event_date).toISOString(),
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'ACLED',
          attribution: 'Source: ACLED (acleddata.com)',
          actor1: event.actor1,
          actor2: event.actor2,
          fatalities: event.fatalities,
          geo_precision: event.geo_precision,
          original_source: event.source,
        },
        raw: event as unknown as Record<string, unknown>,
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

function fatalitiesToSeverity(fatalities: number): 1 | 2 | 3 | 4 | 5 {
  if (fatalities === 0) return 1
  if (fatalities <= 2) return 2
  if (fatalities <= 10) return 3
  if (fatalities <= 50) return 4
  return 5
}
