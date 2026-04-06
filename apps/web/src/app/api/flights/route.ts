export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Optional bounding box to reduce payload and improve rate-limit headroom
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
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (clientId && clientSecret) {
    headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
  }

  // Retry up to 2 times
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(apiUrl, {
        headers,
        next: { revalidate: 15 },
        signal: AbortSignal.timeout(12_000),
      })

      if (res.status === 429) {
        console.warn(`[flights] OpenSky rate limited (attempt ${attempt + 1})`)
        if (attempt === 0) await new Promise(r => setTimeout(r, 2000))
        continue
      }

      if (!res.ok) {
        console.error(`[flights] OpenSky ${res.status}`)
        continue
      }

      const data = await res.json() as { time?: number; states?: unknown[][] }

      const flights = ((data.states ?? []) as unknown[][])
        .filter((s) => s[5] != null && s[6] != null && !s[8]) // has position AND airborne
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

      return NextResponse.json({ time: data.time, count: flights.length, flights })
    } catch (err) {
      console.error(`[flights] attempt ${attempt + 1} error:`, err)
    }
  }

  return NextResponse.json({ flights: [], count: 0, error: 'OpenSky unavailable' })
}
