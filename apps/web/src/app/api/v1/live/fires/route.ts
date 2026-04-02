export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

type BoundingBox = [number, number, number, number]
type FireCollection = GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>
type FirmsRow = Record<string, string | number | null | undefined>

const CACHE_KEY = 'live:fires'
const CACHE_TTL = 3600
const EMPTY: FireCollection = { type: 'FeatureCollection', features: [] }
const CONFLICT_ZONES: Array<{ name: string; bbox: BoundingBox }> = [
  { name: 'Ukraine', bbox: [22, 44, 40, 52] },
  { name: 'Middle East', bbox: [25, 14, 60, 40] },
  { name: 'Pakistan/Afghanistan', bbox: [60, 24, 78, 38] },
  { name: 'Iran', bbox: [44, 25, 64, 40] },
  { name: 'North Korea', bbox: [124, 37, 131, 43] },
]

function asNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function inZone(lon: number, lat: number, [minLon, minLat, maxLon, maxLat]: BoundingBox) {
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
}

export async function GET() {
  if (!process.env.NASA_FIRMS_API_KEY) {
    return NextResponse.json({ type: 'FeatureCollection', features: [], meta: { disabled: true, reason: 'NASA_FIRMS_API_KEY not configured' } })
  }

  const cached = await getCachedSnapshot<FireCollection>(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  try {
    const source = process.env.NASA_FIRMS_SOURCE ?? 'VIIRS_SNPP_NRT'
    const days = process.env.NASA_FIRMS_DAYS ?? '1'
    const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${process.env.NASA_FIRMS_API_KEY}/${source}/WORLD/${days}`
    const response = await fetch(url, { next: { revalidate: CACHE_TTL } })
    if (!response.ok) throw new Error(`NASA FIRMS request failed with ${response.status}`)
    const csv = await response.text()
    const [headerLine, ...lines] = csv.trim().split(/\r?\n/)
    if (!headerLine) throw new Error('NASA FIRMS returned empty CSV payload')
    const headers = headerLine.split(',')
    const rows: FirmsRow[] = lines.map((line) => {
      const values = line.split(',')
      return headers.reduce<FirmsRow>((acc, header, index) => {
        acc[header] = values[index] ?? null
        return acc
      }, {})
    })

    const features = rows.flatMap((row) => {
      const lat = asNumber(row.latitude)
      const lon = asNumber(row.longitude)
      if (lat === null || lon === null) return []
      const zone = CONFLICT_ZONES.find(({ bbox }) => inZone(lon, lat, bbox))
      if (!zone) return []
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          ...row,
          region: zone.name,
          layer: 'fires',
          color: '#ff4500',
        },
      } satisfies GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>]
    })

    const geojson: FireCollection = { type: 'FeatureCollection', features }
    await setCachedSnapshot(CACHE_KEY, geojson, CACHE_TTL)
    return NextResponse.json(geojson, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.warn('[live/fires]', error)
    return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } })
  }
}
