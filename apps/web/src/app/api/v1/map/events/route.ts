export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

type MapEventRow = {
  id: string
  title: string | null
  occurred_at: string | null
  severity: number | null
  event_type: string | null
  region: string | null
  outlet_name: string | null
  source_id: string | null
  significance_score: number | null
  summary_short: string | null
}

const REGION_CENTROIDS: Record<string, [number, number]> = {
  global: [20, 20],
  eastern_europe: [31, 49],
  western_europe: [7, 49],
  central_europe: [15, 49],
  balkans: [21, 43],
  middle_east: [45, 29],
  levant: [37, 34],
  gulf: [51, 25],
  north_africa: [17, 27],
  west_africa: [-1, 12],
  east_africa: [38, 3],
  central_africa: [21, 1],
  southern_africa: [25, -22],
  south_asia: [78, 22],
  central_asia: [68, 41],
  east_asia: [116, 35],
  southeast_asia: [106, 11],
  north_america: [-100, 40],
  latin_america: [-74, 4],
  south_america: [-58, -15],
  oceania: [134, -25],
  arctic: [20, 75],
}

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  ua: [31.2, 48.4], ukraine: [31.2, 48.4],
  ru: [60.0, 60.0], russia: [60.0, 60.0],
  sy: [38.5, 35.0], syria: [38.5, 35.0],
  ye: [47.5, 15.5], yemen: [47.5, 15.5],
  sd: [30.0, 15.0], sudan: [30.0, 15.0],
  ss: [31.3, 7.9], south_sudan: [31.3, 7.9],
  et: [40.0, 9.1], ethiopia: [40.0, 9.1],
  ly: [17.2, 27.0], libya: [17.2, 27.0],
  iq: [44.4, 33.2], iraq: [44.4, 33.2],
  af: [67.7, 33.9], afghanistan: [67.7, 33.9],
  mm: [95.9, 21.9], myanmar: [95.9, 21.9],
  cd: [23.7, -2.9], drc: [23.7, -2.9], congo_drc: [23.7, -2.9],
  so: [46.2, 5.2], somalia: [46.2, 5.2],
  ml: [2.6, 17.6], mali: [2.6, 17.6],
  bf: [-1.6, 12.4], burkina_faso: [-1.6, 12.4],
  ne: [8.1, 17.6], niger: [8.1, 17.6],
  cf: [21.0, 7.0], central_african_republic: [21.0, 7.0],
  mz: [35.5, -18.7], mozambique: [35.5, -18.7],
  ng: [8.7, 9.1], nigeria: [8.7, 9.1],
  cm: [12.4, 5.7], cameroon: [12.4, 5.7],
  ps: [35.2, 31.9], palestine: [35.2, 31.9],
  il: [34.9, 31.5], israel: [34.9, 31.5],
  lb: [35.9, 33.9], lebanon: [35.9, 33.9],
  ir: [53.7, 32.4], iran: [53.7, 32.4],
  pk: [69.3, 30.4], pakistan: [69.3, 30.4],
  in: [78.9, 20.6], india: [78.9, 20.6],
  cn: [104.2, 35.9], china: [104.2, 35.9],
  eg: [30.8, 26.8], egypt: [30.8, 26.8],
  sa: [45.0, 24.0], saudi_arabia: [45.0, 24.0],
  tr: [35.2, 38.9], turkey: [35.2, 38.9], turkiye: [35.2, 38.9],
  us: [-98.0, 39.5], united_states: [-98.0, 39.5],
  gb: [-2.0, 54.4], united_kingdom: [-2.0, 54.4],
  fr: [2.3, 46.2], france: [2.3, 46.2],
  de: [10.4, 51.2], germany: [10.4, 51.2],
  ve: [-66.6, 8.0], venezuela: [-66.6, 8.0],
  co: [-74.3, 4.6], colombia: [-74.3, 4.6],
  mx: [-102.6, 23.6], mexico: [-102.6, 23.6],
  br: [-51.9, -14.2], brazil: [-51.9, -14.2],
  za: [25.1, -29.0], south_africa: [25.1, -29.0],
  ke: [37.9, 0.0], kenya: [37.9, 0.0],
  tn: [9.5, 33.9], tunisia: [9.5, 33.9],
  dz: [3.0, 28.0], algeria: [3.0, 28.0],
  ma: [-7.1, 31.8], morocco: [-7.1, 31.8],
  kp: [127.5, 40.3], north_korea: [127.5, 40.3],
  tw: [121.0, 23.7], taiwan: [121.0, 23.7],
  ge: [43.4, 42.3], georgia: [43.4, 42.3],
}

function normalizeKey(value: string | null | undefined): string | null {
  if (!value) return null
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function inferCoordinates(event: MapEventRow): [number, number] | null {
  const regionKey = normalizeKey(event.region)
  if (!regionKey) return null

  const directRegion = REGION_CENTROIDS[regionKey]
  if (directRegion) return directRegion

  const directCountry = COUNTRY_CENTROIDS[regionKey]
  if (directCountry) return directCountry

  for (const [key, coords] of Object.entries(COUNTRY_CENTROIDS)) {
    if (regionKey.includes(key)) return coords
  }

  for (const [key, coords] of Object.entries(REGION_CENTROIDS)) {
    if (regionKey.includes(key)) return coords
  }

  return null
}

function getDeterministicJitter(id: string): number {
  const first = id.charCodeAt(0) || 0
  const second = id.charCodeAt(1) || 0
  const h = first + second
  return ((h % 100) / 100) * 3 - 1.5
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '500') || 500, 1000)
  const hours = Math.max(Number(url.searchParams.get('hours') ?? '168') || 168, 1)
  const severity = url.searchParams.get('severity')
  const region = url.searchParams.get('region')
  const eventType = url.searchParams.get('type')
  const window = `${hours}h`
  const cacheKey = `map:events:${window}:sev${severity ?? 'all'}:reg${region ?? 'all'}:type${eventType ?? 'all'}`
  const cached = await getCachedSnapshot<object>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let query = createServiceClient()
    .from('events')
    .select('id, title, occurred_at, severity, event_type, region, outlet_name, source_id, significance_score, summary_short')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (severity) query = query.gte('severity', Number(severity))
  if (region) query = query.ilike('region', `%${region}%`)
  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = Date.now()
  const features: Array<GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>> = []

  for (const event of (data ?? []) as MapEventRow[]) {
    const coords = inferCoordinates(event)
    if (!coords) continue

    const jitter = getDeterministicJitter(event.id)
    const occurredTime = event.occurred_at ? new Date(event.occurred_at).getTime() : null
    const ageMin = occurredTime ? Math.max(0, Math.floor((now - occurredTime) / 60000)) : null
    const lng = Math.max(-179.5, Math.min(179.5, coords[0] + jitter))
    const lat = Math.max(-85, Math.min(85, coords[1] + jitter * 0.35))

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: event.id,
        title: event.title ?? 'Untitled event',
        occurred_at: event.occurred_at,
        severity: typeof event.severity === 'number' ? event.severity : 1,
        event_type: event.event_type,
        region: event.region,
        outlet_name: event.outlet_name,
        source_id: event.source_id,
        significance_score: event.significance_score,
        summary_short: event.summary_short,
        age_min: ageMin,
      },
    })
  }

  const responseObject: GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties> = {
    type: 'FeatureCollection',
    features,
  }

  await setCachedSnapshot(cacheKey, responseObject, 120)
  return NextResponse.json(responseObject, { headers: { 'Cache-Control': 'no-store' } })
}
