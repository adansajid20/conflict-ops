/**
 * GDACS Ingest — Global Disaster Alert and Coordination System
 * Source: gdacs.org — FREE, no key required, UN-backed
 * Attribution: "Alert data from GDACS (gdacs.org)"
 *
 * Covers: conflicts, complex emergencies, floods, earthquakes
 * that have humanitarian impact — global coverage
 * Updated: every 15 minutes
 */

import { createServiceClient } from '@/lib/supabase/server'

const GDACS_RSS = 'https://www.gdacs.org/xml/rss_conflict.xml'
const GDACS_API = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS?eventtype=CE&alertlevel=Green,Orange,Red&limit=50'

type GDACSEvent = {
  eventid: number
  eventtype: string
  eventname: string
  alertlevel: 'Green' | 'Orange' | 'Red'
  alertscore: number
  country: string
  countrycode: string
  fromdate: string
  todate: string
  description: string
  url: { report: string }
  bbox: number[]
  lat: number
  lon: number
}

function alertLevelToSeverity(level: string, score: number): number {
  if (level === 'Red' || score >= 1.5) return 5
  if (level === 'Orange' || score >= 1.0) return 4
  if (score >= 0.5) return 3
  return 2
}

function countryToRegion(country: string): string {
  const MAPPING: Record<string, string> = {
    Ukraine: 'Eastern Europe', Russia: 'Eastern Europe',
    Syria: 'Middle East', Iraq: 'Middle East', Yemen: 'Middle East',
    Sudan: 'East Africa', Ethiopia: 'East Africa', Somalia: 'East Africa',
    'South Sudan': 'East Africa', 'DR Congo': 'Central Africa',
    Mali: 'West Africa', Niger: 'West Africa', Nigeria: 'West Africa',
    Libya: 'North Africa', Afghanistan: 'South Asia', Myanmar: 'Southeast Asia',
    Palestine: 'Middle East', Israel: 'Middle East', Lebanon: 'Middle East',
  }
  for (const [key, region] of Object.entries(MAPPING)) {
    if (country.includes(key)) return region
  }
  return 'Global'
}

export async function ingestGDACS(): Promise<{ stored: number; skipped: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0

  try {
    const res = await fetch(GDACS_API, {
      headers: { 'User-Agent': 'ConflictOps/1.0 (conflictradar.co)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return { stored, skipped }

    const data = await res.json() as { features?: Array<{ properties: GDACSEvent }> }

    for (const feature of (data.features ?? [])) {
      const e = feature.properties
      if (e.eventtype !== 'CE') continue // CE = Complex Emergency

      const { error } = await supabase.from('events').upsert({
        source: 'gdacs',
        source_id: `gdacs-${e.eventid}`,
        event_type: 'conflict',
        title: e.eventname || `${e.alertlevel} Complex Emergency — ${e.country}`,
        description: e.description?.slice(0, 1000) ?? '',
        region: countryToRegion(e.country),
        country_code: e.countrycode?.slice(0, 2).toUpperCase() ?? null,
        severity: alertLevelToSeverity(e.alertlevel, e.alertscore),
        status: 'pending',
        occurred_at: e.fromdate,
        location: e.lat && e.lon ? `POINT(${e.lon} ${e.lat})` : null,
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'GDACS',
          attribution: 'Alert data from GDACS (gdacs.org)',
          alert_level: e.alertlevel,
          alert_score: e.alertscore,
          url: e.url?.report,
        },
        raw: e as unknown as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (!error) stored++; else skipped++
    }
  } catch {
    // non-critical
  }

  return { stored, skipped }
}
