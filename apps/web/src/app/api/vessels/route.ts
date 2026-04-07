export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * Generates realistic vessel positions along major global shipping lanes.
 * Uses deterministic seeding so positions shift naturally over time (every ~30s).
 * This replaces the AIS WebSocket dependency until a live feed is available.
 */

// Major shipping lane waypoints (lat, lng pairs defining route corridors)
const SHIPPING_LANES = [
  // Strait of Hormuz / Persian Gulf
  { name: 'Persian Gulf', vessels: 45, waypoints: [[26.5, 56.2], [25.5, 54.5], [24.8, 52.0], [26.0, 50.5], [29.0, 48.8]] },
  // Red Sea / Bab el-Mandeb / Suez
  { name: 'Red Sea', vessels: 40, waypoints: [[12.5, 43.3], [15.0, 42.0], [20.0, 38.5], [25.0, 35.0], [30.0, 32.6]] },
  // Suez Canal to Mediterranean
  { name: 'Suez-Med', vessels: 35, waypoints: [[30.0, 32.6], [31.5, 32.3], [33.0, 30.0], [35.5, 25.0], [36.5, 15.0], [36.0, 5.0]] },
  // Strait of Malacca
  { name: 'Malacca Strait', vessels: 50, waypoints: [[1.2, 103.8], [2.5, 101.5], [4.0, 99.5], [5.5, 98.0], [7.0, 97.0]] },
  // South China Sea
  { name: 'South China Sea', vessels: 55, waypoints: [[1.3, 104.0], [5.0, 109.0], [10.0, 112.0], [15.0, 115.0], [20.0, 117.0], [22.3, 114.2]] },
  // Taiwan Strait
  { name: 'Taiwan Strait', vessels: 30, waypoints: [[22.5, 118.0], [23.5, 119.0], [24.5, 119.5], [25.5, 120.0]] },
  // English Channel / North Sea
  { name: 'English Channel', vessels: 35, waypoints: [[48.5, -5.0], [49.5, -2.0], [50.5, 0.5], [51.5, 2.0], [53.0, 4.0]] },
  // Mediterranean
  { name: 'Mediterranean', vessels: 40, waypoints: [[36.0, -5.5], [37.0, 0.0], [38.0, 5.0], [37.5, 10.0], [35.5, 15.0], [35.0, 24.0]] },
  // Gulf of Aden
  { name: 'Gulf of Aden', vessels: 25, waypoints: [[11.5, 43.0], [12.0, 45.0], [12.5, 48.0], [14.0, 50.0], [15.5, 52.0]] },
  // East Africa coast
  { name: 'East Africa', vessels: 20, waypoints: [[-4.0, 39.6], [-6.0, 39.3], [-12.0, 40.0], [-15.0, 40.5], [-25.0, 35.0], [-34.0, 26.0]] },
  // US East Coast
  { name: 'US East Coast', vessels: 30, waypoints: [[25.8, -80.2], [30.0, -81.0], [33.0, -79.0], [37.0, -76.0], [40.7, -74.0]] },
  // US West Coast / Pacific
  { name: 'US West Coast', vessels: 25, waypoints: [[33.7, -118.3], [37.8, -122.4], [46.0, -124.0], [48.5, -123.0]] },
  // North Atlantic
  { name: 'North Atlantic', vessels: 30, waypoints: [[40.7, -74.0], [42.0, -60.0], [45.0, -40.0], [48.0, -20.0], [50.0, -5.0]] },
  // Indian Ocean
  { name: 'Indian Ocean', vessels: 35, waypoints: [[6.0, 80.0], [5.0, 73.0], [8.0, 60.0], [12.0, 50.0], [12.5, 43.3]] },
  // Black Sea
  { name: 'Black Sea', vessels: 20, waypoints: [[41.0, 29.0], [42.0, 33.0], [43.5, 37.0], [44.0, 38.0], [45.0, 36.5]] },
  // Baltic Sea
  { name: 'Baltic Sea', vessels: 25, waypoints: [[54.5, 10.0], [55.5, 13.0], [56.5, 16.0], [58.0, 18.0], [59.3, 18.1], [59.9, 24.8]] },
  // Japan / Korea shipping
  { name: 'East Asia', vessels: 35, waypoints: [[35.4, 129.5], [34.0, 131.0], [33.0, 132.5], [34.5, 137.0], [35.5, 139.7]] },
  // Panama approach
  { name: 'Panama', vessels: 20, waypoints: [[9.0, -79.5], [8.5, -79.0], [8.0, -78.0], [7.5, -77.0]] },
  // Cape of Good Hope
  { name: 'Cape Route', vessels: 15, waypoints: [[-34.0, 18.5], [-35.0, 22.0], [-34.5, 26.0], [-30.0, 31.0]] },
]

const VESSEL_TYPES = [
  { type: 'Cargo', shipType: 70, weight: 35 },
  { type: 'Tanker', shipType: 80, weight: 25 },
  { type: 'Container', shipType: 71, weight: 20 },
  { type: 'Bulk Carrier', shipType: 72, weight: 10 },
  { type: 'Passenger', shipType: 60, weight: 5 },
  { type: 'Fishing', shipType: 30, weight: 3 },
  { type: 'Tug', shipType: 52, weight: 2 },
]

const VESSEL_NAMES_PREFIX = [
  'MSC', 'MAERSK', 'CMA CGM', 'COSCO', 'EVERGREEN', 'HAPAG', 'ONE', 'HMM', 'YANG MING',
  'PIL', 'ZIM', 'OOCL', 'KMTC', 'SINOTRANS', 'GRIMALDI', 'WALLENIUS',
  'TORM', 'STENA', 'EURONAV', 'FRONTLINE', 'SCORPIO', 'DHT', 'TEEKAY',
]

const VESSEL_NAMES_SUFFIX = [
  'STAR', 'FORTUNE', 'GLORY', 'HOPE', 'SPIRIT', 'PRIDE', 'DIAMOND', 'PEARL',
  'COURAGE', 'VICTORY', 'LIBERTY', 'UNITY', 'HARMONY', 'PACIFIC', 'ATLANTIC',
  'PIONEER', 'NAVIGATOR', 'EXPLORER', 'VOYAGER', 'ENDEAVOUR',
]

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function interpolateWaypoints(
  waypoints: number[][],
  t: number,
): { lat: number; lng: number; heading: number } {
  const totalSegments = waypoints.length - 1
  const segIndex = Math.min(Math.floor(t * totalSegments), totalSegments - 1)
  const segT = (t * totalSegments) - segIndex

  const p0 = waypoints[segIndex]!
  const p1 = waypoints[Math.min(segIndex + 1, waypoints.length - 1)]!

  const lat = p0[0]! + (p1[0]! - p0[0]!) * segT
  const lng = p0[1]! + (p1[1]! - p0[1]!) * segT

  // Calculate heading from segment direction
  const dlat = p1[0]! - p0[0]!
  const dlng = p1[1]! - p0[1]!
  const heading = (Math.atan2(dlng, dlat) * 180 / Math.PI + 360) % 360

  return { lat, lng, heading }
}

function pickVesselType(seed: number): typeof VESSEL_TYPES[number] {
  const r = seededRandom(seed * 7.7)
  const totalWeight = VESSEL_TYPES.reduce((sum, vt) => sum + vt.weight, 0)
  let acc = 0
  for (const vt of VESSEL_TYPES) {
    acc += vt.weight / totalWeight
    if (r <= acc) return vt
  }
  return VESSEL_TYPES[0]!
}

export async function GET() {
  // Shift positions every ~30 seconds for natural movement
  const epoch = Math.floor(Date.now() / 30000)
  const vessels: Array<{
    mmsi: string
    name: string
    latitude: number
    longitude: number
    speed: number
    course: number
    type: number
    destination: string
    shipTypeName: string
    lane: string
  }> = []

  let globalIndex = 0

  for (const lane of SHIPPING_LANES) {
    for (let i = 0; i < lane.vessels; i++) {
      const vesselSeed = globalIndex * 31.7 + 42
      const timeSeed = epoch * 0.01 + vesselSeed * 0.001

      // Position along route (0-1), slowly drifting over time
      const baseT = seededRandom(vesselSeed)
      const drift = seededRandom(timeSeed) * 0.08 - 0.04
      const t = Math.max(0, Math.min(1, baseT + drift))

      const pos = interpolateWaypoints(lane.waypoints, t)

      // Add lateral scatter (vessels don't follow exact line)
      const scatter = (seededRandom(vesselSeed * 3.3) - 0.5) * 0.8
      pos.lat += scatter
      pos.lng += (seededRandom(vesselSeed * 5.1) - 0.5) * 0.8

      const vtype = pickVesselType(vesselSeed)
      const speed = 5 + seededRandom(vesselSeed * 2.2) * 16 // 5-21 knots

      const prefixIdx = Math.floor(seededRandom(vesselSeed * 1.1) * VESSEL_NAMES_PREFIX.length)
      const suffixIdx = Math.floor(seededRandom(vesselSeed * 4.4) * VESSEL_NAMES_SUFFIX.length)
      const name = `${VESSEL_NAMES_PREFIX[prefixIdx]} ${VESSEL_NAMES_SUFFIX[suffixIdx]}`

      // Generate realistic MMSI (9 digits)
      const mmsi = `${200000000 + Math.floor(seededRandom(vesselSeed * 9.9) * 600000000)}`

      vessels.push({
        mmsi,
        name,
        latitude: pos.lat,
        longitude: pos.lng,
        speed: Math.round(speed * 10) / 10,
        course: Math.round(pos.heading * 10) / 10,
        type: vtype.shipType,
        destination: lane.name,
        shipTypeName: vtype.type,
        lane: lane.name,
      })

      globalIndex++
    }
  }

  return NextResponse.json(
    { count: vessels.length, vessels },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  )
}
