/**
 * UNHCR ingest
 * Source: ReliefWeb search results for UNHCR reports — reliable HTML fallback because public API endpoint in use was returning HTML
 * Attribution: "UNHCR content discovered via ReliefWeb (reliefweb.int)"
 */

import { createServiceClient } from '@/lib/supabase/server'

const UNHCR_SEARCH_URL = 'https://reliefweb.int/updates?search=UNHCR'

const ISO2_BY_COUNTRY: Record<string, string> = {
  ukraine: 'UA', syria: 'SY', afghanistan: 'AF', sudan: 'SD', 'south sudan': 'SS', myanmar: 'MM',
  ethiopia: 'ET', 'dr congo': 'CD', 'democratic republic of the congo': 'CD', somalia: 'SO',
  yemen: 'YE', palestine: 'PS', greece: 'GR', lebanon: 'LB', iraq: 'IQ', pakistan: 'PK',
}

function decodeHtml(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function stripTags(input: string): string {
  return decodeHtml(input).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function regionFromCode(code: string | null): string {
  const regions: Record<string, string> = {
    UA: 'Eastern Europe', SY: 'Middle East', AF: 'South Asia', SD: 'East Africa', SS: 'East Africa',
    MM: 'Southeast Asia', ET: 'East Africa', CD: 'Central Africa', SO: 'East Africa', YE: 'Middle East',
    PS: 'Middle East', GR: 'Europe', LB: 'Middle East', IQ: 'Middle East', PK: 'South Asia',
  }
  return code ? (regions[code] ?? 'Global') : 'Global'
}

function severityFromText(text: string): number {
  const value = text.toLowerCase()
  if (/emergency|mass displacement|crisis|appeal/.test(value)) return 4
  if (/displacement|refugee|asylum|protection|humanitarian|situation report/.test(value)) return 3
  return 2
}

export async function ingestUNHCR(): Promise<{ stored: number; skipped: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0

  try {
    const res = await fetch(UNHCR_SEARCH_URL, {
      headers: { 'User-Agent': 'ConflictOps/1.0 (conflictradar.co)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { stored, skipped }

    const html = await res.text()
    const articles = [...html.matchAll(/<article[^>]*rw-river-article[\s\S]*?<\/article>/g)].map((match) => match[0])

    for (const article of articles.slice(0, 20)) {
      const linkMatch = article.match(/<h3[^>]*rw-river-article__title[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
      const dateMatch = article.match(/datetime="([^"]+)"/i)
      const countryMatch = article.match(/rw-entity-country-slug__link[^>]*>([^<]+)</i)
      const summaryMatch = article.match(/<div class="rw-river-article__content"[\s\S]*?<p>([\s\S]*?)<\/p>/i)
      const sourceMatch = article.match(/rw-entity-meta__tag-label--source[\s\S]*?rw-entity-meta__tag-value--source[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)

      const title = stripTags(linkMatch?.[2] ?? '')
      const link = linkMatch?.[1] ?? ''
      const occurredAt = dateMatch?.[1] ? new Date(dateMatch[1]).toISOString() : new Date().toISOString()
      const countryName = stripTags(countryMatch?.[1] ?? '')
      const countryCode = ISO2_BY_COUNTRY[countryName.toLowerCase()] ?? null
      const summary = stripTags(summaryMatch?.[1] ?? '')
      const sourceName = stripTags(sourceMatch?.[1] ?? '') || 'UNHCR'
      if (!title || !link) continue
      if (!/UNHCR/i.test(sourceName) && !/UNHCR/i.test(article)) continue

      const text = `${title} ${summary} ${countryName} ${sourceName}`
      const { error } = await supabase.from('events').upsert({
        source: 'unhcr',
        source_id: `unhcr-${link}`,
        event_type: 'humanitarian',
        title,
        description: summary || title,
        region: regionFromCode(countryCode),
        country_code: countryCode,
        severity: severityFromText(text),
        status: 'pending',
        occurred_at: occurredAt,
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'UNHCR',
          attribution: 'UNHCR content discovered via ReliefWeb (reliefweb.int)',
          url: link,
          publisher: sourceName,
          country: countryName || null,
        },
        raw: { html: article } as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (!error) stored++; else skipped++
    }
  } catch {
    // best effort
  }

  return { stored, skipped }
}
