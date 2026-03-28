/**
 * NOAA National Weather Service — Severe Weather Alerts
 * Free API, no key required. US-focused but includes Pacific territories.
 * Returns GeoJSON FeatureCollection of active weather warnings/watches/advisories.
 */
import { createServiceClient } from '@/lib/supabase/server'

interface NOAAAlert {
  type: 'Feature'
  properties: {
    id: string
    areaDesc: string
    geocode: { SAME: string[]; UGC: string[] }
    affectedZones: string[]
    sent: string
    effective: string
    onset: string
    expires: string
    ends: string | null
    status: string
    messageType: string
    category: string
    severity: string  // 'Extreme' | 'Severe' | 'Moderate' | 'Minor'
    certainty: string
    urgency: string
    event: string  // e.g. "Tornado Warning", "Hurricane Warning"
    headline: string | null
    description: string
    instruction: string | null
    response: string
    parameters: Record<string, unknown>
  }
  geometry: { type: string; coordinates: unknown } | null
}

// Map NOAA severity to our 1-4 scale
function mapSeverity(severity: string, event: string): 1 | 2 | 3 | 4 {
  const e = event.toLowerCase()
  if (severity === 'Extreme' || e.includes('tornado') || e.includes('hurricane') || e.includes('typhoon') || e.includes('tsunami')) return 4
  if (severity === 'Severe' || e.includes('cyclone') || e.includes('flash flood')) return 3
  if (severity === 'Moderate') return 2
  return 1
}

// Map NOAA event type to our event_type
function mapEventType(_event: string): string {
  return 'natural_disaster'
}

// Only ingest meteorologically significant events (skip routine advisories)
const RELEVANT_EVENTS = [
  'tornado', 'hurricane', 'typhoon', 'cyclone', 'tsunami',
  'flash flood', 'flood warning', 'extreme wind', 'blizzard',
  'ice storm', 'winter storm', 'high wind', 'wildfire', 'red flag',
  'storm warning', 'severe thunderstorm', 'avalanche',
]

function isRelevantEvent(event: string): boolean {
  const e = event.toLowerCase()
  return RELEVANT_EVENTS.some(k => e.includes(k))
}

export async function ingestNOAA(): Promise<{ stored: number; skipped: number; errors: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0, errors = 0

  try {
    const res = await fetch(
      'https://api.weather.gov/alerts?severity=Extreme,Severe&status=actual&limit=500',
      {
        headers: {
          'Accept': 'application/geo+json',
          'User-Agent': 'ConflictOps/1.0 (conflictradar.co; contact@conflictradar.co)',
        },
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) return { stored: 0, skipped: 0, errors: 1 }

    const data: { features: NOAAAlert[] } = await res.json()

    for (const feature of data.features) {
      const p = feature.properties
      if (!isRelevantEvent(p.event)) { skipped++; continue }

      const source_id = `noaa:${p.id}`
      const title = p.headline ?? `${p.event} — ${p.areaDesc}`
      const description = [
        p.description?.slice(0, 500),
        p.instruction ? `Instructions: ${p.instruction.slice(0, 200)}` : null,
      ].filter(Boolean).join(' ')

      const { error } = await supabase.from('events').upsert({
        source: 'noaa',
        source_id,
        event_type: mapEventType(p.event),
        title: title.slice(0, 500),
        description: description || title,
        region: 'North America',
        country_code: 'US',
        severity: mapSeverity(p.severity, p.event),
        status: p.messageType === 'Alert' ? 'confirmed' : 'developing',
        occurred_at: p.onset ?? p.effective ?? p.sent,
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'NOAA National Weather Service',
          attribution: 'NOAA NWS (weather.gov)',
          url: `https://www.weather.gov/`,
          event_type: p.event,
          severity_noaa: p.severity,
          area: p.areaDesc,
          expires: p.expires,
        } as Record<string, unknown>,
        raw: p as unknown as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (error) skipped++
      else stored++
    }
  } catch {
    errors++
  }

  return { stored, skipped, errors }
}
