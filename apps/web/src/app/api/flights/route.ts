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
  // ── NORTH AMERICA ──
  { name: 'US East Coast', latRange: [25, 48], lonRange: [-90, -70], count: 140, alt: [7000, 12000], countries: ['United States'] },
  { name: 'US West Coast', latRange: [30, 50], lonRange: [-125, -105], count: 100, alt: [7000, 12000], countries: ['United States'] },
  { name: 'US Central', latRange: [28, 48], lonRange: [-105, -85], count: 110, alt: [7000, 12000], countries: ['United States'] },
  { name: 'Canada', latRange: [43, 62], lonRange: [-130, -60], count: 55, alt: [8000, 12000], countries: ['Canada'] },
  { name: 'Mexico & Central America', latRange: [14, 32], lonRange: [-110, -85], count: 45, alt: [8000, 12000], countries: ['Mexico', 'Guatemala', 'Panama', 'Costa Rica'] },
  { name: 'Caribbean', latRange: [15, 27], lonRange: [-85, -60], count: 35, alt: [8000, 11000], countries: ['Cuba', 'Dominican Republic', 'Jamaica', 'Puerto Rico'] },
  // ── TRANSATLANTIC ──
  { name: 'North Atlantic Track', latRange: [42, 58], lonRange: [-60, -10], count: 90, alt: [10000, 12500], countries: ['United States', 'United Kingdom', 'Ireland', 'Canada', 'Germany'] },
  // ── EUROPE ──
  { name: 'Western Europe', latRange: [36, 52], lonRange: [-10, 10], count: 120, alt: [8000, 12000], countries: ['France', 'United Kingdom', 'Spain', 'Portugal', 'Belgium', 'Netherlands'] },
  { name: 'Central Europe', latRange: [44, 56], lonRange: [5, 25], count: 110, alt: [8000, 12000], countries: ['Germany', 'Austria', 'Poland', 'Czech Republic', 'Switzerland', 'Italy'] },
  { name: 'Eastern Europe', latRange: [40, 58], lonRange: [20, 45], count: 60, alt: [9000, 12000], countries: ['Romania', 'Ukraine', 'Greece', 'Bulgaria', 'Hungary'] },
  { name: 'Scandinavia', latRange: [55, 70], lonRange: [5, 30], count: 40, alt: [9000, 12000], countries: ['Norway', 'Sweden', 'Finland', 'Denmark'] },
  { name: 'Mediterranean', latRange: [32, 44], lonRange: [-5, 35], count: 70, alt: [8000, 12000], countries: ['Italy', 'Spain', 'Greece', 'Turkey', 'Egypt', 'Morocco'] },
  // ── MIDDLE EAST ──
  { name: 'Gulf States Hub', latRange: [22, 32], lonRange: [44, 58], count: 80, alt: [9000, 12000], countries: ['United Arab Emirates', 'Qatar', 'Saudi Arabia', 'Bahrain', 'Kuwait', 'Oman'] },
  { name: 'Levant & Turkey', latRange: [30, 42], lonRange: [28, 48], count: 50, alt: [9000, 12000], countries: ['Turkey', 'Israel', 'Jordan', 'Lebanon', 'Iraq'] },
  // ── AFRICA ──
  { name: 'North Africa', latRange: [18, 36], lonRange: [-15, 35], count: 45, alt: [9000, 12000], countries: ['Egypt', 'Morocco', 'Algeria', 'Tunisia', 'Libya'] },
  { name: 'West Africa', latRange: [4, 18], lonRange: [-18, 10], count: 30, alt: [9000, 12000], countries: ['Nigeria', 'Ghana', 'Senegal', 'Ivory Coast', 'Mali'] },
  { name: 'East Africa', latRange: [-12, 12], lonRange: [28, 50], count: 35, alt: [9000, 12000], countries: ['Kenya', 'Ethiopia', 'Tanzania', 'Uganda', 'Rwanda'] },
  { name: 'Southern Africa', latRange: [-35, -15], lonRange: [15, 40], count: 25, alt: [9000, 12000], countries: ['South Africa', 'Mozambique', 'Zimbabwe', 'Zambia', 'Botswana'] },
  // ── SOUTH ASIA ──
  { name: 'Indian Subcontinent', latRange: [8, 35], lonRange: [68, 92], count: 85, alt: [9000, 12000], countries: ['India', 'Pakistan', 'Sri Lanka', 'Bangladesh', 'Nepal'] },
  // ── EAST ASIA ──
  { name: 'China Domestic', latRange: [20, 45], lonRange: [100, 125], count: 160, alt: [8000, 12000], countries: ['China'] },
  { name: 'Japan & Korea', latRange: [30, 45], lonRange: [125, 145], count: 80, alt: [8000, 12000], countries: ['Japan', 'South Korea'] },
  { name: 'Taiwan & HK', latRange: [20, 28], lonRange: [112, 125], count: 40, alt: [8000, 12000], countries: ['Taiwan', 'Hong Kong', 'Macau'] },
  // ── SOUTHEAST ASIA ──
  { name: 'SE Asia North', latRange: [10, 25], lonRange: [95, 115], count: 55, alt: [8000, 12000], countries: ['Thailand', 'Vietnam', 'Myanmar', 'Cambodia', 'Laos'] },
  { name: 'SE Asia South', latRange: [-8, 10], lonRange: [95, 130], count: 60, alt: [8000, 12000], countries: ['Indonesia', 'Malaysia', 'Singapore', 'Philippines', 'Brunei'] },
  // ── SOUTH AMERICA ──
  { name: 'Brazil Domestic', latRange: [-30, 0], lonRange: [-55, -35], count: 60, alt: [8000, 12000], countries: ['Brazil'] },
  { name: 'Andes Region', latRange: [-40, 5], lonRange: [-80, -60], count: 40, alt: [8000, 12000], countries: ['Argentina', 'Chile', 'Colombia', 'Peru', 'Ecuador', 'Bolivia'] },
  // ── OCEANIA ──
  { name: 'Australia East', latRange: [-40, -12], lonRange: [140, 155], count: 35, alt: [9000, 12000], countries: ['Australia'] },
  { name: 'Australia West', latRange: [-35, -15], lonRange: [110, 140], count: 20, alt: [9000, 12000], countries: ['Australia'] },
  { name: 'New Zealand', latRange: [-48, -34], lonRange: [165, 180], count: 15, alt: [9000, 12000], countries: ['New Zealand'] },
  { name: 'Pacific Islands', latRange: [-20, 10], lonRange: [160, 200], count: 15, alt: [10000, 12000], countries: ['Fiji', 'Papua New Guinea', 'Samoa', 'Tonga'] },
  // ── TRANSOCEANIC ──
  { name: 'North Pacific Track', latRange: [30, 55], lonRange: [145, 210], count: 45, alt: [10000, 12500], countries: ['Japan', 'United States', 'South Korea', 'Canada'] },
  { name: 'Europe-Asia', latRange: [40, 62], lonRange: [30, 100], count: 50, alt: [10000, 12500], countries: ['Russia', 'Kazakhstan', 'Uzbekistan'] },
  { name: 'South Atlantic', latRange: [-15, 10], lonRange: [-40, 5], count: 20, alt: [10000, 12000], countries: ['Brazil', 'Angola', 'Cape Verde'] },
  { name: 'Indian Ocean', latRange: [-15, 15], lonRange: [50, 90], count: 30, alt: [10000, 12000], countries: ['India', 'Maldives', 'Mauritius', 'Madagascar'] },
]

const AIRLINE_PREFIXES = ['UAL', 'DAL', 'AAL', 'BAW', 'DLH', 'AFR', 'KLM', 'SIA', 'CPA', 'QFA', 'UAE', 'QTR', 'THY', 'ANA', 'JAL', 'KAL', 'CCA', 'CSN', 'CES', 'RYR', 'EZY', 'SWR', 'AUA', 'TAP', 'IBE', 'ETH', 'SAA', 'RAM', 'SVA', 'GIA']

// Mulberry32-based PRNG — works reliably at any seed magnitude
function seededRandom(seed: number): number {
  let t = (seed + 0x6D2B79F5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function generateSimulatedFlights() {
  const epoch = Math.floor(Date.now() / 30000) // shifts every 30 seconds
  const flights: Array<{
    icao24: string; callsign: string; originCountry: string;
    longitude: number; latitude: number; altitude: number;
    onGround: boolean; velocity: number; heading: number;
    verticalRate: number; squawk?: string; corridor?: string;
  }> = []

  let globalIdx = 0
  for (const corridor of AIR_CORRIDORS) {
    for (let i = 0; i < corridor.count; i++) {
      const seed = epoch * 7919 + globalIdx * 104729 + i * 15487
      const r1 = seededRandom(seed)
      const r2 = seededRandom(seed + 31)
      const r3 = seededRandom(seed + 67)
      const r4 = seededRandom(seed + 127)
      const r5 = seededRandom(seed + 211)

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

      // Simulate vertical rates for some flights (climbing/descending near airports)
      const vertRate = r5 < 0.15 ? Math.round((r4 - 0.5) * 30) : 0

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
        verticalRate: vertRate,
        corridor: corridor.name,
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
