export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextRequest, NextResponse } from 'next/server'

const CACHE_KEY = 'flights:latest'
const CACHE_TTL = 60 // seconds

let memoryCache: { data: unknown; ts: number } | null = null

async function getRedis() {
  try {
    const { Redis } = await import('@upstash/redis')
    return Redis.fromEnv()
  } catch {
    return null
  }
}

async function getCachedFlights(): Promise<unknown | null> {
  if (memoryCache && (Date.now() - memoryCache.ts) < CACHE_TTL * 1000) {
    return memoryCache.data
  }
  try {
    const redis = await getRedis()
    if (!redis) return null
    return await redis.get(CACHE_KEY)
  } catch {
    return null
  }
}

async function setCachedFlights(data: unknown) {
  memoryCache = { data, ts: Date.now() }
  try {
    const redis = await getRedis()
    if (redis) await redis.set(CACHE_KEY, data, { ex: CACHE_TTL })
  } catch { /* silent */ }
}

// ── Simulated flight data as fallback ──────────────────────────────
// Major air corridors with realistic flight density
const AIR_CORRIDORS = [
  // Transatlantic
  { name: 'North Atlantic', latRange: [42, 58], lonRange: [-60, -10], count: 120, alt: [9000, 12000], countries: ['United States', 'United Kingdom', 'Germany', 'France', 'Canada'] },
  // Europe
  { name: 'European', latRange: [36, 60], lonRange: [-10, 30], count: 200, alt: [8000, 12000], countries: ['Germany', 'France', 'United Kingdom', 'Spain', 'Italy', 'Netherlands', 'Turkey'] },
  // Middle East hub
  { name: 'Middle East', latRange: [20, 38], lonRange: [30, 60], count: 80, alt: [9000, 12000], countries: ['United Arab Emirates', 'Qatar', 'Saudi Arabia', 'Turkey', 'Iran'] },
  // South Asia
  { name: 'South Asia', latRange: [8, 35], lonRange: [60, 90], count: 70, alt: [9000, 12000], countries: ['India', 'Pakistan', 'Sri Lanka', 'Bangladesh'] },
  // East Asia
  { name: 'East Asia', latRange: [20, 45], lonRange: [100, 145], count: 150, alt: [9000, 12000], countries: ['China', 'Japan', 'South Korea', 'Taiwan', 'Hong Kong'] },
  // Southeast Asia
  { name: 'Southeast Asia', latRange: [-8, 20], lonRange: [95, 125], count: 80, alt: [8000, 12000], countries: ['Singapore', 'Thailand', 'Indonesia', 'Malaysia', 'Vietnam', 'Philippines'] },
  // North America domestic
  { name: 'US Domestic', latRange: [25, 50], lonRange: [-125, -70], count: 250, alt: [7000, 12000], countries: ['United States'] },
  // Africa
  { name: 'Africa', latRange: [-30, 15], lonRange: [-15, 50], count: 40, alt: [9000, 12000], countries: ['South Africa', 'Kenya', 'Ethiopia', 'Nigeria', 'Egypt'] },
  // South America
  { name: 'South America', latRange: [-40, 10], lonRange: [-80, -35], count: 50, alt: [8000, 12000], countries: ['Brazil', 'Argentina', 'Colombia', 'Chile', 'Peru'] },
  // Australia
  { name: 'Oceania', latRange: [-45, -10], lonRange: [110, 180], count: 30, alt: [9000, 12000], countries: ['Australia', 'New Zealand'] },
  // Transpacific
  { name: 'Transpacific', latRange: [30, 55], lonRange: [145, 210], count: 40, alt: [10000, 12000], countries: ['Japan', 'United States', 'South Korea', 'Canada'] },
  // Russia / Central Asia
  { name: 'Russia', latRange: [45, 65], lonRange: [30, 140], count: 35, alt: [9000, 12000], countries: ['Russia'] },
]

const AIRLINE_PREFIXES = ['UAL', 'DAL', 'AAL', 'BAW', 'DLH', 'AFR', 'KLM', 'SIA', 'CPA', 'QFA', 'UAE', 'QTR', 'THY', 'ANA', 'JAL', 'KAL', 'CCA', 'CSN', 'CES', 'RYR', 'EZY', 'SWR', 'AUA', 'TAP', 'IBE', 'ETH', 'SAA', 'RAM', 'SVA', 'GIA']

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateSimulatedFlights() {
  const epoch = Math.floor(Date.now() / 30000) // shifts every 30 seconds
  const flights: Array<{
    icao24: string; callsign: string; originCountry: string;
    longitude: number; latitude: number; altitude: number;
    onGround: boolean; velocity: number; heading: number;
    verticalRate: number; squawk?: string;
  }> = []

  let globalIdx = 0
  for (const corridor of AIR_CORRIDORS) {
    for (let i = 0; i < corridor.count; i++) {
      const seed = epoch * 1000 + globalIdx * 7 + i * 13
      const r1 = seededRandom(seed)
      const r2 = seededRandom(seed + 1)
      const r3 = seededRandom(seed + 2)
      const r4 = seededRandom(seed + 3)
      const r5 = seededRandom(seed + 4)

      const lat = corridor.latRange[0]! + r1 * (corridor.latRange[1]! - corridor.latRange[0]!)
      let lon = corridor.lonRange[0]! + r2 * (corridor.lonRange[1]! - corridor.lonRange[0]!)
      // Normalize longitude
      if (lon > 180) lon -= 360

      const alt = corridor.alt[0]! + r3 * (corridor.alt[1]! - corridor.alt[0]!)
      const heading = r4 * 360
      const velocity = 180 + r5 * 80 // 180-260 m/s typical cruise

      const airline = AIRLINE_PREFIXES[Math.floor(r1 * AIRLINE_PREFIXES.length)]!
      const flightNum = Math.floor(r2 * 9000 + 100)
      const country = corridor.countries[Math.floor(r3 * corridor.countries.length)]!

      flights.push({
        icao24: `${Math.floor(r1 * 16777215).toString(16).padStart(6, '0')}`,
        callsign: `${airline}${flightNum}`,
        originCountry: country,
        latitude: lat,
        longitude: lon,
        altitude: Math.round(alt),
        onGround: false,
        velocity: Math.round(velocity),
        heading: Math.round(heading),
        verticalRate: 0,
      })
      globalIdx++
    }
  }

  return { time: Math.floor(Date.now() / 1000), count: flights.length, flights }
}

export async function GET(request: NextRequest) {
  // Check cache first — avoids hammering OpenSky
  const cached = await getCachedFlights()
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30', 'X-Source': 'cache' },
    })
  }

  const { searchParams } = new URL(request.url)

  const lamin = searchParams.get('lamin')
  const lamax = searchParams.get('lamax')
  const lomin = searchParams.get('lomin')
  const lomax = searchParams.get('lomax')

  let apiUrl = 'https://opensky-network.org/api/states/all'
  if (lamin && lamax && lomin && lomax) {
    apiUrl += `?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`
  }

  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ConflictRadar/1.0',
  }
  if (clientId && clientSecret) {
    const username = clientId.replace(/-api-client$/, '')
    headers['Authorization'] = `Basic ${Buffer.from(`${username}:${clientSecret}`).toString('base64')}`
  }

  // Single attempt with tight timeout
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)

    const res = await fetch(apiUrl, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json() as { time?: number; states?: unknown[][] }
      const flights = ((data.states ?? []) as unknown[][])
        .filter((s) => s[5] != null && s[6] != null && !s[8])
        .map((s) => ({
          icao24: String(s[0] ?? ''),
          callsign: String(s[1] ?? '').trim(),
          originCountry: String(s[2] ?? ''),
          longitude: Number(s[5]),
          latitude: Number(s[6]),
          altitude: Number(s[7] ?? s[13] ?? 0),
          onGround: Boolean(s[8]),
          velocity: Number(s[9] ?? 0),
          heading: Number(s[10] ?? 0),
          verticalRate: Number(s[11] ?? 0),
          squawk: s[14] ? String(s[14]) : undefined,
        }))

      if (flights.length > 0) {
        const result = { time: data.time, count: flights.length, flights }
        await setCachedFlights(result)
        return NextResponse.json(result, {
          headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
        })
      }
    }
  } catch {
    // OpenSky unreachable — fall through to simulated data
  }

  // Fallback: simulated realistic flight data
  const simulated = generateSimulatedFlights()
  await setCachedFlights(simulated)
  return NextResponse.json(simulated, {
    headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30', 'X-Source': 'simulated' },
  })
}
