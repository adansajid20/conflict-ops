/**
 * GDACS Ingest — Global Disaster Alert and Coordination System
 * Source: gdacs.org — FREE, RSS fallback used because JSON endpoint is returning 404
 * Attribution: "Alert data from GDACS (gdacs.org)"
 */

import { createServiceClient } from '@/lib/supabase/server'

const GDACS_RSS = 'https://www.gdacs.org/xml/rss.xml'

function decodeHtml(input: string): string {
  return input
    .replace(/<!\[CDATA\[|\]\]>/g, '')
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

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1] ? decodeHtml(match[1]).trim() : null
}

function alertLevelToSeverity(level: string): 1 | 2 | 3 | 4 {
  const value = level.toLowerCase()
  if (value === 'red') return 4
  if (value === 'orange') return 3
  if (value === 'green') return 2
  return 2
}

function eventTypeFromTitle(title: string): string {
  const value = title.toLowerCase()
  if (value.includes('earthquake') || value.includes('flood') || value.includes('cyclone') || value.includes('storm')) return 'natural_disaster'
  if (value.includes('drought') || value.includes('epidemic')) return 'humanitarian'
  return 'natural_disaster'
}

function countryToRegion(country: string): string {
  const MAPPING: Record<string, string> = {
    indonesia: 'Southeast Asia', ukraine: 'Eastern Europe', russia: 'Eastern Europe',
    syria: 'Middle East', iraq: 'Middle East', yemen: 'Middle East', sudan: 'East Africa',
    ethiopia: 'East Africa', somalia: 'East Africa', 'south sudan': 'East Africa',
    'dr congo': 'Central Africa', mali: 'West Africa', niger: 'West Africa', nigeria: 'West Africa',
    libya: 'North Africa', afghanistan: 'South Asia', myanmar: 'Southeast Asia', palestine: 'Middle East',
    israel: 'Middle East', lebanon: 'Middle East', pakistan: 'South Asia', taiwan: 'East Asia',
  }
  const key = country.toLowerCase()
  for (const [name, region] of Object.entries(MAPPING)) {
    if (key.includes(name)) return region
  }
  return 'Global'
}

function extractItems(xml: string): string[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1] ?? '')
}

export async function ingestGDACS(): Promise<{ stored: number; skipped: number }> {
  const supabase = createServiceClient()
  let stored = 0, skipped = 0

  try {
    const res = await fetch(GDACS_RSS, {
      headers: { 'User-Agent': 'ConflictOps/1.0 (conflictradar.co)', Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) return { stored, skipped }
    const xml = await res.text()

    for (const item of extractItems(xml)) {
      const title = stripTags(extractTag(item, 'title') ?? '')
      const description = stripTags(extractTag(item, 'description') ?? '')
      const link = stripTags(extractTag(item, 'link') ?? '')
      const guid = stripTags(extractTag(item, 'guid') ?? link)
      const pubDate = stripTags(extractTag(item, 'pubDate') ?? '')
      const alertLevel = stripTags(extractTag(item, 'gdacs:alertlevel') ?? '')
      const country = stripTags(extractTag(item, 'gdacs:country') ?? '')
      const point = stripTags(extractTag(item, 'georss:point') ?? '')
      const [latRaw, lonRaw] = point.split(/\s+/)
      const lat = Number(latRaw)
      const lon = Number(lonRaw)

      const { error } = await supabase.from('events').upsert({
        source: 'gdacs',
        source_id: `gdacs-${guid || title}`,
        event_type: eventTypeFromTitle(title),
        title,
        description: description.slice(0, 1000) || title,
        region: countryToRegion(country),
        country_code: null,
        severity: alertLevelToSeverity(alertLevel),
        status: 'pending',
        occurred_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        location: Number.isFinite(lat) && Number.isFinite(lon) ? `POINT(${lon} ${lat})` : null,
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'GDACS',
          attribution: 'Alert data from GDACS (gdacs.org)',
          alert_level: alertLevel,
          url: link,
          country,
          feed: GDACS_RSS,
        },
        raw: { title, description, link, guid, point } as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (!error) stored++; else skipped++
    }
  } catch {
    // non-critical
  }

  return { stored, skipped }
}
