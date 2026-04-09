export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

const CONFLICT_ZONES: [string, number, number, number, number][] = [
  ['Ukraine',       44.0, 53.0, 22.0, 40.5],
  ['Syria-Iraq',    29.0, 37.5, 35.0, 50.0],
  ['Gaza-Israel',   29.5, 33.5, 33.0, 36.0],
  ['Yemen',         12.0, 19.0, 41.0, 55.0],
  ['Red Sea',       12.0, 30.0, 32.0, 45.0],
  ['Iran',          25.0, 40.0, 44.0, 63.5],
  ['Libya',         19.0, 34.0,  9.0, 25.5],
  ['Sudan',          8.0, 23.0, 21.5, 39.0],
  ['Taiwan Strait', 21.0, 27.0,116.0,123.0],
  ['Korean Peninsula',33.0,43.0,124.0,131.5],
  ['Baltic',        53.0, 60.0, 14.0, 30.0],
  ['Strait of Hormuz',24.0,27.5,54.0, 58.0],
]

const MIL_PREFIXES = [
  'FORTE','JAKE','HOMER','RONIN','DUKE','VIPER','REAPER','NCHO','LAGR',
  'HAWK','IRON','TITAN','ARROW','COBRA','BONE','REACH','RCH','TABOR',
  'TOPCAT','ETHYL','ANGRY','GOTHAM','BISON','TROJAN','SENTRY','AWACS',
  'MAGIC','NATO','GHOST','SHADOW','COBRA','EAGLE','BEAR','WOLF',
]

const MIL_ICAO_RANGES: [string, string][] = [
  ['AE0000','AE6FFF'],['43C000','43CFFF'],['3F0000','3FFFFF'],
  ['3E8000','3EBFFF'],['300000','33FFFF'],['010000','01FFFF'],
  ['780000','7BFFFF'],
]

// Feature 14: Force Tracker — military aircraft identification database
const AIRCRAFT_DATABASE: Record<string, { type: string; role: string; significance: string }> = {
  'FORTE':  { type: 'RQ-4B Global Hawk', role: 'High-Altitude Reconnaissance', significance: 'Long-endurance ISR UAV. Presence signals active surveillance mission over conflict zone.' },
  'HOMER':  { type: 'RQ-4B Global Hawk', role: 'High-Altitude Reconnaissance', significance: 'Long-endurance ISR. Surveys 100,000 sq km in 24h.' },
  'JAKE':   { type: 'RC-135 Rivet Joint', role: 'Signals Intelligence', significance: 'SIGINT aircraft intercepting electronic emissions. Indicates active comms surveillance.' },
  'TOPCAT': { type: 'P-8A Poseidon', role: 'Maritime Patrol / ASW', significance: 'Maritime surveillance and anti-submarine. Monitors ships and submarines.' },
  'BONE':   { type: 'B-1B Lancer', role: 'Strategic Bomber', significance: 'Supersonic heavy bomber. Deployment signals potential strike positioning.' },
  'REACH':  { type: 'C-17 Globemaster III', role: 'Strategic Airlift', significance: 'Heavy transport. Multiple flights indicate major equipment/troop movement.' },
  'RCH':    { type: 'C-17 Globemaster III', role: 'Strategic Airlift', significance: 'Heavy transport aircraft. Sustained flights = large-scale logistical operation.' },
  'LAGR':   { type: 'KC-135 Stratotanker', role: 'Aerial Refueling', significance: 'Tanker sustaining other aircraft for extended operations.' },
  'ETHYL':  { type: 'KC-135 Stratotanker', role: 'Aerial Refueling', significance: 'Presence of multiple tankers = large, sustained air operation nearby.' },
  'SENTRY': { type: 'E-3 Sentry AWACS', role: 'Airborne Early Warning', significance: 'Battle management and radar surveillance. Indicates heightened operational readiness.' },
  'AWACS':  { type: 'E-3 Sentry AWACS', role: 'Airborne Early Warning', significance: 'Provides real-time tactical picture over 250,000 sq km.' },
  'MAGIC':  { type: 'E-3 Sentry AWACS', role: 'Airborne Early Warning', significance: 'NATO AWACS. Activation indicates multinational air operation.' },
  'REAPER': { type: 'MQ-9 Reaper', role: 'Armed Reconnaissance UAV', significance: 'Armed drone with 27h endurance. Indicates precision surveillance or strike readiness.' },
  'GHOST':  { type: 'U-2 Dragon Lady', role: 'Strategic Reconnaissance', significance: 'High-altitude recon at 70,000ft. Extremely rare flight = high-priority ISR mission.' },
  'SHADOW': { type: 'RC-135W Rivet Joint', role: 'Signals Intelligence', significance: 'Electronic intelligence. Monitors radar and communication emissions.' },
  'IRON':   { type: 'E-8C JSTARS', role: 'Ground Surveillance', significance: 'Tracks ground vehicles and troop movements using SAR radar.' },
}

function enrichAircraftType(callsign: string): { type: string; role: string; significance: string } | null {
  const cs = callsign.toUpperCase()
  for (const [prefix, data] of Object.entries(AIRCRAFT_DATABASE)) {
    if (cs.startsWith(prefix)) return data
  }
  return null
}

function isMilitary(callsign: string | null, icao24: string): boolean {
  const cs = (callsign ?? '').trim().toUpperCase()
  if (MIL_PREFIXES.some(p => cs.startsWith(p))) return true
  const hex = parseInt(icao24, 16)
  if (isNaN(hex)) return false
  return MIL_ICAO_RANGES.some(([lo, hi]) => hex >= parseInt(lo, 16) && hex <= parseInt(hi, 16))
}

function getMilType(callsign: string): string {
  const cs = callsign.toUpperCase()
  if (cs.startsWith('FORTE') || cs.startsWith('HOMER') || cs.startsWith('JAKE')) return 'reconnaissance'
  if (cs.startsWith('REAPER')) return 'drone'
  if (cs.startsWith('BONE')) return 'bomber'
  if (cs.startsWith('REACH') || cs.startsWith('RCH')) return 'transport'
  if (cs.startsWith('AWACS') || cs.startsWith('MAGIC') || cs.startsWith('SENTRY')) return 'awacs'
  if (cs.startsWith('LAGR') || cs.startsWith('ETHYL')) return 'tanker'
  return 'military'
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  let totalTracked = 0
  let militaryCount = 0

  if (!process.env.OPENSKY_USERNAME) {
    return NextResponse.json({ tracked: 0, military: 0, disabled: true, reason: 'No OPENSKY credentials' })
  }

  for (const [name, lamin, lamax, lomin, lomax] of CONFLICT_ZONES) {
    try {
      const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`
      const credentials = Buffer.from(`${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`).toString('base64')
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      })
      if (!res.ok) continue
      const data = await res.json() as { states?: unknown[] }

      for (const state of data.states ?? []) {
        const s = state as unknown[]
        const [icao24, callsign, origin, , , lng, lat, alt, , vel, hdg, vr, , , squawk] = s as [string,string,string,unknown,unknown,number,number,number,unknown,number,number,number,unknown,unknown,string]
        if (!lat || !lng) continue
        const mil = isMilitary(callsign, icao24)
        if (mil) militaryCount++
        const cs = (callsign ?? '').trim()
        const aircraftEnrich = mil ? enrichAircraftType(cs) : null

        await supabase.from('flight_tracks').upsert({
          icao24, callsign: cs, origin_country: origin,
          longitude: lng, latitude: lat, altitude: alt, velocity: vel, heading: hdg, vertical_rate: vr,
          on_ground: false, is_military: mil,
          military_type: mil ? (aircraftEnrich?.role ?? getMilType(cs)) : null,
          aircraft_type: aircraftEnrich?.type ?? null,
          aircraft_significance: aircraftEnrich?.significance ?? null,
          zone_name: name, squawk: squawk ?? null, last_seen: new Date().toISOString(),
        }, { onConflict: 'icao24' })
        totalTracked++
      }
      await new Promise(r => setTimeout(r, 300))
    } catch { /* zone timeout, continue */ }
  }

  // Clean stale (>10 min)
  await supabase.from('flight_tracks').delete().lt('last_seen', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  // Auto-event for 3+ military aircraft in one zone
  if (militaryCount > 0) {
    const { data: milFlights } = await supabase.from('flight_tracks').select('callsign,zone_name,military_type,origin_country').eq('is_military', true)
    type FlightRow = { callsign: string | null; zone_name: string | null; military_type: string | null; origin_country: string | null }
    const zoneMap = new Map<string, FlightRow[]>()
    for (const f of milFlights ?? []) {
      const z = f.zone_name ?? 'Unknown'
      if (!zoneMap.has(z)) zoneMap.set(z, [])
      zoneMap.get(z)!.push(f)
    }
    for (const [zone, flights] of zoneMap) {
      if (flights.length >= 3) {
        const types = [...new Set(flights.map(f => f.military_type).filter(Boolean))]
        const countries = [...new Set(flights.map(f => f.origin_country))]
        await supabase.from('events').upsert({
          title: `${flights.length} military aircraft detected over ${zone}`,
          description: `Aircraft types: ${types.join(', ')}. Countries: ${countries.join(', ')}. Callsigns include: ${flights.slice(0, 5).map(f => f.callsign).join(', ')}.`,
          source_id: `conflictradar://flights/${zone}/${Date.now()}`,
          source: 'ConflictRadar Flight Intel',
          severity: flights.length >= 5 ? 3 : 2,
          event_type: 'military',
          region: zone, enriched: true, enriched_at: new Date().toISOString(),
        }, { onConflict: 'source_id', ignoreDuplicates: true })
      }
    }
  }

  await supabase.from('tracking_stats').upsert({ stat_type: 'flights', count: totalTracked, details: { military: militaryCount }, updated_at: new Date().toISOString() }, { onConflict: 'stat_type' })
  return NextResponse.json({ tracked: totalTracked, military: militaryCount })
}
