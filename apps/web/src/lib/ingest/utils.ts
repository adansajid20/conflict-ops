/**
 * Shared ingest utilities — used across all ingest adapters.
 */

// Re-export classification helpers so ingest adapters can import from one place
export { classifyByTitle as detectEventType, isBlocklisted, resolveEventType } from '@/lib/classification'

/**
 * Clean and normalize a description/snippet field.
 * - Strips all HTML tags
 * - Decodes HTML entities
 * - Removes CMS bylines, photo captions, datelines
 * - Strips RSS outlet boilerplate footers
 * - Deduplicates title from start of description
 * - Truncates at 600 chars at word boundary
 */
export function cleanDescription(raw: string | null | undefined, title?: string | null): string {
  if (!raw?.trim()) return ''
  let text = raw
    // Strip all HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode numeric HTML entities
    .replace(/&#(\d+);/g, (_, c: string) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c: string) => String.fromCharCode(parseInt(c, 16)))
    // Decode named HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    // Remove Drupal/CMS author bylines: "John Smith on Wed, 04/01/2026 - 16:33"
    .replace(/[A-Z][a-zA-Z\s\-]+\s+on\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{2}\/\d{2}\/\d{4}\s+-\s+\d{2}:\d{2}/g, '')
    // Remove photo captions: "(Firstname Lastname/AGENCY)" or "(Name/AFP)"
    .replace(/\([A-Z][a-zA-Z\s.]+\/[A-Z]{2,6}\)/g, '')
    // Remove Reuters/AP datelines: "Apr 2 (Reuters) -"
    .replace(/^[A-Z][a-zA-Z]+\s+\d{1,2}\s+\([A-Za-z]+\)\s+-?\s*/g, '')
    // Strip RSS boilerplate outlet footers
    .replace(/\s*(Mali Actu|maliactu\.net|Mali Actualités)[^.]*$/gi, '')
    .replace(/\s*(BBC News|Reuters -|AP News -|Al Jazeera -|France 24 -)[^.]*$/gi, '')
    .replace(/\s*[-–—]\s*\S+\.(com|net|org|co)\S*\s*$/gi, '')
    // Collapse whitespace
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Strip title from start of description if duplicated
  if (title) {
    const t = title.trim()
    if (text.startsWith(t)) {
      text = text.slice(t.length).replace(/^[\s:.\-–—]+/, '').trim()
    }
  }

  // Truncate to 600 chars at a word boundary
  if (text.length > 600) {
    const cut = text.lastIndexOf(' ', 600)
    text = text.slice(0, cut > 400 ? cut : 600) + '…'
  }

  return text
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
