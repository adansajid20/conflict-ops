/**
 * ReliefWeb Ingest — UN OCHA
 * Source: reliefweb.int/api — FREE, no key required
 * Attribution: "Powered by ReliefWeb (reliefweb.int)"
 *
 * Covers: armed conflicts, humanitarian crises, displacement,
 * natural disasters, political instability — global coverage
 * Updated: near real-time (multiple times daily)
 */

import { createServiceClient } from '@/lib/supabase/server'

const RELIEFWEB_API = 'https://api.reliefweb.int/v1'
const APP_NAME = 'conflictradar.co'

type RWReport = {
  id: number
  fields: {
    title: string
    body?: string
    date: { created: string }
    country?: Array<{ name: string; iso3: string }>
    disaster_type?: Array<{ name: string }>
    theme?: Array<{ name: string }>
    source?: Array<{ name: string }>
    url: string
    status: string
  }
}

type RWDisaster = {
  id: number
  fields: {
    name: string
    description?: string
    date: { created: string }
    country?: Array<{ name: string; iso3: string }>
    type?: Array<{ name: string }>
    status: string
    url: string
    glide?: string
  }
}

const CONFLICT_THEMES = ['Conflict and Violence', 'Security', 'Peacekeeping and Peacebuilding', 'Mine Action']
const CONFLICT_DISASTER_TYPES = ['Complex Emergency', 'Civil Unrest', 'Insecurity', 'Armed Conflict']

function iso3ToIso2(iso3: string): string {
  const MAP: Record<string, string> = {
    UKR: 'UA', RUS: 'RU', SYR: 'SY', YEM: 'YE', SDN: 'SD', SSD: 'SS',
    ETH: 'ET', LBY: 'LY', IRQ: 'IQ', AFG: 'AF', MMR: 'MM', COD: 'CD',
    SOM: 'SO', MLI: 'ML', BFA: 'BF', NER: 'NE', CAF: 'CF', MOZ: 'MZ',
    NGA: 'NG', CMR: 'CM', PSE: 'PS', ISR: 'IL', LBN: 'LB', IRN: 'IR',
    PAK: 'PK', IND: 'IN', CHN: 'CN', TWN: 'TW', PRK: 'KP',
  }
  return MAP[iso3.toUpperCase()] ?? iso3.slice(0, 2).toUpperCase()
}

function getRegionFromCountry(iso3: string): string {
  const REGIONS: Record<string, string> = {
    UKR: 'Eastern Europe', RUS: 'Eastern Europe', BLR: 'Eastern Europe',
    SYR: 'Middle East', IRQ: 'Middle East', IRN: 'Middle East', YEM: 'Middle East',
    LBN: 'Middle East', ISR: 'Middle East', PSE: 'Middle East', JOR: 'Middle East',
    SDN: 'East Africa', SSD: 'East Africa', ETH: 'East Africa', SOM: 'East Africa',
    COD: 'Central Africa', CAF: 'Central Africa', CMR: 'Central Africa',
    MLI: 'West Africa', NER: 'West Africa', NGA: 'West Africa', BFA: 'West Africa',
    LBY: 'North Africa', EGY: 'North Africa', TUN: 'North Africa',
    AFG: 'South Asia', PAK: 'South Asia', IND: 'South Asia',
    MMR: 'Southeast Asia', PHL: 'Southeast Asia', THA: 'Southeast Asia',
    CHN: 'East Asia', PRK: 'East Asia', TWN: 'East Asia',
  }
  return REGIONS[iso3.toUpperCase()] ?? 'Global'
}

function severityFromThemes(themes: string[], disasterTypes: string[]): number {
  const all = [...themes, ...disasterTypes].map(t => t.toLowerCase())
  if (all.some(t => t.includes('armed conflict') || t.includes('complex emergency'))) return 4
  if (all.some(t => t.includes('conflict') || t.includes('insecurity') || t.includes('civil unrest'))) return 3
  if (all.some(t => t.includes('security') || t.includes('violence'))) return 2
  return 2
}

export async function ingestReliefWeb(): Promise<{ stored: number; skipped: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0

  // Fetch recent reports tagged with conflict/security themes
  const reportsRes = await fetch(`${RELIEFWEB_API}/reports?appname=${APP_NAME}&filter[operator]=AND&filter[conditions][0][field]=theme.name&filter[conditions][0][value][]=Conflict+and+Violence&filter[conditions][0][value][]=Security&filter[conditions][0][value][]=Mine+Action&filter[conditions][0][value][]=Protection+and+Human+Rights&filter[conditions][0][value][]=Displacement&filter[conditions][0][operator]=OR&filter[conditions][1][field]=date.created&filter[conditions][1][value][from]=${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()}&fields[include][]=title&fields[include][]=body&fields[include][]=date&fields[include][]=country&fields[include][]=theme&fields[include][]=source&fields[include][]=url&sort[]=date.created:desc&limit=100`, {
    headers: { 'User-Agent': `ConflictOps/1.0 (${APP_NAME})` },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)

  if (reportsRes?.ok) {
    const data = await reportsRes.json() as { data?: RWReport[] }
    for (const item of (data.data ?? [])) {
      const f = item.fields
      const country = f.country?.[0]
      const themes = f.theme?.map(t => t.name) ?? []
      const severity = severityFromThemes(themes, [])

      const { error } = await supabase.from('events').upsert({
        source: 'reliefweb',
        source_id: `rw-report-${item.id}`,
        event_type: themes.some(t => t.includes('Conflict')) ? 'conflict' : 'humanitarian',
        title: f.title,
        description: f.body?.slice(0, 1000) ?? f.title,
        region: country ? getRegionFromCountry(country.iso3) : 'Global',
        country_code: country ? iso3ToIso2(country.iso3) : null,
        severity,
        status: 'pending',
        occurred_at: f.date.created,
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'ReliefWeb',
          attribution: 'Powered by ReliefWeb (reliefweb.int)',
          url: f.url,
          themes,
        },
        raw: item as unknown as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (!error) stored++; else skipped++
    }
  }

  // Fetch active disasters
  const disastersRes = await fetch(`${RELIEFWEB_API}/disasters?appname=${APP_NAME}&filter[field]=status&filter[value]=alert&fields[include][]=name&fields[include][]=description&fields[include][]=date&fields[include][]=country&fields[include][]=type&fields[include][]=url&fields[include][]=glide&sort[]=date.created:desc&limit=30`, {
    headers: { 'User-Agent': `ConflictOps/1.0 (${APP_NAME})` },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)

  if (disastersRes?.ok) {
    const data = await disastersRes.json() as { data?: RWDisaster[] }
    for (const item of (data.data ?? [])) {
      const f = item.fields
      const country = f.country?.[0]
      const types = f.type?.map(t => t.name) ?? []
      const isConflict = types.some(t => CONFLICT_DISASTER_TYPES.some(c => t.includes(c)))
      if (!isConflict) continue

      const { error } = await supabase.from('events').upsert({
        source: 'reliefweb',
        source_id: `rw-disaster-${item.id}`,
        event_type: 'conflict',
        title: f.name,
        description: f.description?.slice(0, 1000) ?? f.name,
        region: country ? getRegionFromCountry(country.iso3) : 'Global',
        country_code: country ? iso3ToIso2(country.iso3) : null,
        severity: 4,
        status: 'pending',
        occurred_at: f.date.created,
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'ReliefWeb GLIDE',
          attribution: 'Powered by ReliefWeb (reliefweb.int)',
          url: f.url,
          glide: f.glide,
          types,
        },
        raw: item as unknown as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (!error) stored++; else skipped++
    }
  }

  return { stored, skipped }
}
