export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'

type BoundingBox = [number, number, number, number]
type FlightFeature = GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>
type FlightCollection = GeoJSON.FeatureCollection<GeoJSON.Point, GeoJSON.GeoJsonProperties>
type OpenSkyState = [
  string | null,
  string | null,
  string | null,
  unknown,
  unknown,
  number | null,
  number | null,
  number | null,
  boolean | null,
  number | null,
  number | null,
  ...unknown[],
]

type OpenSkyResponse = { states?: OpenSkyState[] | null }

const CACHE_KEY = 'live:flights'
const CACHE_TTL = 30
const REGIONS: Array<{ name: string; bbox: BoundingBox }> = [
  { name: 'Ukraine/Russia', bbox: [22, 44, 45, 55] },
  { name: 'Middle East', bbox: [25, 14, 65, 42] },
  { name: 'Red Sea', bbox: [32, 5, 55, 25] },
  { name: 'Taiwan Strait', bbox: [115, 20, 135, 35] },
  { name: 'Baltic', bbox: [10, 53, 30, 66] },
]
const SURVEILLANCE_PREFIXES = ['FORTE', 'JAKE', 'RONIN', 'SNAKE', 'COBRA', 'REACH', 'RCH', 'DUKE']
const EMERGENCY_SQUAWKS = new Set(['7700', '7600', '7500'])
const MILITARY_PREFIXES = ['ae', '43', '44']

const EMPTY: FlightCollection = { type: 'FeatureCollection', features: [] }

function matchesFlight(state: OpenSkyState) {
  const icao24 = (state[0] ?? '').toLowerCase()
  const callsign = (state[1] ?? '').trim().toUpperCase()
  const squawk = state[13]
  const squawkCode = typeof squawk === 'string' ? squawk.trim() : ''
  const onGround = Boolean(state[8])
  const isSurveillance = SURVEILLANCE_PREFIXES.some((prefix) => callsign.startsWith(prefix)) || MILITARY_PREFIXES.some((prefix) => icao24.startsWith(prefix))
  const isEmergency = EMERGENCY_SQUAWKS.has(squawkCode)
  return !onGround && (isSurveillance || isEmergency)
}

export async function GET() {
  const cached = await getCachedSnapshot<FlightCollection>(CACHE_KEY)
  if (cached) return NextResponse.json(cached)

  try {
    const regionResponses = await Promise.all(
      REGIONS.map(async ({ name, bbox }) => {
        const [lomin, lamin, lomax, lamax] = bbox
        const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`
        const response = await fetch(url, { next: { revalidate: CACHE_TTL } })
        if (!response.ok) throw new Error(`OpenSky ${name} failed with ${response.status}`)
        const payload = await response.json() as OpenSkyResponse
        return { name, states: payload.states ?? [] }
      })
    )

    const features: FlightFeature[] = []
    const seen = new Set<string>()

    for (const { name, states } of regionResponses) {
      for (const state of states) {
        if (!matchesFlight(state)) continue
        const icao24 = (state[0] ?? '').toLowerCase()
        const callsign = (state[1] ?? '').trim()
        const originCountry = state[2] ?? null
        const longitude = state[5]
        const latitude = state[6]
        if (typeof longitude !== 'number' || typeof latitude !== 'number') continue
        const featureId = `${icao24}:${name}`
        if (seen.has(featureId)) continue
        seen.add(featureId)
        const squawk = typeof state[13] === 'string' ? state[13].trim() : null
        const isSurveillance = SURVEILLANCE_PREFIXES.some((prefix) => callsign.toUpperCase().startsWith(prefix)) || MILITARY_PREFIXES.some((prefix) => icao24.startsWith(prefix))
        const isEmergency = squawk ? EMERGENCY_SQUAWKS.has(squawk) : false

        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
          properties: {
            id: icao24,
            callsign: callsign || null,
            origin_country: originCountry,
            altitude_m: typeof state[7] === 'number' ? state[7] : null,
            velocity_ms: typeof state[9] === 'number' ? state[9] : null,
            heading: typeof state[10] === 'number' ? state[10] : null,
            squawk,
            region: name,
            is_surveillance: isSurveillance,
            is_emergency: isEmergency,
            layer: 'flights',
          },
        })
      }
    }

    const geojson: FlightCollection = { type: 'FeatureCollection', features }
    await setCachedSnapshot(CACHE_KEY, geojson, CACHE_TTL)
    return NextResponse.json(geojson, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.warn('[live/flights]', error)
    return NextResponse.json(EMPTY, { headers: { 'Cache-Control': 'no-store' } })
  }
}
