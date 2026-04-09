export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

function col(cols: string[], i: number): string { return i >= 0 ? (cols[i] ?? '') : '' }

const CONFLICT_ZONES: [string, number, number, number, number][] = [
  ['Ukraine',      44.0, 53.0, 22.0, 40.5],
  ['Gaza-Israel',  29.5, 33.5, 33.0, 36.0],
  ['Syria-Iraq',   29.0, 37.5, 35.0, 50.0],
  ['Yemen',        12.0, 19.0, 41.0, 55.0],
  ['Sudan',         8.0, 23.0, 21.5, 39.0],
  ['Myanmar',      10.0, 28.5, 92.0, 101.5],
  ['Libya',        19.0, 34.0,  9.0, 25.5],
  ['Ethiopia',      3.0, 15.0, 33.0, 48.0],
]

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.NASA_FIRMS_API_KEY
  if (!key) return NextResponse.json({ collected: 0, disabled: true, reason: 'No NASA_FIRMS_API_KEY' })

  const supabase = createServiceClient()
  let collected = 0

  for (const [name, lamin, lamax, lomin, lomax] of CONFLICT_ZONES) {
    try {
      const res = await fetch(
        `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${lomin},${lamin},${lomax},${lamax}/1`,
        { signal: AbortSignal.timeout(15000) }
      )
      if (!res.ok) continue
      const csv = await res.text()
      const lines = csv.trim().split('\n')
      if (lines.length < 2) continue

      const headers = (lines[0] ?? '').split(',')
      const latI    = headers.indexOf('latitude')
      const lngI    = headers.indexOf('longitude')
      const frpI    = headers.indexOf('frp')
      const confI   = headers.indexOf('confidence')
      const dateI   = headers.indexOf('acq_date')
      const timeI   = headers.indexOf('acq_time')
      const dnI     = headers.indexOf('daynight')
      const brightI = headers.indexOf('bright_ti4')

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        if (!line) continue
        const cols = line.split(',')
        const lat = parseFloat(col(cols, latI)) || 0
        const lng = parseFloat(col(cols, lngI)) || 0
        const frp = parseFloat(col(cols, frpI)) || 0
        const confidence = col(cols, confI) || 'nominal'
        const possibleStrike = frp > 50 && confidence === 'high'

        await supabase.from('fire_detections').insert({
          latitude: lat, longitude: lng,
          brightness: parseFloat(col(cols, brightI)) || null,
          frp, confidence, satellite: 'VIIRS', instrument: 'SNPP',
          daynight: col(cols, dnI) || null,
          acq_date: col(cols, dateI) || null,
          acq_time: col(cols, timeI) || null,
          is_conflict_zone: true, zone_name: name, possible_strike: possibleStrike,
        })
        collected++

        if (possibleStrike) {
          await supabase.from('events').upsert({
            title: `High-intensity fire detected in ${name} — possible military strike`,
            description: `NASA VIIRS detected ${frp} MW thermal anomaly at ${lat.toFixed(4)},${lng.toFixed(4)} in ${name}.`,
            source_id: `conflictradar://fire/${lat.toFixed(4)}/${lng.toFixed(4)}/${Date.now()}`,
            source: 'NASA FIRMS/ConflictRadar', severity: frp > 100 ? 4 : 3,
            event_type: 'military', region: name, latitude: lat, longitude: lng,
            enriched: true, enriched_at: new Date().toISOString(),
          }, { onConflict: 'source_id', ignoreDuplicates: true })
        }
      }
      await new Promise(r => setTimeout(r, 500))
    } catch (e) { console.warn(`FIRMS ${name} error:`, e) }
  }

  await supabase.from('tracking_stats').upsert(
    { stat_type: 'fires', count: collected, updated_at: new Date().toISOString() },
    { onConflict: 'stat_type' }
  )
  return NextResponse.json({ collected })
}
