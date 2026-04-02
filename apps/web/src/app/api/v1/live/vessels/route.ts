export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

type BoundingBox = [number, number, number, number]
type VesselCollection = GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>
type VesselRow = Record<string, string | number | null | undefined>

const CACHE_KEY = 'live:vessels'
const CACHE_TTL = 120
const EMPTY: VesselCollection = { type: 'FeatureCollection', features: [] }
const ZONES: Array<{ name: string; bbox: BoundingBox }> = [
  { name: 'Red Sea', bbox: [32, 12, 44, 30] },
  { name: 'Strait of Hormuz', bbox: [55, 23, 60, 28] },
  { name: 'Black Sea', bbox: [27, 40, 42, 47] },
  { name: 'Taiwan Strait', bbox: [118, 21, 123, 27] },
  { name: 'Gulf of Aden', bbox: [42, 10, 54, 16] },
]
const NAVAL_KEYWORDS = ['navy', 'warship', 'frigate', 'destroyer', 'patrol', 'coast guard']
const TANKER_KEYWORDS = ['tanker', 'crude', 'lng', 'lpg']

function asNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function pick(row: VesselRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return null
}

export async function GET() {
  if (!process.env.AISHUB_USERNAME) {
    return NextResponse.json({ type: 'FeatureCollection', features: [], meta: { disabled: true, reason: 'AISHUB_USERNAME not configured' } })
  }

  const cached = await getCachedSnapshot<VesselCollection>(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  const password = process.env.AISHUB_PASSWORD ?? process.env.AISHUB_API_KEY ?? ''
  if (!password) {
    return NextResponse.json({ type: 'FeatureCollection', features: [], meta: { disabled: true, reason: 'AISHUB credentials incomplete' } })
  }

  try {
    const zoneResponses = await Promise.all(
      ZONES.map(async ({ name, bbox }) => {
        const [minLon, minLat, maxLon, maxLat] = bbox
        const url = `https://data.aishub.net/ws.php?username=${encodeURIComponent(process.env.AISHUB_USERNAME ?? '')}&format=1&output=json&compress=0&latmin=${minLat}&latmax=${maxLat}&lonmin=${minLon}&lonmax=${maxLon}&password=${encodeURIComponent(password)}`
        const response = await fetch(url, { next: { revalidate: CACHE_TTL } })
        if (!response.ok) throw new Error(`AISHub ${name} failed with ${response.status}`)
        const payload = await response.json() as VesselRow[] | { data?: VesselRow[] }
        return { name, rows: Array.isArray(payload) ? payload : (payload.data ?? []) }
      })
    )

    const seen = new Set<string>()
    const features = zoneResponses.flatMap(({ name, rows }) => rows.flatMap((row) => {
      const lon = asNumber(row.LONGITUDE ?? row.lng ?? row.lon)
      const lat = asNumber(row.LATITUDE ?? row.lat)
      if (lon === null || lat === null) return []
      const mmsi = pick(row, ['MMSI', 'mmsi'])
      if (!mmsi || seen.has(`${mmsi}:${name}`)) return []
      seen.add(`${mmsi}:${name}`)
      const vesselName = pick(row, ['SHIPNAME', 'NAME', 'name'])
      const vesselType = (pick(row, ['SHIPTYPE', 'TYPE_NAME', 'type']) ?? '').toLowerCase()
      const normalizedName = (vesselName ?? '').toLowerCase()
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          mmsi,
          name: vesselName,
          flag: pick(row, ['FLAG', 'COUNTRY', 'flag']),
          speed_knots: asNumber(row.SPEED ?? row.speed),
          heading: asNumber(row.HEADING ?? row.COURSE ?? row.heading),
          zone: name,
          is_naval: NAVAL_KEYWORDS.some((keyword) => normalizedName.includes(keyword) || vesselType.includes(keyword)),
          is_tanker: TANKER_KEYWORDS.some((keyword) => normalizedName.includes(keyword) || vesselType.includes(keyword)),
          layer: 'vessels',
        },
      } satisfies GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>]
    }))

    const geojson: VesselCollection = { type: 'FeatureCollection', features }
    await setCachedSnapshot(CACHE_KEY, geojson, CACHE_TTL)
    return NextResponse.json(geojson, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.warn('[live/vessels]', error)
    return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } })
  }
}
