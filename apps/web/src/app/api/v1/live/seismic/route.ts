export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

type SeismicFeature = GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>
type SeismicCollection = GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>

type BoundingBox = [number, number, number, number]

const CACHE_KEY = 'live:seismic'
const CACHE_TTL = 60
const FEED_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'
const CONFLICT_ZONES: BoundingBox[] = [
  [22, 44, 40, 52],
  [25, 14, 60, 40],
  [60, 24, 78, 38],
  [44, 25, 64, 40],
  [124, 37, 131, 43],
]

function isInBounds(lon: number, lat: number, [minLon, minLat, maxLon, maxLat]: BoundingBox) {
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
}

export async function GET() {
  const cached = await getCachedSnapshot<SeismicCollection>(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  const response = await fetch(FEED_URL, { next: { revalidate: CACHE_TTL } })
  if (!response.ok) {
    return NextResponse.json({ error: `USGS request failed with ${response.status}` }, { status: 502 })
  }

  const payload = await response.json() as SeismicCollection
  const features = (payload.features ?? []).map((feature): SeismicFeature => {
    const coordinates = feature.geometry?.coordinates ?? [0, 0, 0]
    const [lon, lat, depth] = coordinates as [number, number, number]
    const properties = (feature.properties ?? {}) as Record<string, unknown>
    const magnitude = typeof properties.mag === 'number' ? properties.mag : Number(properties.mag ?? 0)
    const inConflictZone = CONFLICT_ZONES.some((bbox) => isInBounds(lon, lat, bbox))
    const isSuspicious = depth < 10 && inConflictZone && magnitude >= 1.5

    return {
      ...feature,
      properties: {
        ...properties,
        layer: 'seismic',
        is_suspicious: isSuspicious,
        color: isSuspicious ? '#ef4444' : magnitude >= 5 ? '#f59e0b' : '#eab308',
      },
    }
  })

  const geojson: SeismicCollection = { type: 'FeatureCollection', features }
  await setCachedSnapshot(CACHE_KEY, geojson, CACHE_TTL)
  return NextResponse.json(geojson, { headers: { 'Cache-Control': 'no-store' } })
}
