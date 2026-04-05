export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const url = 'https://opensky-network.org/api/states/all'
    const headers: Record<string, string> = { Accept: 'application/json' }

    const clientId = process.env.OPENSKY_CLIENT_ID
    const clientSecret = process.env.OPENSKY_CLIENT_SECRET
    if (clientId && clientSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    }

    const res = await fetch(url, { headers, next: { revalidate: 10 } })
    if (!res.ok) return NextResponse.json({ flights: [], error: `OpenSky ${res.status}` })

    const data = await res.json() as { time: number; states?: unknown[][] }

    const flights = ((data.states ?? []) as unknown[][])
      .filter((s) => s[5] != null && s[6] != null)
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
    return NextResponse.json({ flights: [], error: String(err) })
  }
}
