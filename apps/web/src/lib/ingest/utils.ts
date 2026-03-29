/**
 * Shared ingest utilities — used across all ingest adapters.
 */

/**
 * Clean and normalize a description/snippet field.
 * - Decodes HTML entities
 * - Strips extra whitespace
 * - Falls back to title if blank
 * - Max 800 chars
 */
export function cleanDescription(raw: string | null | undefined, fallback: string): string {
  if (!raw?.trim()) return fallback.slice(0, 200)
  return raw
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800)
}

/**
 * Precise event_type classifier — most specific match wins.
 * Used across news_rss and other text-based ingest adapters.
 */
export function detectEventType(text: string): string {
  const t = text.toLowerCase()

  // AIRSTRIKE — any aerial/explosive attack
  if (/airstrike|air strike|bombing run|drone strike|missile strike|shelling|artillery fire|rocket attack|rocket fire|air raid|air attack|aerial bomb|bombed|rockets? fired|missiles? fired|missiles? launched|drone attack/.test(t)) return 'airstrike'
  // Bomb/explosion (more general)
  if (/\bsuicide bomb|car bomb|ied explosion|improvised explosive|roadside bomb/.test(t)) return 'terrorism'

  // COUP
  if (/coup|junta|overthrow|seized power|military takeover|seized the government/.test(t)) return 'coup'

  // CEASEFIRE / PEACE
  if (/ceasefire|cease-fire|peace deal|truce|armistice|peace talks|peace agreement|peace accord/.test(t)) return 'ceasefire'

  // SANCTIONS
  if (/sanction|embargo|trade ban|economic restriction/.test(t)) return 'sanctions'

  // TERRORISM
  if (/terrorist|terror attack|extremist attack|mass shooting|hostage|kidnap|abduct/.test(t)) return 'terrorism'

  // ARMED CONFLICT — broad military/war language
  if (/\bkilled\b|\bkills\b|\bdead\b|\bdeaths?\b|\bcasualt|\bwounded\b|\bslain\b|\bslaughter/.test(t) &&
      /\b(war|conflict|attack|assault|militar|soldier|troop|force|fighter|combatant|gunman|armed)\b/.test(t)) return 'armed_conflict'
  if (/\battack(?:ed|s|ing)?\b|\bassault(?:ed|s|ing)?\b|\bstrike(?:s|d)?\b/.test(t) &&
      /\b(militar|soldier|troop|force|fighter|armed|weapon|gun|bomb|rocket|drone)\b/.test(t)) return 'armed_conflict'
  if (/\bwar\b|\bwarfare\b|\bconflict\b|\bfighting\b|\bclash(?:ed|es)?\b|\bbattle\b|\bcombat\b/.test(t)) return 'armed_conflict'
  if (/military operation|military strike|ground operation|offensive|counteroffensive|front line|frontline|invasion|siege|blockade|occupied|occupation/.test(t)) return 'armed_conflict'
  if (/troops|soldiers|forces deploy|forces advance|forces retreat|army|infantry|armored|tank|warship|gunship/.test(t)) return 'armed_conflict'

  // CIVIL UNREST
  if (/riot|civil unrest|uprising|revolution|insurrection|crackdown on/.test(t)) return 'civil_unrest'
  // PROTEST
  if (/protest|demonstration|march|rally|demonstrators/.test(t)) return 'protest'

  // DIPLOMACY
  if (/diplomat|summit meeting|bilateral talks|multilateral|foreign minister|state visit|peace summit/.test(t)) return 'diplomacy'

  // NATURAL DISASTER
  if (/earthquake|tsunami|hurricane|typhoon|cyclone|tornado|flood|wildfire|volcanic eruption|eruption/.test(t)) return 'natural_disaster'

  // HUMANITARIAN
  if (/refugee|mass displacement|humanitarian crisis|famine|starvation|aid worker|humanitarian corridor/.test(t)) return 'humanitarian_crisis'

  // POLITICAL CRISIS
  if (/political crisis|government collapse|election fraud|constitutional crisis|martial law/.test(t)) return 'political_crisis'

  return 'news'
}

/**
 * Humanitarian severity scoring based on keyword density.
 * Used by UNHCR, ReliefWeb ingest adapters.
 */
export function humanitarianSeverity(title: string, description: string): 1 | 2 | 3 | 4 {
  const text = `${title} ${description}`.toLowerCase()
  if (/famine|genocide|mass atrocity|mass killing|ethnic cleansing|chemical weapon/.test(text)) return 4
  if (/thousands killed|mass displacement|millions displaced|humanitarian catastrophe/.test(text)) return 3
  if (/hundreds killed|thousands displaced|humanitarian crisis|fighting intensif/.test(text)) return 2
  return 1
}
