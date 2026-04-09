export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

// Conflict zone bounding boxes [minLon, minLat, maxLon, maxLat]
const CONFLICT_ZONES: Record<string, [number, number, number, number]> = {
  middle_east:    [25, 12, 65, 42],
  eastern_europe: [22, 44, 45, 58],
  south_asia:     [60, 20, 100, 38],
  east_asia:      [100, 15, 145, 45],
  sub_saharan_africa: [-20, -35, 55, 25],
  north_africa:   [-20, 15, 60, 38],
}

function getConflictZone(lat: number, lon: number): string | null {
  for (const [zone, [minLon, minLat, maxLon, maxLat]] of Object.entries(CONFLICT_ZONES)) {
    if (lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) return zone
  }
  return null
}

function classifyAircraftType(callsign: string | null, icao: string | null): string {
  if (!callsign) return 'unknown'
  const cs = callsign.toUpperCase()
  // Military ICAO hex ranges (approximate)
  const militaryPrefixes = ['RFF','CTM','SAM','RCH','TOPGUN','DUKE','VIPER','KNIFE','GHOST','HAWK','EAGLE']
  if (militaryPrefixes.some(p => cs.startsWith(p))) return 'military'
  if (cs.match(/^(ISR|RC|E-|EP-|U-|SR)/)) return 'surveillance'
  if (cs.match(/^(KC|TANKER)/)) return 'tanker'
  return 'civilian'
}

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  let stored = 0, errors = 0

  // Query OpenSky for all zones
  for (const [zone, [minLon, minLat, maxLon, maxLat]] of Object.entries(CONFLICT_ZONES)) {
    try {
      const url = `https://opensky-network.org/api/states/all?lamin=${minLat}&lomin=${minLon}&lamax=${maxLat}&lomax=${maxLon}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ConflictRadar/1.0 (conflictradar.co)' },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) { errors++; continue }

      const data = await res.json()
      const states: unknown[][] = data.states ?? []

      const batch = states.slice(0, 100).map((s) => ({
        icao24:        String(s[0] ?? ''),
        callsign:      s[1] ? String(s[1]).trim() : null,
        origin_country: s[2] ? String(s[2]) : null,
        longitude:     typeof s[5] === 'number' ? s[5] : null,
        latitude:      typeof s[6] === 'number' ? s[6] : null,
        altitude_m:    typeof s[7] === 'number' ? s[7] : null,
        velocity_ms:   typeof s[9] === 'number' ? s[9] : null,
        heading:       typeof s[10] === 'number' ? s[10] : null,
        squawk:        s[14] ? String(s[14]) : null,
        conflict_zone: zone,
        aircraft_type: classifyAircraftType(s[1] ? String(s[1]) : null, s[0] ? String(s[0]) : null),
        recorded_at:   new Date().toISOString(),
      })).filter(f => f.latitude !== null && f.longitude !== null)

      if (batch.length) {
        const { error } = await supabase.from('flight_tracks').insert(batch)
        if (error) errors++
        else stored += batch.length
      }
    } catch (e) {
      console.error(`[flights] zone ${zone}:`, e)
      errors++
    }
  }

  // Prune old flight data (keep last 48h only)
  await supabase.from('flight_tracks')
    .delete()
    .lt('recorded_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

  return NextResponse.json({ success: true, stored, errors, timestamp: new Date().toISOString() })
}
