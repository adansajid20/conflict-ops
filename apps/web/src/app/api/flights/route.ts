export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 15

import { NextRequest, NextResponse } from 'next/server'

const CACHE_KEY = 'flights:latest'
const CACHE_TTL = 30 // seconds

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
  // Try memory cache first (same serverless instance)
  if (memoryCache && (Date.now() - memoryCache.ts) < CACHE_TTL * 1000) {
    return memoryCache.data
  }
  // Try Redis
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const lamin = searchParams.get('lamin')
  const lamax = searchParams.get('lamax')
  const lomin = searchParams.get('lomin')
  const lomax = searchParams.get('lomax')

  let apiUrl = 'https://opensky-network.org/api/states/all'
  if (lamin && lamax && lomin && lomax) {
    apiUrl += `?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`
  }

  // OpenSky uses username:password Basic Auth
  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'ConflictRadar/1.0',
  }
  if (clientId && clientSecret) {
    // Strip any "-api-client" suffix from username if present
    const username = clientId.replace(/-api-client$/, '')
    headers['Authorization'] = `Basic ${Buffer.from(`${username}:${clientSecret}`).toString('base64')}`
  }

  // Retry up to 3 times with increasing backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12_000)

      const res = await fetch(apiUrl, {
        headers,
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (res.status === 429) {
        console.warn(`[flights] OpenSky rate limited (attempt ${attempt + 1})`)
        // Serve cached data on rate limit
        const cached = await getCachedFlights()
        if (cached) {
          return NextResponse.json(cached, {
            headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30', 'X-Source': 'cache' },
          })
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }

      if (!res.ok) {
        console.error(`[flights] OpenSky ${res.status} ${res.statusText}`)
        // Try unauthenticated if auth fails
        if (res.status === 401 || res.status === 403) {
          delete headers['Authorization']
        }
        continue
      }

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

      const result = { time: data.time, count: flights.length, flights }
      await setCachedFlights(result)

      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
      })
    } catch (err) {
      console.error(`[flights] attempt ${attempt + 1} error:`, err)
    }
  }

  // Final fallback: serve cached data
  const cached = await getCachedFlights()
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=10', 'X-Source': 'cache-fallback' },
    })
  }

  return NextResponse.json(
    { flights: [], count: 0, error: 'OpenSky unavailable' },
    { status: 502 },
  )
}
