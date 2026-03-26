/**
 * UNHCR Population Data Ingest
 * Source: data.unhcr.org — FREE, no key required
 * Attribution: "Displacement data from UNHCR (unhcr.org)"
 *
 * Covers: refugee flows, IDP movements, displacement crises
 * Signals: sudden spikes in displacement = conflict escalation indicator
 * Updated: daily
 */

import { createServiceClient } from '@/lib/supabase/server'

const UNHCR_API = 'https://api.unhcr.org/v1/population/get/timeseries'

const WATCH_COUNTRIES = [
  { code: 'UKR', name: 'Ukraine', region: 'Eastern Europe' },
  { code: 'SYR', name: 'Syria', region: 'Middle East' },
  { code: 'AFG', name: 'Afghanistan', region: 'South Asia' },
  { code: 'SDN', name: 'Sudan', region: 'East Africa' },
  { code: 'SSD', name: 'South Sudan', region: 'East Africa' },
  { code: 'MMR', name: 'Myanmar', region: 'Southeast Asia' },
  { code: 'ETH', name: 'Ethiopia', region: 'East Africa' },
  { code: 'COD', name: 'DR Congo', region: 'Central Africa' },
  { code: 'SOM', name: 'Somalia', region: 'East Africa' },
  { code: 'YEM', name: 'Yemen', region: 'Middle East' },
  { code: 'PSE', name: 'Palestine', region: 'Middle East' },
]

const ISO3_TO_ISO2: Record<string, string> = {
  UKR: 'UA', SYR: 'SY', AFG: 'AF', SDN: 'SD', SSD: 'SS',
  MMR: 'MM', ETH: 'ET', COD: 'CD', SOM: 'SO', YEM: 'YE', PSE: 'PS',
}

export async function ingestUNHCR(): Promise<{ stored: number; skipped: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0

  for (const country of WATCH_COUNTRIES) {
    try {
      // Get latest displacement figures
      const res = await fetch(
        `${UNHCR_API}?population_group=refugees,asylum_seekers,idps&year=2023,2024,2025,2026&iso3=${country.code}`,
        {
          headers: { 'User-Agent': 'ConflictOps/1.0 (conflictradar.co)' },
          signal: AbortSignal.timeout(10000),
        }
      )

      if (!res.ok) continue

      const data = await res.json() as {
        data?: Array<{ year: number; individuals: number; population_group: string }>
      }

      const rows = data.data ?? []
      if (rows.length < 2) continue

      // Sort by year desc
      const sorted = rows.sort((a, b) => b.year - a.year)
      const latest = sorted[0]
      if (!latest) continue
      const prev = sorted.find(r => r.year === latest.year - 1)

      if (!prev || !latest.individuals || !prev.individuals) continue

      const pctChange = ((latest.individuals - prev.individuals) / prev.individuals) * 100
      if (Math.abs(pctChange) < 10) continue // Only flag >10% change

      const isIncrease = pctChange > 0
      const severity = Math.abs(pctChange) >= 50 ? 4 : Math.abs(pctChange) >= 25 ? 3 : 2

      const title = isIncrease
        ? `Displacement surge in ${country.name}: +${Math.round(pctChange)}% YoY (${latest.individuals.toLocaleString()} people)`
        : `Displacement decline in ${country.name}: ${Math.round(pctChange)}% YoY (${latest.individuals.toLocaleString()} people)`

      const { error } = await supabase.from('events').upsert({
        source: 'unhcr',
        source_id: `unhcr-${country.code}-${latest.year}-${latest.population_group}`,
        event_type: 'humanitarian',
        title,
        description: `UNHCR reports ${latest.individuals.toLocaleString()} ${latest.population_group} from ${country.name} in ${latest.year}, ${isIncrease ? 'up' : 'down'} ${Math.abs(Math.round(pctChange))}% from ${prev.year} (${prev.individuals.toLocaleString()}). Displacement trends are a leading indicator of conflict intensity.`,
        region: country.region,
        country_code: ISO3_TO_ISO2[country.code] ?? country.code.slice(0, 2),
        severity,
        status: 'pending',
        occurred_at: new Date(`${latest.year}-01-01`).toISOString(),
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'UNHCR',
          attribution: 'Displacement data from UNHCR (unhcr.org)',
          year: latest.year,
          population_group: latest.population_group,
          pct_change: Math.round(pctChange),
        },
        raw: { country, latest, prev } as unknown as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (!error) stored++; else skipped++
    } catch {
      // skip failed countries
    }
  }

  return { stored, skipped }
}
