/**
 * ADS-B Flight Tracking
 * Source: OpenSky Network — free API, registration required
 * Attribution: "Flight data provided by The OpenSky Network"
 *
 * Tracks aircraft of interest:
 * - Military/government aircraft (ICAO hex ranges)
 * - ISR/surveillance aircraft (call sign patterns)
 * - Unusual routing in conflict zones
 * - Squawk 7700 (emergency) / 7600 (comms failure) / 7500 (hijack)
 *
 * Note: OpenSky has a 400-req/day limit on free tier
 * We batch all zones into 1-2 API calls using bbox queries
 */

import { createServiceClient } from '@/lib/supabase/server'

const OPENSKY_BASE = 'https://opensky-network.org/api'

// Military ICAO hex prefixes by country (not exhaustive, most common)
const MILITARY_HEX_PREFIXES = [
  'AE', // USA military
  '43C', // Russia military  
  '7F0', '7F1', // China military
  '33F', '33E', // France military
  '3F4', '3F5', // Germany military
  '43E', // UK military
]

// ISR/surveillance callsign patterns
const ISR_CALLSIGN_PATTERNS = [
  /^FORTE/, /^SENTRY/, /^DRAGON/, /^REAPER/, /^GHOST/,
  /^HAWK/, /^EAGLE/, /^COBRA/, /^VIPER/, /^ATLAS/,
]

export type ADSBFlight = {
  icao24: string
  callsign: string | null
  origin_country: string | null
  latitude: number
  longitude: number
  altitude: number     // meters (barometric)
  velocity: number     // m/s
  heading: number
  squawk: string | null
  is_on_ground: boolean
  last_contact: number // Unix timestamp
  is_military: boolean
  is_isr: boolean
}

export type ADSBResult = {
  tracked: number
  military: number
  emergency: number
  stored: number
}

/**
 * Fetch current flight states from OpenSky for conflict zones
 */
export async function ingestADSB(): Promise<ADSBResult> {
  const result: ADSBResult = { tracked: 0, military: 0, emergency: 0, stored: 0 }

  // OpenSky works without auth but rate limited — use credentials if available
  const username = process.env['OPENSKY_USERNAME']
  const password = process.env['OPENSKY_PASSWORD']

  // Conflict zone bboxes: lamin, lomin, lamax, lomax
  const zones = [
    { name: 'Eastern Europe', params: 'lamin=44&lomin=22&lamax=52&lomax=40' },
    { name: 'Middle East',    params: 'lamin=12&lomin=32&lamax=38&lomax=60' },
    { name: 'East Africa',    params: 'lamin=3&lomin=24&lamax=22&lomax=45' },
  ]

  const supabase = createServiceClient()

  for (const zone of zones) {
    try {
      const url = `${OPENSKY_BASE}/states/all?${zone.params}`
      const headers: Record<string, string> = {}
      if (username && password) {
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) continue

      const data = await res.json() as { states?: Array<Array<unknown>> | null }
      const states = data.states ?? []

      for (const state of states) {
        if (!Array.isArray(state) || state.length < 11) continue

        const icao24 = String(state[0] ?? '')
        const callsign = state[1] ? String(state[1]).trim() : null
        const originCountry = state[2] ? String(state[2]) : null
        const lat = state[6] != null ? Number(state[6]) : null
        const lng = state[5] != null ? Number(state[5]) : null
        const alt = state[7] != null ? Number(state[7]) : 0
        const velocity = state[9] != null ? Number(state[9]) : 0
        const heading = state[10] != null ? Number(state[10]) : 0
        const squawk = state[14] ? String(state[14]) : null
        const onGround = Boolean(state[8])
        const lastContact = Number(state[4] ?? 0)

        if (!lat || !lng) continue

        const isMilitary = MILITARY_HEX_PREFIXES.some(p =>
          icao24.toUpperCase().startsWith(p)
        )
        const isISR = callsign
          ? ISR_CALLSIGN_PATTERNS.some(p => p.test(callsign.toUpperCase()))
          : false

        const flight: ADSBFlight = {
          icao24, callsign, origin_country: originCountry,
          latitude: lat, longitude: lng, altitude: alt,
          velocity, heading, squawk, is_on_ground: onGround,
          last_contact: lastContact, is_military: isMilitary, is_isr: isISR,
        }

        result.tracked++
        if (isMilitary || isISR) result.military++

        // Emergency squawks
        if (squawk === '7700' || squawk === '7600' || squawk === '7500') {
          result.emergency++

          await supabase.from('events').upsert(
            {
              source: 'adsb',
              source_id: `adsb-emergency-${icao24}-${new Date().toISOString().split('T')[0]}`,
              event_type: 'aircraft_emergency',
              title: `Aircraft emergency squawk ${squawk}: ${callsign ?? icao24}`,
              description: `Squawk ${squawk} (${squawk === '7700' ? 'EMERGENCY' : squawk === '7600' ? 'COMMS FAILURE' : 'HIJACK'}) — ${originCountry ?? 'unknown origin'} — Alt: ${Math.round(alt)}m, Spd: ${Math.round(velocity)}m/s`,
              severity: squawk === '7500' ? 5 : 4,
              status: 'pending',
              occurred_at: new Date(lastContact * 1000).toISOString(),
              location: `POINT(${lng} ${lat})`,
              heavy_lane_processed: true,
              provenance_raw: {
                source: 'OpenSky Network',
                attribution: 'Flight data provided by The OpenSky Network (opensky-network.org)',
                squawk,
                icao24,
              },
              raw: flight as unknown as Record<string, unknown>,
            },
            { onConflict: 'source,source_id', ignoreDuplicates: true }
          )
        }

        // Store military/ISR tracks
        if (isMilitary || isISR) {
          await supabase.from('flight_tracks').upsert(
            {
              icao24,
              callsign,
              origin_country: originCountry,
              latitude: lat,
              longitude: lng,
              altitude: alt,
              velocity,
              heading,
              squawk,
              is_military: isMilitary,
              is_isr: isISR,
              location: `POINT(${lng} ${lat})`,
              last_seen: new Date(lastContact * 1000).toISOString(),
            },
            { onConflict: 'icao24' }
          )
          result.stored++
        }
      }
    } catch {
      // skip failed zones
    }
  }

  return result
}
