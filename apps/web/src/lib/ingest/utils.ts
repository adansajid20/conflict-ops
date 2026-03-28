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

  // Most specific first
  if (/airstrike|air strike|bombing run|bomb|drone strike|missile strike|shelling|artillery/.test(t)) return 'airstrike'
  if (/coup|junta|overthrow|seized power|military takeover/.test(t)) return 'coup'
  if (/ceasefire|peace deal|truce|armistice|peace talks|peace agreement/.test(t)) return 'ceasefire'
  if (/sanction|embargo|trade ban|economic restriction/.test(t)) return 'sanctions'
  if (/diplomat|summit|treaty|bilateral|multilateral|foreign minister|state visit/.test(t)) return 'diplomacy'
  if (/terrorist|terror attack|suicide bomb|car bomb|ied explosion/.test(t)) return 'terrorism'
  if (/riot|civil unrest|uprising|revolution|insurrection/.test(t)) return 'civil_unrest'
  if (/protest|demonstration|march|rally/.test(t)) return 'protest'
  if (/military|troops|soldiers|offensive|counteroffensive|front line|invasion|siege/.test(t)) return 'armed_conflict'
  if (/earthquake|tsunami|hurricane|typhoon|cyclone|tornado|flood|wildfire|eruption/.test(t)) return 'natural_disaster'
  if (/refugee|displaced|humanitarian|famine|starvation|aid worker/.test(t)) return 'humanitarian_crisis'
  if (/political crisis|government collapse|election fraud|constitutional crisis/.test(t)) return 'political_crisis'

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
