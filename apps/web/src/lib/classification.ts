/**
 * Shared classification module — ConflictRadar Phase 1
 *
 * Central source for:
 * - Event type detection from text
 * - Blocklist filtering (titles/domains)
 * - Event type → category taxonomy mapping
 */

// ─── Blocklist ────────────────────────────────────────────────────────────────

/**
 * Hard-block title patterns: consumer/entertainment/sports/finance noise
 * that should never appear in the intel feed regardless of source.
 */
export const TITLE_BLOCK_PATTERN =
  /\b(playstation|xbox|nintendo|gaming|PS5|PS4|iphone|android|samsung|apple\s+watch|airpods|headphones?|sneakers?|fashion|celebrity|antique|auction|recipe|cooking|travel\s+tips?|vacation|real\s+estate|mortgage|stock\s+tip|crypto\s+pump|NFT|metaverse|fortnite|minecraft|esports?|football\s+scores?|soccer\s+match|basketball\s+game|baseball|tennis\s+championship|golf\s+tournament|olympic\s+games?|F1\s+race|nascar|wrestling\s+event|beauty\s+tips?|skincare|makeup|weight\s+loss|diet\s+pill|energy\s+crunch|energy\s+prices?|energy\s+market|power\s+grid\s+shortage|utility\s+rates?|electricity\s+prices?|weathering\s+europe|energy\s+transition|oil\s+prices?|gas\s+prices?|stock\s+market|inflation\s+rate|recession|trade\s+deficit|central\s+bank\s+rate|interest\s+rates?|laser\s+seal|seal\s+paper|adhesive\s+plastic)\b/i

/**
 * Specific title strings that are known-bad ReliefWeb/UNHCR boilerplate.
 */
const BOILERPLATE_TITLE_FRAGMENTS = [
  'guidance on child marriage',
  'forest fire notification',
  'prescribed fire',
  'green fire',
  'fire weather watch',
  'red flag warning',
  'frost advisory',
  'wind advisory',
  'special weather statement',
  'hazardous weather outlook',
]

/**
 * Domains that are known low-quality or irrelevant for conflict intel.
 */
const BLOCKED_DOMAINS = new Set([
  'people.com',
  'eonline.com',
  'tmz.com',
  'variety.com',
  'hollywoodreporter.com',
  'rollingstone.com',
  'espn.com',
  'nfl.com',
  'nba.com',
  'mlb.com',
  'sports.yahoo.com',
  'bleacherreport.com',
])

/**
 * Returns true if the title should be blocklisted.
 * Checks regex pattern + known boilerplate fragments.
 */
export function isBlocklisted(title: string, domain?: string | null): boolean {
  if (!title) return false
  const t = title.toLowerCase()

  // Pattern match
  if (TITLE_BLOCK_PATTERN.test(title)) return true

  // Boilerplate fragment check
  if (BOILERPLATE_TITLE_FRAGMENTS.some((frag) => t.includes(frag))) return true

  // Domain check
  if (domain) {
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase()
    if (BLOCKED_DOMAINS.has(cleanDomain)) return true
  }

  return false
}

// ─── Event type detection ─────────────────────────────────────────────────────

/**
 * Classify an event by its title/description text.
 * Most-specific match wins. Returns event_type string.
 */
export function classifyByTitle(text: string): string {
  const t = text.toLowerCase()

  // AIRSTRIKE — aerial/explosive attacks (most specific)
  if (
    /airstrike|air strike|bombing run|drone strike|missile strike|shelling|artillery fire|rocket attack|rocket fire|air raid|air attack|aerial bomb|bombed|rockets? fired|missiles? fired|missiles? launched|drone attack/.test(
      t
    )
  )
    return 'airstrike'

  // COUP
  if (/coup|junta|overthrow|seized power|military takeover|seized the government/.test(t)) return 'coup'

  // CEASEFIRE / PEACE
  if (/ceasefire|cease-fire|peace deal|truce|armistice|peace talks|peace agreement|peace accord/.test(t))
    return 'ceasefire'

  // SANCTIONS
  if (/sanction|embargo|trade ban|economic restriction/.test(t)) return 'sanctions'

  // TERRORISM
  if (
    /terrorist|terror attack|extremist attack|mass shooting|hostage|kidnap|abduct|suicide bomb|car bomb|ied explosion|improvised explosive|roadside bomb/.test(
      t
    )
  )
    return 'terrorism'

  // ARMED CONFLICT — broad military/war language
  if (
    /\bkilled\b|\bkills\b|\bdead\b|\bdeaths?\b|\bcasualt|\bwounded\b|\bslain\b|\bslaughter/.test(t) &&
    /\b(war|conflict|attack|assault|militar|soldier|troop|force|fighter|combatant|gunman|armed)\b/.test(t)
  )
    return 'armed_conflict'
  if (
    /\battack(?:ed|s|ing)?\b|\bassault(?:ed|s|ing)?\b|\bstrike(?:s|d)?\b/.test(t) &&
    /\b(militar|soldier|troop|force|fighter|armed|weapon|gun|bomb|rocket|drone)\b/.test(t)
  )
    return 'armed_conflict'
  if (
    /\bwar\b|\bwarfare\b|\bconflict\b|\bfighting\b|\bclash(?:ed|es)?\b|\bbattle\b|\bcombat\b/.test(t)
  )
    return 'armed_conflict'
  if (
    /military operation|military strike|ground operation|offensive|counteroffensive|front line|frontline|invasion|siege|blockade|occupied|occupation/.test(
      t
    )
  )
    return 'armed_conflict'
  if (/troops|soldiers|forces deploy|forces advance|forces retreat|army|infantry|armored|tank|warship|gunship/.test(t))
    return 'armed_conflict'

  // CIVIL UNREST
  if (/riot|civil unrest|uprising|revolution|insurrection|crackdown on/.test(t)) return 'civil_unrest'

  // PROTEST
  if (/protest|demonstration|march|rally|demonstrators/.test(t)) return 'protest'

  // DIPLOMACY
  if (
    /diplomat|summit meeting|bilateral talks|multilateral|foreign minister|state visit|peace summit/.test(t)
  )
    return 'diplomacy'

  // NATURAL DISASTER
  if (/earthquake|tsunami|hurricane|typhoon|cyclone|tornado|flood|wildfire|volcanic eruption|eruption/.test(t))
    return 'natural_disaster'

  // HUMANITARIAN
  if (
    /refugee|mass displacement|humanitarian crisis|famine|starvation|aid worker|humanitarian corridor/.test(t)
  )
    return 'humanitarian_crisis'

  // POLITICAL CRISIS
  if (/political crisis|government collapse|election fraud|constitutional crisis|martial law/.test(t))
    return 'political_crisis'

  return 'news'
}

/**
 * Alias for classifyByTitle — used by ingest adapters.
 */
export const detectEventType = classifyByTitle

/**
 * Resolve/normalize an event type string.
 * Maps legacy/variant type names to canonical values.
 */
export function resolveEventType(raw: string | null | undefined): string {
  if (!raw) return 'news'
  const t = raw.toLowerCase().trim()
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
    'natural-disaster': 'natural_disaster',
  }
  return ALIASES[t] ?? t
}

// ─── Taxonomy ─────────────────────────────────────────────────────────────────

/**
 * Maps event_type → top-level display category.
 * Used for Intel Feed category badges and Overview stats.
 */
export const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  armed_conflict: 'Armed Conflict',
  airstrike: 'Armed Conflict',
  terrorism: 'Security',
  coup: 'Political',
  civil_unrest: 'Political',
  protest: 'Political',
  political_crisis: 'Political',
  diplomacy: 'Diplomacy',
  ceasefire: 'Armed Conflict',
  sanctions: 'Diplomacy',
  natural_disaster: 'Natural Disaster',
  humanitarian_crisis: 'Humanitarian',
  humanitarian: 'Humanitarian',
  displacement: 'Humanitarian',
  wmd_threat: 'Security',
  cyber: 'Security',
  military: 'Armed Conflict',
  mobilization: 'Armed Conflict',
  explosion: 'Armed Conflict',
  attack: 'Armed Conflict',
  security: 'Security',
  border_incident: 'Armed Conflict',
  maritime_incident: 'Security',
  aviation_incident: 'Security',
  news: 'Intel',
  report: 'Intel',
}

/**
 * Get the display category for an event type.
 * Falls back to 'Intel' for unknown types.
 */
export function getEventCategory(eventType: string | null | undefined): string {
  if (!eventType) return 'Intel'
  return EVENT_TYPE_TO_CATEGORY[eventType] ?? 'Intel'
}
