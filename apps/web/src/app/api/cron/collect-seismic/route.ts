export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

const CONFLICT_ZONES: [string, number, number, number, number][] = [
  ['Ukraine',       44.0, 53.0, 22.0, 40.5],
  ['Syria-Iraq',    29.0, 37.5, 35.0, 50.0],
  ['Iran',          25.0, 40.0, 44.0, 63.5],
  ['North Korea',   37.0, 43.0,124.0,131.5],
  ['Pakistan',      24.0, 37.0, 60.0, 78.0],
  ['Afghanistan',   29.0, 39.0, 60.0, 75.0],
  ['Yemen',         12.0, 19.0, 41.0, 55.0],
  ['Libya',         19.0, 34.0,  9.0, 25.5],
  ['Sudan',          8.0, 23.0, 21.5, 39.0],
  ['Gaza-Israel',   29.5, 33.5, 33.0, 36.0],
]

type USGSFeature = {
  id: string
  geometry: { coordinates: [number, number, number] }
  properties: { mag: number; place: string; time: number }
}

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  let collected = 0

  try {
    const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson', { signal: AbortSignal.timeout(10000) })
    const data = await res.json() as { features: USGSFeature[] }

    for (const feature of data.features ?? []) {
      const [lng, lat, depth] = feature.geometry.coordinates
      const { mag, place, time } = feature.properties

      let zoneName: string | null = null
      for (const [name, lamin, lamax, lomin, lomax] of CONFLICT_ZONES) {
        if (lat >= lamin && lat <= lamax && lng >= lomin && lng <= lomax) { zoneName = name; break }
      }

      const isConflict = !!zoneName
      const possibleExplosion = isConflict && depth < 10 && mag >= 2.5 && mag <= 6.0

      const { error } = await supabase.from('seismic_events').upsert({
        usgs_id: feature.id, magnitude: mag, depth, longitude: lng, latitude: lat,
        place, event_time: new Date(time).toISOString(),
        is_conflict_zone: isConflict, possible_explosion: possibleExplosion, zone_name: zoneName,
      }, { onConflict: 'usgs_id' })
      if (!error) collected++

      if (possibleExplosion) {
        await supabase.from('events').upsert({
          title: `Possible underground explosion: M${mag} at ${depth}km depth in ${zoneName}`,
          description: `USGS recorded a magnitude ${mag} seismic event at only ${depth}km depth near ${place}. Shallow seismic events in conflict zones may indicate underground weapons tests, tunnel explosions, or large munitions detonations.`,
          source_id: `https://earthquake.usgs.gov/earthquakes/eventpage/${feature.id}`,
          source: 'USGS/ConflictRadar',
          severity: mag >= 4.5 ? 4 : 3,
          event_type: 'military', region: zoneName,
          latitude: lat, longitude: lng,
          enriched: true, enriched_at: new Date().toISOString(),
        }, { onConflict: 'source_id', ignoreDuplicates: true })
      }
    }
  } catch (e) { console.warn('Seismic error:', e) }

  const { count } = await supabase.from('seismic_events').select('*', { count: 'exact', head: true }).gt('event_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  await supabase.from('tracking_stats').upsert({ stat_type: 'seismic', count: count ?? 0, updated_at: new Date().toISOString() }, { onConflict: 'stat_type' })

  return NextResponse.json({ collected })
}
