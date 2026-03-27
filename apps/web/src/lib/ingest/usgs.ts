/**
 * USGS Earthquake Ingest
 * Source: https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
 * Returns M4.5+ earthquakes from the past 24h + significant earthquakes from past week.
 * No API key required. GeoJSON format.
 */
import { createServiceClient } from '@/lib/supabase/server'

interface USGSFeature {
  type: 'Feature'
  properties: {
    mag: number
    place: string
    time: number  // Unix ms
    updated: number
    url: string
    detail: string
    felt: number | null
    alert: string | null  // 'green' | 'yellow' | 'orange' | 'red'
    status: string
    tsunami: number  // 0 or 1
    sig: number  // significance score 0-1000
    title: string
    type: string  // 'earthquake' | 'quarry blast' etc
  }
  geometry: {
    type: 'Point'
    coordinates: [number, number, number]  // [lng, lat, depth_km]
  }
  id: string
}

interface USGSResponse {
  type: 'FeatureCollection'
  features: USGSFeature[]
}

// Map USGS alert level to our severity
function alertToSeverity(alert: string | null, mag: number, tsunami: number): 1 | 2 | 3 | 4 {
  if (tsunami === 1 || alert === 'red') return 4
  if (alert === 'orange') return 3
  if (alert === 'yellow' || mag >= 6.5) return 3
  if (mag >= 5.5) return 2
  return 1
}

// Helper: extract geo from USGS place string
function detectGeo(place: string): { code: string | null; region: string | null } {
  const COUNTRY_MAP: Record<string, { code: string; region: string }> = {
    'Japan': { code: 'JP', region: 'East Asia' },
    'Indonesia': { code: 'ID', region: 'Southeast Asia' },
    'Philippines': { code: 'PH', region: 'Southeast Asia' },
    'Papua New Guinea': { code: 'PG', region: 'Asia Pacific' },
    'Chile': { code: 'CL', region: 'Latin America' },
    'Peru': { code: 'PE', region: 'Latin America' },
    'Nepal': { code: 'NP', region: 'South Asia' },
    'Afghanistan': { code: 'AF', region: 'South Asia' },
    'Pakistan': { code: 'PK', region: 'South Asia' },
    'India': { code: 'IN', region: 'South Asia' },
    'Iran': { code: 'IR', region: 'Middle East' },
    'Turkey': { code: 'TR', region: 'Middle East' },
    'Türkiye': { code: 'TR', region: 'Middle East' },
    'Greece': { code: 'GR', region: 'Europe' },
    'Italy': { code: 'IT', region: 'Europe' },
    'Mexico': { code: 'MX', region: 'Latin America' },
    'Alaska': { code: 'US', region: 'North America' },
    'California': { code: 'US', region: 'North America' },
    'New Zealand': { code: 'NZ', region: 'Asia Pacific' },
    'Tonga': { code: 'TO', region: 'Asia Pacific' },
    'Vanuatu': { code: 'VU', region: 'Asia Pacific' },
    'Solomon Islands': { code: 'SB', region: 'Asia Pacific' },
    'Taiwan': { code: 'TW', region: 'East Asia' },
    'China': { code: 'CN', region: 'East Asia' },
    'Colombia': { code: 'CO', region: 'Latin America' },
    'Ecuador': { code: 'EC', region: 'Latin America' },
    'Bolivia': { code: 'BO', region: 'Latin America' },
    'Argentina': { code: 'AR', region: 'Latin America' },
    'Russia': { code: 'RU', region: 'Eastern Europe' },
    'Kazakhstan': { code: 'KZ', region: 'Central Asia' },
    'Kyrgyzstan': { code: 'KG', region: 'Central Asia' },
    'Tajikistan': { code: 'TJ', region: 'Central Asia' },
    'Myanmar': { code: 'MM', region: 'Southeast Asia' },
    'Bangladesh': { code: 'BD', region: 'South Asia' },
    'Haiti': { code: 'HT', region: 'Latin America' },
    'Morocco': { code: 'MA', region: 'Africa' },
    'Ethiopia': { code: 'ET', region: 'Africa' },
  }
  for (const [name, data] of Object.entries(COUNTRY_MAP)) {
    if (place.includes(name)) return { code: data.code, region: data.region }
  }
  return { code: null, region: null }
}

export async function ingestUSGS(): Promise<{ stored: number; skipped: number; errors: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0, errors = 0

  const FEEDS = [
    // M4.5+ in past day — good breadth
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson',
    // Significant in past week — catches major ones we might have missed
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson',
  ]

  for (const feedUrl of FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'ConflictOps/1.0 (conflictradar.co)' },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) { errors++; continue }

      const data: USGSResponse = await res.json()

      for (const feature of data.features) {
        const p = feature.properties
        // Only earthquakes (skip quarry blasts, etc.)
        if (p.type !== 'earthquake') continue
        // Skip if below M4.0 (not geopolitically relevant usually)
        if (p.mag < 4.0) continue

        const source_id = `usgs:${feature.id}`
        const geo = detectGeo(p.place)

        const title = p.title || `M${p.mag.toFixed(1)} earthquake - ${p.place}`
        const description = [
          `Magnitude ${p.mag.toFixed(1)} earthquake detected ${p.place}.`,
          p.tsunami === 1 ? 'Tsunami alert issued.' : '',
          p.felt ? `Felt by approximately ${p.felt} people.` : '',
          `Significance score: ${p.sig}/1000.`,
        ].filter(Boolean).join(' ')

        const { error } = await supabase.from('events').upsert({
          source: 'usgs',
          source_id,
          event_type: 'natural_disaster',
          title,
          description,
          region: geo.region,
          country_code: geo.code,
          severity: alertToSeverity(p.alert, p.mag, p.tsunami),
          status: 'confirmed',  // USGS data is seismically confirmed
          occurred_at: new Date(p.time).toISOString(),
          heavy_lane_processed: false,
          provenance_raw: {
            source: 'USGS Earthquake Hazards Program',
            attribution: 'USGS (United States Geological Survey)',
            url: p.url,
            magnitude: p.mag,
            depth_km: feature.geometry.coordinates[2],
            tsunami: p.tsunami === 1,
            alert_level: p.alert,
            significance: p.sig,
          } as Record<string, unknown>,
          raw: feature as unknown as Record<string, unknown>,
        }, { onConflict: 'source,source_id', ignoreDuplicates: true })

        if (error) skipped++
        else stored++
      }
    } catch {
      errors++
    }
  }

  return { stored, skipped, errors }
}
