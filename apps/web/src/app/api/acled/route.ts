export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 20

import { NextRequest, NextResponse } from 'next/server'

// ─── In-memory token cache (survives across requests within the same lambda instance) ───
let cachedToken: { access: string; refreshToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  const email = process.env.ACLED_EMAIL
  const password = process.env.ACLED_PASSWORD
  if (!email || !password) {
    console.error('[ACLED] Missing ACLED_EMAIL or ACLED_PASSWORD env vars')
    return null
  }

  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300_000) {
    return cachedToken.access
  }

  // Try refresh token first if we have one
  if (cachedToken?.refreshToken) {
    try {
      const res = await fetch('https://acleddata.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: cachedToken.refreshToken,
          grant_type: 'refresh_token',
          client_id: 'acled',
        }),
        signal: AbortSignal.timeout(8_000),
      })
      if (res.ok) {
        const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
        cachedToken = {
          access: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
        }
        return cachedToken.access
      }
    } catch {
      // Refresh failed, fall through to full auth
    }
  }

  // Full OAuth password grant
  try {
    const res = await fetch('https://acleddata.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: email,
        password,
        grant_type: 'password',
        client_id: 'acled',
      }),
      signal: AbortSignal.timeout(8_000),
    })

    if (!res.ok) {
      console.error(`[ACLED] OAuth failed: ${res.status} ${res.statusText}`)
      return null
    }

    const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number }
    cachedToken = {
      access: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }
    return cachedToken.access
  } catch (err) {
    console.error('[ACLED] OAuth error:', err)
    return null
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface AcledEvent {
  event_id_cnty: string
  event_date: string
  year: string
  event_type: string
  sub_event_type: string
  actor1: string
  actor2: string
  country: string
  admin1: string
  admin2: string
  latitude: string
  longitude: string
  fatalities: string
  notes: string
  disorder_type: string
  region: string
  interaction: string
  civilian_targeting: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json(
      { events: [], count: 0, error: 'ACLED authentication failed — check env vars' },
      { status: 502 },
    )
  }

  // Build ACLED API query
  const params = new URLSearchParams({
    _format: 'json',
    fields: 'event_id_cnty|event_date|year|event_type|sub_event_type|actor1|actor2|country|admin1|admin2|latitude|longitude|fatalities|notes|disorder_type|region|interaction|civilian_targeting',
  })

  // Time filter
  // ACLED Research-level access: event-level data available only >12 months old
  // We query from (13 months ago) to (13 months ago + window) to get the most
  // recent data the account can access. If window is 'recent', try last 30 days
  // (works for higher access tiers).
  const window = searchParams.get('window') ?? '30d'
  const windowDays = window === '7d' ? 7
    : window === '24h' ? 1
    : window === '90d' ? 90
    : window === '1y' ? 365
    : window === '2y' ? 730
    : window === 'all' ? 730
    : 30

  // Try recent data first (30 days) — if user has higher tier it will work.
  // For Research tier: use 13-months-ago as the start date with the window span
  const useResearchFallback = searchParams.get('research') !== 'false'
  const RESEARCH_OFFSET_DAYS = 395 // ~13 months

  let sinceDate: Date
  let untilDate: Date | null = null

  if (useResearchFallback) {
    // Start from 13 months ago, span the requested window backwards
    untilDate = new Date(Date.now() - RESEARCH_OFFSET_DAYS * 86_400_000)
    sinceDate = new Date(untilDate.getTime() - windowDays * 86_400_000)
  } else {
    sinceDate = new Date(Date.now() - windowDays * 86_400_000)
  }

  const sinceStr = sinceDate.toISOString().split('T')[0] ?? ''
  params.set('event_date', sinceStr)
  params.set('event_date_where', '>=')

  if (untilDate) {
    // ACLED uses BETWEEN for date ranges: event_date=startDate|endDate&event_date_where=BETWEEN
    const untilStr = untilDate.toISOString().split('T')[0] ?? ''
    params.set('event_date', `${sinceStr}|${untilStr}`)
    params.set('event_date_where', 'BETWEEN')
  }

  // Country filter
  const country = searchParams.get('country')
  if (country) params.set('country', country)

  // Region filter — applied server-side after fetch (ACLED's region param is unreliable)
  const ACLED_REGIONS: Record<string, string> = {
    '1': 'Western Africa', '2': 'Middle Africa', '3': 'Eastern Africa',
    '4': 'Southern Africa', '5': 'Northern Africa', '7': 'South Asia',
    '9': 'Southeast Asia', '10': 'Middle East', '11': 'Europe',
    '12': 'Caucasus and Central Asia', '13': 'Central America',
    '14': 'South America', '15': 'Caribbean', '16': 'East Asia',
    '17': 'North America', '18': 'Oceania',
  }
  const regionFilter = searchParams.get('region')
  const regionName = regionFilter ? (ACLED_REGIONS[regionFilter] ?? regionFilter) : null

  // Event type filter
  const eventType = searchParams.get('event_type')
  if (eventType) params.set('event_type', eventType)

  // Disorder type filter
  const disorderType = searchParams.get('disorder_type')
  if (disorderType) params.set('disorder_type', disorderType)

  // Actor filter (LIKE search on actor1 or actor2)
  const actor = searchParams.get('actor')
  if (actor) {
    params.set('actor1', actor)
    params.set('actor1_where', 'LIKE')
  }

  // Fatalities minimum
  const fatalities = searchParams.get('fatalities')
  if (fatalities && fatalities !== '0') {
    params.set('fatalities', fatalities)
    params.set('fatalities_where', '>=')
  }

  // Civilian targeting filter
  const civilianTargeting = searchParams.get('civilian_targeting')
  if (civilianTargeting === 'true') {
    params.set('civilian_targeting', 'Civilian targeting')
  }

  // Limit — when filtering by region server-side, always fetch a large batch
  // since only ~10-15% of events match any given region
  const requestedLimit = Math.min(Number(searchParams.get('limit') ?? 2000), 5000)
  const fetchLimit = regionName ? 10000 : requestedLimit
  params.set('limit', String(fetchLimit))

  // ACLED expects %20 for spaces, not + (URLSearchParams uses +)
  const apiUrl = `https://acleddata.com/api/acled/read?${params.toString().replace(/\+/g, '%20')}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)

    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`[ACLED] API returned ${res.status}: ${res.statusText}`)
      // If 401, clear cached token so next request re-authenticates
      if (res.status === 401) cachedToken = null
      return NextResponse.json(
        { events: [], count: 0, error: `ACLED API error: ${res.status}` },
        { status: 502 },
      )
    }

    const raw = await res.text()
    let data: { data?: AcledEvent[]; count?: number; status?: number; error?: boolean; message?: string }
    try {
      data = JSON.parse(raw)
    } catch {
      console.error('[ACLED] Non-JSON response:', raw.slice(0, 500))
      return NextResponse.json(
        { events: [], count: 0, error: 'ACLED returned non-JSON response', debug: raw.slice(0, 200) },
        { status: 502 },
      )
    }


    if (data.error || data.message) {
      console.error(`[ACLED] API error: ${data.message ?? JSON.stringify(data)}`)
      return NextResponse.json(
        { events: [], count: 0, error: `ACLED: ${data.message ?? 'Unknown error'}` },
        { status: 502 },
      )
    }

    const rawEvents = data.data ?? []

    // Filter by region server-side (ACLED's API region param is unreliable)
    const regionFiltered = regionName
      ? rawEvents.filter(e => e.region === regionName)
      : rawEvents

    // Transform to GeoJSON-like format for the globe
    const events = regionFiltered
      .filter(e => e.latitude && e.longitude && e.latitude !== '0' && e.longitude !== '0')
      .slice(0, requestedLimit)
      .map(e => ({
        id: e.event_id_cnty,
        date: e.event_date,
        year: e.year,
        eventType: e.event_type,
        subEventType: e.sub_event_type,
        actor1: e.actor1,
        actor2: e.actor2,
        country: e.country,
        admin1: e.admin1,
        admin2: e.admin2,
        lat: parseFloat(e.latitude),
        lon: parseFloat(e.longitude),
        fatalities: parseInt(e.fatalities, 10) || 0,
        notes: e.notes,
        disorderType: e.disorder_type,
        region: e.region,
        civilianTargeting: e.civilian_targeting,
        interaction: e.interaction,
      }))

    // In debug mode, include the ACLED API URL and raw count
    const debug = searchParams.get('debug') === 'true'
    const payload: Record<string, unknown> = { count: events.length, events }
    if (debug) {
      payload.acledUrl = apiUrl
      payload.rawCount = rawEvents.length
      payload.tokenOk = !!token
    }

    return NextResponse.json(
      payload,
      { headers: { 'Cache-Control': debug ? 'no-store' : 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch (err) {
    console.error('[ACLED] fetch error:', err)
    return NextResponse.json(
      { events: [], count: 0, error: 'ACLED request failed' },
      { status: 502 },
    )
  }
}
