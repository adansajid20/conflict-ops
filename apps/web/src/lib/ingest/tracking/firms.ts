/**
 * NASA FIRMS (Fire Information for Resource Management System)
 * Source: firms.modaps.eosdis.nasa.gov — free, API key required (register free)
 * Attribution: "Active fire data courtesy of NASA FIRMS"
 *
 * Thermal anomalies in conflict zones correlate with:
 * - Artillery bombardment (>40 FRP = likely military activity vs wildfire)
 * - Infrastructure destruction
 * - Ethnic cleansing burn patterns
 * - Fuel depot explosions
 *
 * SATELLITE SOURCES:
 * - VIIRS (S-NPP, NOAA-20) — 375m resolution, best for conflict
 * - MODIS (Terra, Aqua) — 1km resolution, longer history
 */

import { createServiceClient } from '@/lib/supabase/server'

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'

// Only ingest thermal anomalies in or near conflict zones
const CONFLICT_BBOXES = [
  { country: 'UA', name: 'Ukraine', bbox: '21,44,40,53' },
  { country: 'SY', name: 'Syria', bbox: '35,32,42,38' },
  { country: 'YE', name: 'Yemen', bbox: '41,12,54,20' },
  { country: 'SD', name: 'Sudan', bbox: '22,8,38,23' },
  { country: 'SS', name: 'South Sudan', bbox: '24,3,36,13' },
  { country: 'ET', name: 'Ethiopia', bbox: '33,3,48,15' },
  { country: 'LY', name: 'Libya', bbox: '9,19,26,34' },
  { country: 'IQ', name: 'Iraq', bbox: '38,29,49,38' },
  { country: 'AF', name: 'Afghanistan', bbox: '60,29,75,39' },
  { country: 'MM', name: 'Myanmar', bbox: '92,10,101,29' },
]

export type FIRMSPoint = {
  latitude: number
  longitude: number
  brightness: number  // Kelvin — >330K = high confidence fire
  frp: number         // Fire Radiative Power (MW) — >50 = significant
  confidence: string  // h/n/l (high/nominal/low)
  acq_date: string
  acq_time: string
  satellite: string
  country_code: string
  zone_name: string
}

export type FIRMSResult = {
  fetched: number
  high_intensity: number
  stored: number
}

/**
 * Fetch VIIRS 375m active fire data for conflict regions
 * Only flags FRP > 50 MW (likely military/industrial vs wildfire)
 */
export async function ingestFIRMS(dayRange = 1): Promise<FIRMSResult> {
  const result: FIRMSResult = { fetched: 0, high_intensity: 0, stored: 0 }

  const apiKey = process.env['NASA_FIRMS_API_KEY']
  if (!apiKey) {
    console.warn('[firms-ingest] NASA_FIRMS_API_KEY not set — skipping')
    return result
  }

  const supabase = createServiceClient()
  const allPoints: FIRMSPoint[] = []

  for (const zone of CONFLICT_BBOXES) {
    try {
      // VIIRS S-NPP 375m — best resolution for conflict detection
      const url = `${FIRMS_BASE}/${apiKey}/VIIRS_SNPP_NRT/${zone.bbox}/${dayRange}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'ConflictOps/1.0' },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) continue

      const csv = await res.text()
      const lines = csv.trim().split('\n')
      if (lines.length < 2) continue

      const headers = lines[0]?.split(',') ?? []
      const latIdx = headers.indexOf('latitude')
      const lngIdx = headers.indexOf('longitude')
      const brightIdx = headers.indexOf('bright_ti4')
      const frpIdx = headers.indexOf('frp')
      const confIdx = headers.indexOf('confidence')
      const dateIdx = headers.indexOf('acq_date')
      const timeIdx = headers.indexOf('acq_time')
      const satIdx = headers.indexOf('satellite')

      for (const line of lines.slice(1)) {
        const cols = line.split(',')
        const frp = parseFloat(cols[frpIdx] ?? '0')
        const confidence = cols[confIdx] ?? 'l'

        // Filter: only high-intensity or high-confidence signals
        if (frp < 20 && confidence !== 'h') continue

        allPoints.push({
          latitude: parseFloat(cols[latIdx] ?? '0'),
          longitude: parseFloat(cols[lngIdx] ?? '0'),
          brightness: parseFloat(cols[brightIdx] ?? '0'),
          frp,
          confidence,
          acq_date: cols[dateIdx] ?? '',
          acq_time: cols[timeIdx] ?? '',
          satellite: cols[satIdx] ?? 'VIIRS',
          country_code: zone.country,
          zone_name: zone.name,
        })
      }
    } catch {
      // skip failed zones
    }
  }

  result.fetched = allPoints.length

  // Group nearby points (within ~5km) to avoid noise
  const clustered = clusterFirePoints(allPoints)

  for (const cluster of clustered) {
    const isHighIntensity = cluster.max_frp > 50
    if (isHighIntensity) result.high_intensity++

    const severity = frpToSeverity(cluster.max_frp)
    const sourceId = `firms-${cluster.country_code}-${cluster.center_lat.toFixed(2)}-${cluster.center_lng.toFixed(2)}-${cluster.acq_date}`

    const { error } = await supabase.from('events').upsert(
      {
        source: 'firms',
        source_id: sourceId,
        event_type: isHighIntensity ? 'thermal_anomaly_high' : 'thermal_anomaly',
        title: `Thermal anomaly: ${cluster.zone_name} (FRP: ${Math.round(cluster.max_frp)} MW)`,
        description: `${cluster.point_count} fire pixel${cluster.point_count > 1 ? 's' : ''} detected. Max FRP: ${Math.round(cluster.max_frp)} MW. Satellites: ${cluster.satellites.join(', ')}. ${isHighIntensity ? 'HIGH INTENSITY — possible military/industrial activity.' : ''}`,
        severity,
        status: 'pending',
        occurred_at: `${cluster.acq_date}T${cluster.acq_time?.padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2')}:00Z`,
        location: `POINT(${cluster.center_lng} ${cluster.center_lat})`,
        country_code: cluster.country_code,
        heavy_lane_processed: true,
        provenance_raw: {
          source: 'NASA FIRMS',
          attribution: 'Active fire data courtesy of NASA FIRMS (firms.modaps.eosdis.nasa.gov)',
          satellite: cluster.satellites[0],
          frp_max: cluster.max_frp,
          point_count: cluster.point_count,
        },
        raw: cluster as unknown as Record<string, unknown>,
      },
      { onConflict: 'source,source_id', ignoreDuplicates: true }
    )

    if (!error) result.stored++
  }

  return result
}

type FireCluster = {
  center_lat: number
  center_lng: number
  max_frp: number
  point_count: number
  satellites: string[]
  country_code: string
  zone_name: string
  acq_date: string
  acq_time: string | null
}

function clusterFirePoints(points: FIRMSPoint[]): FireCluster[] {
  const clusters: FireCluster[] = []
  const used = new Set<number>()

  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue
    const p = points[i]!
    const cluster: FIRMSPoint[] = [p]
    used.add(i)

    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue
      const q = points[j]!
      const dist = Math.sqrt(
        Math.pow(p.latitude - q.latitude, 2) +
        Math.pow(p.longitude - q.longitude, 2)
      )
      if (dist < 0.05) { // ~5km
        cluster.push(q)
        used.add(j)
      }
    }

    const maxFrp = Math.max(...cluster.map(c => c.frp))
    const satellites = [...new Set(cluster.map(c => c.satellite))]

    clusters.push({
      center_lat: cluster.reduce((s, c) => s + c.latitude, 0) / cluster.length,
      center_lng: cluster.reduce((s, c) => s + c.longitude, 0) / cluster.length,
      max_frp: maxFrp,
      point_count: cluster.length,
      satellites,
      country_code: p.country_code,
      zone_name: p.zone_name,
      acq_date: p.acq_date,
      acq_time: p.acq_time,
    })
  }

  return clusters
}

function frpToSeverity(frp: number): 1 | 2 | 3 | 4 | 5 {
  if (frp >= 500) return 5
  if (frp >= 200) return 4
  if (frp >= 50) return 3
  if (frp >= 20) return 2
  return 1
}
