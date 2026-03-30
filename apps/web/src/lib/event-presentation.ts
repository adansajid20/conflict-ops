/**
 * Shared event presentation utilities — ConflictRadar Phase 1
 *
 * Functions for rendering event data in the UI and API responses.
 * Centralizes display logic that was previously scattered across components.
 */

import { COUNTRY_NAMES } from '@/lib/utils/location'
import { getPublicSourceName } from '@/lib/utils/source-display'
import { EVENT_TYPE_TO_CATEGORY } from '@/lib/classification'

// Re-export for convenience
export { COUNTRY_NAMES, EVENT_TYPE_TO_CATEGORY }

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventLike {
  id?: string
  source?: string | null
  event_type?: string | null
  title?: string | null
  description?: string | null
  region?: string | null
  country_code?: string | null
  severity?: number | null
  status?: string | null
  occurred_at?: string | null
  ingested_at?: string | null
  location?: string | null
  provenance_raw?: Record<string, unknown> | null
  outlet_name?: string | null
  location_confidence?: string | null
  significance_score?: number | null
  language?: string | null
}

// ─── Location display ─────────────────────────────────────────────────────────

const GEO_PLACEHOLDERS = new Set(['UN', 'United Nations', 'N/A', 'Unknown', 'Global', 'World', '', 'null'])

/**
 * Return a human-readable location string.
 * Priority: country name > region > location string > fallback.
 */
export function getDisplayName(
  countryCode: string | null | undefined,
  region: string | null | undefined,
  locationName?: string | null | undefined
): string {
  if (countryCode && !GEO_PLACEHOLDERS.has(countryCode) && countryCode.length === 2) {
    const name = COUNTRY_NAMES[countryCode]
    if (name) return name
    return countryCode
  }
  if (region && !GEO_PLACEHOLDERS.has(region)) return region
  if (locationName && !GEO_PLACEHOLDERS.has(locationName)) return locationName
  return 'Location unknown'
}

/**
 * Get location display string for an event.
 */
export function getLocationDisplay(event: EventLike): string {
  return getDisplayName(event.country_code, event.region, event.location)
}

// ─── Event type helpers ────────────────────────────────────────────────────────

/**
 * Get the effective (canonical) event type, resolving aliases.
 */
export function getEffectiveType(eventType: string | null | undefined): string {
  if (!eventType) return 'news'
  const ALIASES: Record<string, string> = {
    military: 'armed_conflict',
    mobilization: 'armed_conflict',
    explosion: 'airstrike',
    attack: 'armed_conflict',
    displacement: 'humanitarian_crisis',
    humanitarian: 'humanitarian_crisis',
    security: 'armed_conflict',
    cyber: 'political_crisis',
    wmd_threat: 'armed_conflict',
    economic: 'sanctions',
    report: 'news',
    border_incident: 'armed_conflict',
    maritime_incident: 'armed_conflict',
    aviation_incident: 'armed_conflict',
  }
  return ALIASES[eventType] ?? eventType
}

// ─── Description / snippet ────────────────────────────────────────────────────

const BAD_DESCRIPTIONS = new Set(['No description provided', 'N/A', '', 'null', 'undefined'])

/**
 * Boilerplate phrases from ReliefWeb/UNHCR that add no value.
 */
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

/**
 * Check if an event's description is ReliefWeb/UNHCR boilerplate noise.
 */
export function isStaleReliefWebContent(description: string | null | undefined): boolean {
  if (!description) return true
  const d = description.toLowerCase().trim()
  if (d.length < 20) return true
  return RELIEFWEB_BOILERPLATE.some((p) => d.startsWith(p))
}

/**
 * Get the best description for an event — never returns blank/boilerplate.
 */
export function getBestDescription(event: EventLike, maxLength = 300): string {
  const desc = (event.description ?? '').trim()
  const src = event.source ?? ''

  // For ReliefWeb/UNHCR, aggressively clean boilerplate
  if (src === 'reliefweb' || src === 'unhcr') {
    if (!isStaleReliefWebContent(desc) && desc.length > 30) {
      // Strip leading metadata lines ("Country: Sudan\nSource: UNHCR\n...")
      const cleaned = desc
        .replace(/^(Country|Source|Date|Type|Format|Theme)[^\n]*\n/gim, '')
        .trim()
      if (cleaned.length > 20) return cleaned.slice(0, maxLength)
    }
    return (event.title ?? 'No description available').slice(0, maxLength)
  }

  if (!desc || BAD_DESCRIPTIONS.has(desc)) {
    return (event.title ?? 'No description available').slice(0, maxLength)
  }

  return desc.slice(0, maxLength)
}

// ─── Severity metadata ────────────────────────────────────────────────────────

export interface SeverityMeta {
  label: 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown'
  color: 'red' | 'orange' | 'yellow' | 'blue' | 'gray'
  bgClass: string
  textClass: string
}

/**
 * Get severity display metadata for a numeric severity level.
 */
export function getSeverityMeta(severity: number | null | undefined): SeverityMeta {
  switch (severity) {
    case 4:
      return { label: 'Critical', color: 'red', bgClass: 'bg-red-500/20', textClass: 'text-red-400' }
    case 3:
      return { label: 'High', color: 'orange', bgClass: 'bg-orange-500/20', textClass: 'text-orange-400' }
    case 2:
      return { label: 'Medium', color: 'yellow', bgClass: 'bg-yellow-500/20', textClass: 'text-yellow-400' }
    case 1:
      return { label: 'Low', color: 'blue', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400' }
    default:
      return { label: 'Unknown', color: 'gray', bgClass: 'bg-gray-500/20', textClass: 'text-gray-400' }
  }
}

// ─── Breaking / freshness ─────────────────────────────────────────────────────

const BREAKING_WINDOW_MS = 4 * 60 * 60 * 1000 // 4 hours

/**
 * Returns true if the event is "breaking" — ingested within the last 4 hours
 * AND has a conflict-relevant type.
 */
export function isBreaking(event: EventLike): boolean {
  const ts = event.ingested_at ?? event.occurred_at
  if (!ts) return false

  const ageMs = Date.now() - new Date(ts).getTime()
  if (ageMs > BREAKING_WINDOW_MS) return false

  const breakingTypes = new Set([
    'armed_conflict',
    'airstrike',
    'terrorism',
    'coup',
    'civil_unrest',
    'natural_disaster',
  ])
  return breakingTypes.has(getEffectiveType(event.event_type))
}

// ─── Hot region driver humanization ──────────────────────────────────────────

const DRIVER_LABELS: Record<string, string> = {
  armed_conflict: 'Armed Conflict',
  airstrike: 'Airstrikes',
  terrorism: 'Terrorism',
  coup: 'Coup Activity',
  civil_unrest: 'Civil Unrest',
  protest: 'Protests',
  political_crisis: 'Political Crisis',
  diplomacy: 'Diplomatic Activity',
  ceasefire: 'Ceasefire Talks',
  sanctions: 'Sanctions',
  natural_disaster: 'Natural Disaster',
  humanitarian_crisis: 'Humanitarian Crisis',
  humanitarian: 'Humanitarian',
  displacement: 'Displacement',
  wmd_threat: 'WMD Threat',
  cyber: 'Cyber Incident',
  news: 'Intelligence',
  report: 'Intelligence Report',
  military: 'Military Activity',
  mobilization: 'Military Mobilization',
  explosion: 'Explosion',
  attack: 'Armed Attack',
  security: 'Security Incident',
  border_incident: 'Border Incident',
  maritime_incident: 'Maritime Incident',
  aviation_incident: 'Aviation Incident',
}

/**
 * Humanize an event_type driver label for display in Hot Regions.
 */
export function humanizeDriver(eventType: string): string {
  return DRIVER_LABELS[eventType] ?? eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Check if an event type should be excluded from geopolitical risk scoring
 * (i.e. natural disasters don't count toward geopolitical risk).
 */
export function isGeopoliticalType(eventType: string | null | undefined): boolean {
  if (!eventType) return false
  const NON_GEOPOLITICAL = new Set(['natural_disaster'])
  return !NON_GEOPOLITICAL.has(eventType)
}

// ─── Summary generation ───────────────────────────────────────────────────────

/**
 * Generate a deterministic 1-line summary when AI summary unavailable.
 */
export function generateSummary(event: EventLike): string {
  const loc = event.country_code && COUNTRY_NAMES[event.country_code]
    ? ` in ${COUNTRY_NAMES[event.country_code]}`
    : event.region ? ` in ${event.region}` : ''
  const sev =
    event.severity === 4 ? 'Critical' : event.severity === 3 ? 'Significant' : 'Reported'
  const typeStr = getEffectiveType(event.event_type).replace(/_/g, ' ')
  const srcName = getPublicSourceName(event.source, event.provenance_raw, event.title)
  return `${sev} ${typeStr}${loc} reported by ${srcName}.`
}

/**
 * Count severity distribution in an event array.
 */
export function computeSeverityCounts(
  events: Array<{ severity?: number | null }>
): { critical: number; high: number; medium: number; low: number } {
  return events.reduce(
    (acc, e) => {
      const s = e.severity ?? 1
      if (s >= 4) acc.critical++
      else if (s >= 3) acc.high++
      else if (s >= 2) acc.medium++
      else acc.low++
      return acc
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  )
}
