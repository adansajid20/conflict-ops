/**
 * Shared ingest utilities — used across all ingest adapters.
 */

// Re-export classification helpers so ingest adapters can import from one place
export { classifyByTitle as detectEventType, isBlocklisted, resolveEventType } from '@/lib/classification'

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
    .slice(0, 2000)
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
