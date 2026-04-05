export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

const MARITIME_ZONES: [string, number, number, number, number][] = [
  ['Red Sea',           12.0, 30.0, 32.0, 44.0],
  ['Strait of Hormuz',  24.0, 27.5, 54.0, 58.0],
  ['Bab el-Mandeb',     12.0, 14.0, 42.5, 44.0],
  ['Suez Canal',        29.5, 31.5, 32.0, 33.0],
  ['Persian Gulf',      24.0, 30.5, 47.0, 56.5],
  ['Gulf of Aden',      11.0, 15.5, 43.0, 51.0],
  ['Eastern Med',       31.0, 36.0, 29.0, 36.0],
  ['Black Sea',         41.0, 47.0, 27.5, 42.0],
  ['South China Sea',    3.0, 22.0,105.0,122.0],
  ['Taiwan Strait',     22.0, 26.0,117.0,121.0],
  ['Baltic Sea',        53.5, 60.0, 12.0, 30.0],
  ['East Africa Coast', -5.0, 12.0, 40.0, 52.0],
]

const SHIP_TYPES: Record<number, string> = {
  35: 'Military', 70: 'Cargo', 80: 'Tanker', 60: 'Passenger',
  30: 'Fishing', 37: 'Pleasure', 40: 'High Speed', 55: 'Law Enforcement',
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  let totalTracked = 0
  let darkShips = 0

  if (!process.env.AISHUB_USERNAME) {
    // Fallback: use public MarineTraffic / AIS data from Cloudflare Worker or similar
    return NextResponse.json({ tracked: 0, dark_detected: 0, disabled: true, reason: 'No AISHUB credentials' })
  }

  try {
    const res = await fetch(
      `http://data.aishub.net/ws.php?username=${process.env.AISHUB_USERNAME}&format=1&output=json&compress=0`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (res.ok) {
      const raw = await res.json() as unknown[]
      const vessels = Array.isArray(raw[1]) ? raw[1] : raw

      for (const v of vessels as Record<string,string>[]) {
        const lat = parseFloat(v.LATITUDE ?? '')
        const lng = parseFloat(v.LONGITUDE ?? '')
        if (!lat || !lng) continue

        let zoneName: string | null = null
        for (const [name, lamin, lamax, lomin, lomax] of MARITIME_ZONES) {
          if (lat >= lamin && lat <= lamax && lng >= lomin && lng <= lomax) { zoneName = name; break }
        }
        if (!zoneName) continue

        const shipType = parseInt(v.TYPE ?? '0') || 0
        await supabase.from('vessel_tracks').upsert({
          mmsi: v.MMSI, imo: v.IMO ?? null, name: (v.NAME ?? '').trim() || null,
          ship_type: shipType, ship_type_label: SHIP_TYPES[shipType] ?? `Type ${shipType}`,
          flag_country: v.FLAG ?? null, longitude: lng, latitude: lat,
          speed: parseFloat(v.SPEED ?? '0') / 10, course: parseFloat(v.COG ?? '0'),
          heading: parseInt(v.HEADING ?? '0') || 0, destination: (v.DEST ?? '').trim() || null,
          is_dark: false, zone_name: zoneName, last_seen: new Date().toISOString(),
        }, { onConflict: 'mmsi' })
        totalTracked++
      }
    }
  } catch (e) { console.warn('AISHub error:', e) }

  // Detect dark ships (not seen in 2h but active in last 12h)
  const { data: goneQuiet } = await supabase
    .from('vessel_tracks')
    .select('mmsi, name, zone_name, last_seen')
    .lt('last_seen', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .gt('last_seen', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .eq('is_dark', false)

  for (const ship of goneQuiet ?? []) {
    await supabase.from('vessel_tracks').update({ is_dark: true, dark_since: ship.last_seen }).eq('mmsi', ship.mmsi)
    darkShips++
    await supabase.from('events').upsert({
      title: `Vessel "${ship.name ?? ship.mmsi}" went AIS-dark in ${ship.zone_name}`,
      description: `${ship.name ?? 'Unknown vessel'} (MMSI: ${ship.mmsi}) stopped transmitting AIS signals in ${ship.zone_name}. AIS silence in conflict maritime zones may indicate sanctions evasion, military operations, or smuggling.`,
      source_id: `conflictradar://vessel-dark/${ship.mmsi}/${Date.now()}`,
      source: 'ConflictRadar Maritime Intel', severity: 3, event_type: 'maritime',
      region: ship.zone_name, enriched: true, enriched_at: new Date().toISOString(),
    }, { onConflict: 'source_id', ignoreDuplicates: true })
  }

  // Clean stale (>24h)
  await supabase.from('vessel_tracks').delete().lt('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const { count: activeCount } = await supabase.from('vessel_tracks').select('*', { count: 'exact', head: true })
  const { count: darkCount } = await supabase.from('vessel_tracks').select('*', { count: 'exact', head: true }).eq('is_dark', true)

  await supabase.from('tracking_stats').upsert({
    stat_type: 'vessels', count: activeCount ?? 0,
    details: { dark: darkCount ?? 0, new_dark: darkShips },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stat_type' })

  return NextResponse.json({ tracked: totalTracked, dark_detected: darkShips })
}
