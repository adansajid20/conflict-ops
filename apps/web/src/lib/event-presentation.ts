/**
 * Shared event presentation utilities — ConflictRadar Phase 1
 */

import { COUNTRY_NAMES } from '@/lib/utils/location'
import { EVENT_TYPE_TO_CATEGORY } from '@/lib/classification'
import { resolveOutletName } from '@/lib/outlet-resolver'

export { COUNTRY_NAMES, EVENT_TYPE_TO_CATEGORY }

export interface EventLike {
  id?: string
  source?: string | null
  source_id?: string | null
  event_type?: string | null
  title?: string | null
  description?: string | null
  content?: string | null
  summary_short?: string | null
  summary_full?: string | null
  region?: string | null
  country_code?: string | null
  severity?: number | null
  status?: string | null
  occurred_at?: string | null
  event_date?: string | null
  published_at?: string | null
  created_at?: string | null
  ingested_at?: string | null
  location?: string | null
  provenance_raw?: Record<string, unknown> | null
  raw?: Record<string, unknown> | null
  outlet_name?: string | null
  location_confidence?: string | number | null
  significance_score?: number | null
  language?: string | null
  source_url?: string | null
  key_actors?: string[] | null
  corroboration_count?: number | null
  is_humanitarian_report?: boolean | null
}

export interface ClientEvent {
  id: string
  title: string
  description: string | null
  published_at: string | null
  location: string | null
  country: string | null
  country_region: string | null
  event_type: string | null
  significance_tier: string
  outlet_name: string
  source_url: string | null
  key_actors: string[] | null
  summary_short: string | null
  corroboration_count: number | null
  is_humanitarian_report: boolean
  location_confidence_label: string
}

const GEO_PLACEHOLDERS = new Set(['UN', 'United Nations', 'N/A', 'Unknown', 'Global', 'World', '', 'null'])
const BAD_DESCRIPTIONS = new Set(['No description provided', 'N/A', '', 'null', 'undefined'])

const RELIEFWEB_BOILERPLATE = [
  'please note that',
  'this document has been converted',
  'the report was prepared by',
  'for more information',
  'source: reliefweb',
  'powered by reliefweb',
  'un ocha',
  'for the latest humanitarian',
  'situation report',
  'flash update',
  'humanitarian update',
  'response plan',
  'country: ',
  'source: ',
]

export function sanitizeSourceDisplay(source: string): string {
  if (/(gdelt|acled|reliefweb|newsapi|eonet|firms)/i.test(source)) {
    return 'ConflictRadar Intelligence Network'
  }
  return source
}

export function getSignificanceTier(score: number | null | undefined): { label: string; color: string; bgColor: string } {
  if (score === null || score === undefined) {
    return { label: 'Monitoring', color: 'text-slate-400', bgColor: 'bg-slate-800' }
  }
  if (score >= 85) return { label: 'Extreme', color: 'text-red-400', bgColor: 'bg-red-950' }
  if (score >= 70) return { label: 'Critical', color: 'text-orange-400', bgColor: 'bg-orange-950' }
  if (score >= 50) return { label: 'Significant', color: 'text-yellow-400', bgColor: 'bg-yellow-950' }
  if (score >= 30) return { label: 'Notable', color: 'text-blue-400', bgColor: 'bg-blue-950' }
  return { label: 'Routine', color: 'text-slate-400', bgColor: 'bg-slate-900' }
}

export function getLocationConfidenceLabel(confidence: number | null | undefined): { label: string; icon: string } {
  if (confidence === null || confidence === undefined) return { label: 'Region-level', icon: '◎' }
  if (confidence >= 0.85) return { label: 'High precision', icon: '●' }
  if (confidence >= 0.60) return { label: 'City-level', icon: '●' }
  if (confidence >= 0.35) return { label: 'Region-level', icon: '◉' }
  return { label: 'Country-level', icon: '○' }
}

function coerceLocationConfidence(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return null
    if (normalized === 'high' || normalized === 'precise' || normalized === 'exact') return 0.9
    if (normalized === 'city' || normalized === 'city-level') return 0.7
    if (normalized === 'approximate' || normalized === 'region' || normalized === 'region-level') return 0.4
    if (normalized === 'country' || normalized === 'country-level' || normalized === 'unknown') return 0.2
    const parsed = Number.parseFloat(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function getDisplayName(countryCode: string | null | undefined, region: string | null | undefined, locationName?: string | null | undefined): string {
  if (countryCode && !GEO_PLACEHOLDERS.has(countryCode) && countryCode.length === 2) {
    return COUNTRY_NAMES[countryCode] ?? countryCode
  }
  if (region && !GEO_PLACEHOLDERS.has(region)) return region
  if (locationName && !GEO_PLACEHOLDERS.has(locationName)) return locationName
  return 'Location unknown'
}

export function getLocationDisplay(event: EventLike): string {
  return getDisplayName(event.country_code, event.region, event.location)
}

export function getEffectiveType(eventType: string | null | undefined): string {
  if (!eventType) return 'news'
  const ALIASES: Record<string, string> = {
    conflict: 'armed_conflict',
    political: 'political_crisis',
    military: 'armed_conflict', mobilization: 'armed_conflict', explosion: 'airstrike',
    attack: 'armed_conflict', displacement: 'humanitarian_crisis', humanitarian: 'humanitarian_crisis',
    security: 'armed_conflict', cyber: 'political_crisis', wmd_threat: 'armed_conflict',
    economic: 'sanctions', report: 'news', border_incident: 'armed_conflict',
    maritime_incident: 'armed_conflict', aviation_incident: 'armed_conflict',
  }
  return ALIASES[eventType] ?? eventType
}

export function isStaleReliefWebContent(description: string | null | undefined): boolean {
  if (!description) return true
  const d = description.toLowerCase().trim()
  if (d.length < 20) return true
  return RELIEFWEB_BOILERPLATE.some((p) => d.startsWith(p))
}

export function getBestDescription(event: EventLike, maxLength = 300): string {
  const summaryShort = (event.summary_short ?? '').trim()
  if (summaryShort) return summaryShort.slice(0, maxLength)

  const desc = (event.description ?? '').trim()
  const src = (event.source ?? '').toLowerCase()
  if (src === 'reliefweb' || src === 'unhcr') {
    if (!isStaleReliefWebContent(desc) && desc.length > 20) {
      const cleaned = desc.replace(/^(Country|Source|Date|Type|Format|Theme)[^\n]*\n/gim, '').trim()
      if (cleaned) return cleaned.slice(0, maxLength)
    }
  } else if (desc && !BAD_DESCRIPTIONS.has(desc)) {
    return desc.slice(0, maxLength)
  }

  const content = (event.content ?? '').trim()
  if (content && content.length < 500 && !BAD_DESCRIPTIONS.has(content)) {
    return content.slice(0, maxLength)
  }

  return (event.title ?? 'Untitled event').trim().slice(0, maxLength)
}

export interface SeverityMeta {
  label: 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown'
  color: 'red' | 'orange' | 'yellow' | 'blue' | 'gray'
  bgClass: string
  textClass: string
}

export function getSeverityMeta(severity: number | null | undefined): SeverityMeta {
  switch (severity) {
    case 4: return { label: 'Critical', color: 'red', bgClass: 'bg-red-500/20', textClass: 'text-red-400' }
    case 3: return { label: 'High', color: 'orange', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400' }
    case 2: return { label: 'Medium', color: 'yellow', bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-400' }
    case 1: return { label: 'Low', color: 'blue', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400' }
    default: return { label: 'Unknown', color: 'gray', bgClass: 'bg-gray-500/20', textClass: 'text-gray-400' }
  }
}

export function isBreaking(event: {
  occurred_at?: string | null
  ingested_at?: string | null
  event_type?: string | null
  severity?: number | null
  title?: string | null
}): boolean {
  const timeField = event.occurred_at ?? event.ingested_at ?? new Date().toISOString()
  const ageMs = Date.now() - new Date(timeField).getTime()
  if (ageMs > 2 * 60 * 60 * 1000) return false

  const conflictTypes = ['conflict', 'airstrike', 'political', 'military', 'terrorism']
  if (event.event_type && !conflictTypes.includes(event.event_type)) return false

  if ((event.severity ?? 0) < 3) return false

  const hardKeywords = [
    'killed', 'attack', 'airstrike', 'missile', 'explosion', 'bomb',
    'troops', 'invasion', 'offensive', 'ceasefire', 'coup', 'assassination', 'nuclear', 'hostage',
  ]
  const title = (event.title ?? '').toLowerCase()
  return hardKeywords.some((kw) => title.includes(kw))
}

const DRIVER_LABELS: Record<string, string> = {
  armed_conflict: 'Armed Conflict', airstrike: 'Airstrikes', terrorism: 'Terrorism', coup: 'Coup Activity', civil_unrest: 'Civil Unrest', protest: 'Protests', political_crisis: 'Political Crisis', diplomacy: 'Diplomatic Activity', ceasefire: 'Ceasefire Talks', sanctions: 'Sanctions', natural_disaster: 'Natural Disaster', humanitarian_crisis: 'Humanitarian Crisis', humanitarian: 'Humanitarian', displacement: 'Displacement', wmd_threat: 'WMD Threat', cyber: 'Cyber Incident', news: 'Intelligence', report: 'Intelligence Report', military: 'Military Activity', mobilization: 'Military Mobilization', explosion: 'Explosion', attack: 'Armed Attack', security: 'Security Incident', border_incident: 'Border Incident', maritime_incident: 'Maritime Incident', aviation_incident: 'Aviation Incident',
}

export function humanizeDriver(eventType: string): string {
  return DRIVER_LABELS[eventType] ?? eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function isGeopoliticalType(eventType: string | null | undefined): boolean {
  if (!eventType) return false
  return !new Set(['natural_disaster']).has(eventType)
}

export const UI_CATEGORY_TYPES: Record<string, string[]> = {
  Conflict: ['armed_conflict', 'terrorism', 'civil_unrest', 'protest', 'wmd_threat', 'coup', 'ceasefire', 'military', 'mobilization', 'attack', 'security', 'border_incident', 'maritime_incident', 'aviation_incident', 'cyber'],
  Airstrikes: ['airstrike', 'explosion'],
  Political: ['political_crisis', 'diplomacy', 'sanctions'],
  Disasters: ['natural_disaster', 'humanitarian_crisis', 'humanitarian', 'displacement'],
  News: ['news', 'report'],
}

export function getUICategory(eventType: string | null | undefined): string {
  const effective = getEffectiveType(eventType)
  for (const [cat, types] of Object.entries(UI_CATEGORY_TYPES)) {
    if (types.includes(effective)) return cat
  }
  return 'News'
}

export function generateSummary(event: EventLike): string {
  const loc = event.country_code && COUNTRY_NAMES[event.country_code] ? ` in ${COUNTRY_NAMES[event.country_code]}` : event.region ? ` in ${event.region}` : ''
  const sev = event.severity === 4 ? 'Critical' : event.severity === 3 ? 'Significant' : 'Reported'
  const typeStr = getEffectiveType(event.event_type).replace(/_/g, ' ')
  const srcName = sanitizeSourceDisplay(resolveOutletName(event.source, event.provenance_raw as Record<string, any> | null, event.title))
  return `${sev} ${typeStr}${loc} reported by ${srcName}.`
}

export function computeSeverityCounts(events: Array<{ severity?: number | null }>): { critical: number; high: number; medium: number; low: number } {
  return events.reduce((acc, e) => {
    const s = e.severity ?? 1
    if (s >= 4) acc.critical++
    else if (s >= 3) acc.high++
    else if (s >= 2) acc.medium++
    else acc.low++
    return acc
  }, { critical: 0, high: 0, medium: 0, low: 0 })
}

export function sanitizeEventForClient(event: Record<string, unknown>): ClientEvent {
  const source = String(event.source ?? '')
  const title = String(event.title ?? 'Untitled event')
  const publishedAt = typeof event.published_at === 'string'
    ? event.published_at
    : typeof event.event_date === 'string'
      ? event.event_date
      : typeof event.occurred_at === 'string'
        ? event.occurred_at
        : typeof event.created_at === 'string'
          ? event.created_at
          : null
  const provenance = ((event.provenance_raw as Record<string, any> | null) ?? (event.raw as Record<string, any> | null) ?? null)
  const outletName = typeof provenance?.outlet === 'string'
    ? sanitizeSourceDisplay(provenance.outlet)
    : sanitizeSourceDisplay(resolveOutletName(source, provenance, title))
  const locationConfidence = getLocationConfidenceLabel(coerceLocationConfidence((event.location_confidence as string | number | null | undefined) ?? null))
  return {
    id: String(event.id ?? ''),
    title,
    description: getBestDescription({
      title,
      description: typeof event.description === 'string' ? event.description : null,
      content: typeof event.content === 'string' ? event.content : null,
      summary_short: typeof event.summary_short === 'string' ? event.summary_short : null,
      source,
    }, 500) || null,
    published_at: publishedAt,
    location: typeof event.location === 'string' && event.location.trim() ? event.location : null,
    country: typeof event.country_code === 'string' ? event.country_code : null,
    country_region: typeof event.region === 'string' ? event.region : null,
    event_type: typeof event.event_type === 'string' ? event.event_type : null,
    significance_tier: getSignificanceTier(typeof event.significance_score === 'number' ? event.significance_score : null).label,
    outlet_name: outletName,
    source_url: typeof event.source_url === 'string'
      ? event.source_url
      : typeof event.source_id === 'string'
        ? event.source_id
        : typeof provenance?.url === 'string'
          ? String(provenance.url)
          : null,
    key_actors: Array.isArray(event.key_actors) ? (event.key_actors as string[]) : null,
    summary_short: typeof event.summary_short === 'string' ? event.summary_short : null,
    corroboration_count: typeof event.corroboration_count === 'number' ? event.corroboration_count : null,
    is_humanitarian_report: Boolean(event.is_humanitarian_report),
    location_confidence_label: `${locationConfidence.icon} ${locationConfidence.label}`,
  }
}
