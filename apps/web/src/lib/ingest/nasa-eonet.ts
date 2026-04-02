/**
 * NASA EONET Ingest — Earth Observatory Natural Event Tracker
 * Source: eonet.gsfc.nasa.gov — FREE, uses NASA_API_KEY
 * Attribution: "Natural event data from NASA EONET (eonet.gsfc.nasa.gov)"
 *
 * Relevant to CONFLICTRADAR:
 * - Wildfires in conflict zones (Sudan, Ukraine, Myanmar) — cover/concealment signals
 * - Floods/droughts → displacement → conflict driver
 * - Severe storms disrupting humanitarian corridors
 * Updated: near real-time
 */

import { createServiceClient } from '@/lib/supabase/server'

const EONET_API = 'https://eonet.gsfc.nasa.gov/api/v3'

// Only ingest events in or near active conflict zones
const CONFLICT_BBOX = [
  { name: 'Ukraine/Eastern Europe', minLat: 44, maxLat: 55, minLng: 22, maxLng: 42 },
  { name: 'Middle East', minLat: 14, maxLat: 38, minLng: 32, maxLng: 65 },
  { name: 'East/Central Africa', minLat: -5, maxLat: 20, minLng: 22, maxLng: 52 },
  { name: 'West Africa Sahel', minLat: 10, maxLat: 22, minLng: -18, maxLng: 25 },
  { name: 'South/Southeast Asia', minLat: 10, maxLat: 35, minLng: 60, maxLng: 105 },
  { name: 'North Africa', minLat: 18, maxLat: 38, minLng: -18, maxLng: 38 },
  { name: 'Latin America', minLat: -20, maxLat: 22, minLng: -92, maxLng: -60 },
  { name: 'Russia/Central Asia', minLat: 36, maxLat: 56, minLng: 42, maxLng: 78 },
]

type EONETEvent = {
  id: string
  title: string
  description: string | null
  categories: Array<{ id: string; title: string }>
  geometry: Array<{
    magnitudeValue: number | null
    magnitudeUnit: string | null
    date: string
    type: string
    coordinates: [number, number] | number[]
  }>
  sources: Array<{ id: string; url: string }>
  status: string
}

// Only these categories are relevant for conflict intelligence
const RELEVANT_CATEGORIES = new Set([
  'wildfires',
  'floods',
  'severeStorms',
  'drought',
  'landslides',
])

function inConflictZone(lat: number, lng: number): string | null {
  for (const zone of CONFLICT_BBOX) {
    if (lat >= zone.minLat && lat <= zone.maxLat && lng >= zone.minLng && lng <= zone.maxLng) {
      return zone.name
    }
  }
  return null
}

function categoryToEventType(categoryId: string): string {
  if (categoryId === 'wildfires') return 'natural_disaster'
  if (categoryId === 'floods' || categoryId === 'drought') return 'humanitarian'
  return 'natural_disaster'
}

function severityFromCategory(categoryId: string, _magnitudeValue: number | null): 1 | 2 | 3 | 4 {
  // EONET category → severity mapping
  // Wildfires, Volcanoes, Severe Storms → 3 (significant natural disaster)
  // Sea and Lake Ice, Earthquakes → 2
  // Dust and Haze, Snow, Drought, Floods → 1–2
  if (categoryId === 'wildfires' || categoryId === 'volcanoes' || categoryId === 'severeStorms') return 3
  if (categoryId === 'seaLakeIce' || categoryId === 'earthquakes') return 2
  if (categoryId === 'floods') return 2
  if (categoryId === 'drought') return 2
  if (categoryId === 'dustHaze' || categoryId === 'snow') return 1
  return 2
}

export async function ingestNASAEONET(): Promise<{ stored: number; skipped: number }> {
  const supabase = createServiceClient()
  const apiKey = process.env['NASA_API_KEY']
  if (!apiKey) return { stored: 0, skipped: 0 }

  let stored = 0, skipped = 0

  try {
    // Fetch open (active) events from all relevant categories
    const res = await fetch(
      `${EONET_API}/events?status=open&limit=100&api_key=${apiKey}`,
      {
        headers: { 'User-Agent': 'ConflictOps/1.0 (conflictradar.co)' },
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!res.ok) return { stored, skipped }

    const data = await res.json() as { events?: EONETEvent[] }

    for (const event of (data.events ?? [])) {
      const category = event.categories[0]
      if (!category || !RELEVANT_CATEGORIES.has(category.id)) continue

      const latestGeom = event.geometry[event.geometry.length - 1]
      if (!latestGeom) continue

      const coords = latestGeom.coordinates as [number, number]
      const lng = coords[0]
      const lat = coords[1]
      if (typeof lat !== 'number' || typeof lng !== 'number') continue

      // Skip prescribed/controlled burns — not emergencies
      if (/prescribed fire|rx fire|controlled burn/i.test(event.title)) { skipped++; continue }
      // Skip routine green-level fire notifications
      if (/green forest fire/i.test(event.title)) { skipped++; continue }

      const region = inConflictZone(lat, lng)
      // Only skip low-severity events outside conflict zones
      const sevScore = severityFromCategory(category.id, latestGeom?.magnitudeValue ?? null)
      if (!region && sevScore < 4) continue

      const severity = severityFromCategory(category.id, latestGeom.magnitudeValue)

      const { error } = await supabase.from('events').upsert({
        source: 'nasa_eonet',
        source_id: `eonet-${event.id}`,
        event_type: categoryToEventType(category.id),
        title: `${category.title}: ${event.title}`,
        description: event.description
          ? event.description.slice(0, 800)
          : `NASA EONET reports an active ${category.title.toLowerCase()} event in the ${region} conflict zone. Natural disasters in active conflict areas compound humanitarian risk and may affect military operations, supply lines, and displacement patterns.`,
        region,
        country_code: null, // EONET doesn't provide country codes
        severity,
        status: 'pending',
        occurred_at: latestGeom.date,
        location: `POINT(${lng} ${lat})`,
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'NASA EONET',
          attribution: 'Natural event data from NASA EONET (eonet.gsfc.nasa.gov)',
          category: category.id,
          magnitude: latestGeom.magnitudeValue,
          magnitude_unit: latestGeom.magnitudeUnit,
          eonet_status: event.status,
          sources: event.sources,
        },
        raw: event as unknown as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (!error) stored++; else skipped++
    }
  } catch {
    // non-critical
  }

  return { stored, skipped }
}
