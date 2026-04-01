/**
 * AIS (Automatic Identification System) Vessel Tracking
 * Source: AISStream.io — free WebSocket API, no license required
 * Attribution: "Vessel data via AISStream.io"
 *
 * Tracks vessels of interest:
 * - Military vessels (ship_type 35)
 * - Cargo in conflict zones
 * - Vessels that go dark (AIS transponder off)
 * - Unusual routing through restricted areas
 *
 * ZONES OF INTEREST (configurable):
 * Red Sea, Strait of Hormuz, Black Sea, South China Sea, Taiwan Strait
 */

import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

const AISSTREAM_WS = 'wss://stream.aisstream.io/v0/stream'

// Bounding boxes for conflict-relevant maritime chokepoints
export const MARITIME_ZONES = [
  { name: 'Red Sea',           bbox: [[11.0, 32.0], [30.0, 44.0]] },
  { name: 'Strait of Hormuz',  bbox: [[22.0, 55.0], [27.0, 60.0]] },
  { name: 'Black Sea',         bbox: [[40.5, 27.5], [47.5, 41.5]] },
  { name: 'South China Sea',   bbox: [[0.0, 99.0], [25.0, 125.0]] },
  { name: 'Taiwan Strait',     bbox: [[21.0, 119.0], [27.0, 122.0]] },
  { name: 'Gulf of Aden',      bbox: [[10.0, 43.0], [15.0, 52.0]] },
] as const

export type AISVessel = {
  mmsi: number
  ship_name: string
  ship_type: number
  latitude: number
  longitude: number
  speed: number        // knots
  course: number       // degrees
  heading: number
  nav_status: number   // 0=underway, 1=anchored, 5=moored, 15=not defined
  flag: string | null  // ISO country code
  imo: number | null
  callsign: string | null
  zone_name: string
  timestamp: string
}

export type VesselIngestResult = {
  tracked: number
  alerts: number
  stored: number
}

/**
 * Fetch latest AIS positions for monitored maritime zones
 * Uses REST snapshot endpoint (no persistent WebSocket needed for ingestion)
 */
export async function ingestAISVessels(): Promise<VesselIngestResult> {
  const result: VesselIngestResult = { tracked: 0, alerts: 0, stored: 0 }

  const apiKey = process.env['AISSTREAM_API_KEY']
  if (!apiKey) {
    console.warn('[ais-ingest] AISSTREAM_API_KEY not set — skipping')
    return result
  }

  const supabase = createServiceClient()
  const vessels: AISVessel[] = []

  // Fetch latest positions for each zone via REST API
  for (const zone of MARITIME_ZONES) {
    try {
      const [[minLat, minLon], [maxLat, maxLon]] = zone.bbox
      const res = await fetch('https://api.aisstream.io/v0/positions', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          BoundingBoxes: [[
            [minLat, minLon],
            [maxLat, maxLon],
          ]],
          ShipTypes: [31, 32, 33, 34, 35, 36, 37], // Military + special craft
          FilterShipMMSI: [],
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) continue

      const data = await res.json() as { vessels?: Array<Record<string, unknown>> }
      const zoneVessels = (data.vessels ?? []).map(v => ({
        mmsi: Number(v['mmsi']),
        ship_name: String(v['shipName'] ?? ''),
        ship_type: Number(v['shipType'] ?? 0),
        latitude: Number(v['latitude']),
        longitude: Number(v['longitude']),
        speed: Number(v['speed'] ?? 0),
        course: Number(v['course'] ?? 0),
        heading: Number(v['heading'] ?? 0),
        nav_status: Number(v['navStatus'] ?? 15),
        flag: String(v['flag'] ?? '') || null,
        imo: v['imo'] ? Number(v['imo']) : null,
        callsign: v['callsign'] ? String(v['callsign']) : null,
        zone_name: zone.name,
        timestamp: new Date().toISOString(),
      } satisfies AISVessel))

      vessels.push(...zoneVessels)
    } catch {
      // skip failed zones
    }
  }

  result.tracked = vessels.length

  // Upsert vessel positions
  for (const vessel of vessels) {
    const sourceId = `${vessel.mmsi}`
    const { error } = await supabase.from('maritime_tracks').upsert(
      {
        mmsi: vessel.mmsi,
        source_id: sourceId,
        ship_name: vessel.ship_name,
        ship_type: vessel.ship_type,
        latitude: vessel.latitude,
        longitude: vessel.longitude,
        speed: vessel.speed,
        course: vessel.course,
        heading: vessel.heading,
        nav_status: vessel.nav_status,
        flag: vessel.flag,
        imo: vessel.imo,
        callsign: vessel.callsign,
        zone_name: vessel.zone_name,
        last_seen: vessel.timestamp,
        location: `POINT(${vessel.longitude} ${vessel.latitude})`,
      },
      { onConflict: 'mmsi' }
    )

    if (!error) result.stored++

    // Flag military vessels in conflict zones
    if (vessel.ship_type === 35) {
      result.alerts++
      await supabase.from('events').upsert(
        {
          source: 'ais',
          source_id: `ais-military-${vessel.mmsi}-${new Date().toISOString().split('T')[0]}`,
          event_type: 'military_vessel',
          title: `Military vessel ${vessel.ship_name || vessel.mmsi} detected: ${vessel.zone_name}`,
          description: `MMSI: ${vessel.mmsi} | Flag: ${vessel.flag ?? 'unknown'} | Speed: ${vessel.speed}kn | Status: ${vessel.nav_status}`,
          severity: 3,
          status: 'pending',
          occurred_at: vessel.timestamp,
          heavy_lane_processed: true, // no LLM needed for AIS
          provenance_raw: {
            source: 'AISStream.io',
            attribution: 'Vessel data via AISStream.io',
            mmsi: vessel.mmsi,
            zone: vessel.zone_name,
          },
          raw: vessel as unknown as Record<string, unknown>,
        },
        { onConflict: 'source,source_id', ignoreDuplicates: true }
      )
    }
  }

  return result
}

/**
 * Detect vessels that have gone dark (AIS off) after being in a conflict zone
 * Compares current positions against positions from 6 hours ago
 */
export async function detectDarkVessels(): Promise<number> {
  const supabase = createServiceClient()
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  const { data: recentVessels } = await supabase
    .from('maritime_tracks')
    .select('mmsi, ship_name, zone_name, last_seen')
    .lt('last_seen', sixHoursAgo)
    .not('zone_name', 'is', null)

  if (!recentVessels?.length) return 0

  let darkCount = 0
  for (const vessel of recentVessels) {
    await supabase.from('events').upsert(
      {
        source: 'ais',
        source_id: `ais-dark-${vessel.mmsi}-${new Date().toISOString().split('T')[0]}`,
        event_type: 'vessel_dark',
        title: `Vessel gone dark: ${vessel.ship_name || vessel.mmsi} (${vessel.zone_name})`,
        description: `Vessel MMSI ${vessel.mmsi} in ${vessel.zone_name} has not transmitted AIS for >6 hours. Last seen: ${vessel.last_seen}`,
        severity: 2,
        status: 'pending',
        occurred_at: new Date().toISOString(),
        heavy_lane_processed: true,
        provenance_raw: {
          source: 'AISStream.io',
          attribution: 'Vessel data via AISStream.io',
          mmsi: vessel.mmsi,
          zone: vessel.zone_name,
          last_seen: vessel.last_seen,
        },
        raw: vessel as unknown as Record<string, unknown>,
      },
      { onConflict: 'source,source_id', ignoreDuplicates: true }
    )
    darkCount++
  }

  return darkCount
}
