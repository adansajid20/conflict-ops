export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

type OutageCollection = GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>
type IodaEvent = {
  entity?: { code?: string | null; name?: string | null } | null
  type?: string | null
  score?: number | null
  start?: string | number | null
}

type IodaPayload = { events?: IodaEvent[] | null }

const CACHE_KEY = 'live:outages'
const CACHE_TTL = 300
const EMPTY: OutageCollection = { type: 'FeatureCollection', features: [] }
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  UA: [31.2, 48.4], RU: [60, 60], IL: [34.9, 31.5], PS: [35.2, 31.9], IR: [53.7, 32.4], IQ: [44.4, 33.2],
  SY: [38.5, 35], LB: [35.8, 33.8], JO: [36.0, 31.2], SA: [44.5, 24.0], YE: [47.5, 15.6], TR: [35.2, 39.0],
  AF: [66.0, 33.9], PK: [69.3, 30.4], IN: [78.9, 20.6], CN: [104.2, 35.9], TW: [120.9, 23.7], KP: [127.0, 40.3],
  KR: [127.8, 36.4], SD: [30.2, 15.5], ET: [40.5, 9.1], SO: [45.3, 5.2], EG: [30.8, 26.8], LY: [17.2, 26.3],
}

export async function GET() {
  const cached = await getCachedSnapshot<OutageCollection>(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  try {
    const response = await fetch('https://api.ioda.caida.org/v2/signals/events?from=-24h', { next: { revalidate: CACHE_TTL } })
    if (!response.ok) throw new Error(`IODA request failed with ${response.status}`)
    const payload = await response.json() as IodaPayload | IodaEvent[]
    const events = Array.isArray(payload) ? payload : (payload.events ?? [])

    const features = events.flatMap((event) => {
      const code = event.entity?.code?.toUpperCase() ?? ''
      const coords = COUNTRY_CENTROIDS[code]
      if (!coords || (coords[0] === 0 && coords[1] === 0)) return []
      return [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          country: event.entity?.name ?? code,
          type: event.type ?? 'unknown',
          score: typeof event.score === 'number' ? event.score : null,
          start: event.start ?? null,
          layer: 'outages',
          color: '#8b5cf6',
        },
      } satisfies GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>]
    })

    const geojson: OutageCollection = { type: 'FeatureCollection', features }
    await setCachedSnapshot(CACHE_KEY, geojson, CACHE_TTL)
    return NextResponse.json(geojson, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.warn('[live/outages]', error)
    return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } })
  }
}
