import { createServiceClient } from '@/lib/supabase/server'
import { titleFingerprint } from './dedup'
import { cleanDescription, detectEventType } from './utils'
import { isHumanitarianBureaucracy } from '@/lib/classification'

type FeedTier = 'A' | 'B+' | 'B' | 'C'

interface NewsSource {
  name: string
  url: string
  tier: FeedTier
  region: string | null
  official?: boolean
}

const NEWS_SOURCES: readonly NewsSource[] = [
  { name: 'Reuters Top News', url: 'https://feeds.reuters.com/reuters/topNews', tier: 'A', region: null },
  { name: 'Reuters World', url: 'https://feeds.reuters.com/reuters/worldNews', tier: 'A', region: null },
  { name: 'AP International', url: 'https://apnews.com/apf-intlnews.rss', tier: 'A', region: null },
  { name: 'AP Middle East', url: 'https://apnews.com/apf-middleeast.rss', tier: 'A', region: 'Middle East' },
  { name: 'AP Europe', url: 'https://apnews.com/apf-europe.rss', tier: 'A', region: 'Europe' },
  { name: 'AP Africa', url: 'https://apnews.com/apf-africa.rss', tier: 'A', region: 'Africa' },
  { name: 'AP Asia Pacific', url: 'https://apnews.com/apf-asiapacific.rss', tier: 'A', region: 'Asia Pacific' },
  { name: 'Deutsche Welle', url: 'https://www.dw.com/en/rss/umb-news/s-9097/rdf', tier: 'A', region: null },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', tier: 'A', region: null },
  { name: 'The New Arab', url: 'https://english.alaraby.co.uk/rss.xml', tier: 'B+', region: 'Middle East' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', tier: 'A', region: null },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', tier: 'A', region: null },
  { name: 'Radio Free Europe', url: 'https://www.rferl.org/api/zbqnrtn_rzvy/news/1', tier: 'A', region: 'Eastern Europe' },
  { name: 'Voice of America', url: 'https://www.voanews.com/api/epiqq$vrgbfp/news/1', tier: 'A', region: null },
  { name: 'ReliefWeb OCHA', url: 'https://reliefweb.int/updates/rss.xml?source=UN+OCHA', tier: 'A', region: null, official: true },
  { name: 'ICRC', url: 'https://www.icrc.org/en/rss/news', tier: 'A', region: null, official: true },
  { name: 'UNHCR', url: 'https://www.unhcr.org/rss/news', tier: 'A', region: null, official: true },
  { name: 'UN Press', url: 'https://press.un.org/en/rss.xml', tier: 'A', region: null, official: true },
  { name: 'IISS Analysis', url: 'https://www.iiss.org/publications/analysis/rss', tier: 'B+', region: null },
  { name: 'Foreign Policy', url: 'https://foreignpolicy.com/feed/', tier: 'B', region: null },
] as const

const CRITICAL_KEYWORDS = ['killed', 'airstrike', 'bombing', 'missile', 'explosion', 'massacre', 'mass casualty', 'war declaration', 'invasion', 'offensive', 'siege', 'genocide', 'chemical weapon']
const HIGH_KEYWORDS = ['attack', 'troops', 'military', 'armed', 'casualties', 'wounded', 'occupied', 'conflict', 'fighting', 'combat', 'gunfire', 'clashes']
const MEDIUM_KEYWORDS = ['protest', 'tension', 'sanctions', 'displaced', 'humanitarian', 'refugee', 'crisis', 'coup', 'arrested', 'detained', 'border', 'blockade', 'ceasefire', 'negotiations']

function scoreSeverity(text: string): 1 | 2 | 3 | 4 {
  const lower = text.toLowerCase()
  if (CRITICAL_KEYWORDS.some((keyword) => lower.includes(keyword))) return 4
  if (HIGH_KEYWORDS.some((keyword) => lower.includes(keyword))) return 3
  if (MEDIUM_KEYWORDS.some((keyword) => lower.includes(keyword))) return 2
  return 1
}

const COUNTRY_HINTS: Array<{ keywords: string[]; code: string; region: string }> = [
  { keywords: ['ukraine', 'ukrainian', 'kyiv', 'zelenskyy', 'donbas', 'kharkiv', 'odesa'], code: 'UA', region: 'Eastern Europe' },
  { keywords: ['russia', 'russian', 'moscow', 'kremlin', 'putin'], code: 'RU', region: 'Eastern Europe' },
  { keywords: ['israel', 'israeli', 'gaza', 'hamas', 'tel aviv', 'west bank', 'netanyahu', 'idf'], code: 'IL', region: 'Middle East' },
  { keywords: ['iran', 'iranian', 'tehran', 'irgc', 'khamenei'], code: 'IR', region: 'Middle East' },
  { keywords: ['sudan', 'sudanese', 'khartoum', 'darfur', 'rsf'], code: 'SD', region: 'Africa' },
  { keywords: ['myanmar', 'burma', 'burmese', 'yangon', 'naypyidaw', 'junta'], code: 'MM', region: 'Southeast Asia' },
]

function detectLocation(text: string): { country_code: string | null; region: string | null } {
  const lower = text.toLowerCase()
  for (const hint of COUNTRY_HINTS) {
    if (hint.keywords.some((keyword) => lower.includes(keyword))) {
      return { country_code: hint.code, region: hint.region }
    }
  }
  return { country_code: null, region: null }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

interface RssItem {
  title: string
  link: string
  pubDate: string | null
  isoDate: string | null
  description: string
  sourceName: string
}

function parseRSS(xml: string, sourceName: string): RssItem[] {
  const items: RssItem[] = []
  const itemBlocks = [...xml.matchAll(/<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2] ?? '')

  for (const block of itemBlocks) {
    const titleMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i) ?? block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? stripTags(titleMatch[1] ?? '') : ''
    if (!title) continue

    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i) ?? block.match(/<link[^>]+href="([^"]+)"/i) ?? block.match(/<id>(https?:[^<]+)<\/id>/i)
    const link = (linkMatch?.[1] ?? '').trim()
    if (!link || link.length < 10 || link.startsWith('<')) continue

    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? block.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ?? block.match(/<dc:date>([\s\S]*?)<\/dc:date>/i)?.[1] ?? '').trim() || null
    const isoDate = (block.match(/<isoDate>([\s\S]*?)<\/isoDate>/i)?.[1] ?? block.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ?? '').trim() || null

    const fullContentMatch = block.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i) ?? block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) ?? block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)
    const shortDescMatch = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i) ?? block.match(/<description>([\s\S]*?)<\/description>/i)
    const rawDesc = fullContentMatch ? stripTags(fullContentMatch[1] ?? '').slice(0, 2000) : shortDescMatch ? stripTags(shortDescMatch[1] ?? '').slice(0, 800) : ''

    items.push({ title, link, pubDate, isoDate, description: rawDesc, sourceName })
  }

  return items
}

const RELEVANT_EVENT_TYPES = new Set(['airstrike', 'armed_conflict', 'terrorism', 'political_crisis', 'civil_unrest', 'displacement', 'humanitarian', 'wmd_threat', 'natural_disaster', 'economic'])
const RELEVANCE_KEYWORDS = ['war', 'conflict', 'attack', 'kill', 'dead', 'wound', 'bomb', 'missile', 'strike', 'soldier', 'troop', 'military', 'army', 'navy', 'air force', 'refugee', 'displaced', 'evacuation', 'humanitarian', 'aid', 'famine', 'coup', 'protest', 'riot', 'uprising', 'rebel', 'militia', 'terrorist', 'sanction', 'embargo', 'ceasefire', 'peace', 'treaty', 'diplomacy', 'earthquake', 'flood', 'cyclone', 'hurricane', 'wildfire', 'disaster', 'nuclear', 'chemical', 'weapon', 'ammunition', 'artillery', 'drone', 'border', 'blockade', 'siege', 'hostage', 'captured', 'prisoner', 'genocide', 'massacre', 'ethnic', 'occupation', 'annexation', 'nato', 'un ', 'united nations', 'security council', 'iaea', 'iran', 'russia', 'ukraine', 'gaza', 'israel', 'hamas', 'hezbollah', 'sudan', 'myanmar', 'somalia', 'yemen', 'syria', 'iraq', 'afghanistan', 'north korea', 'taiwan strait', 'south china sea']
const ECON_BLOCK_PATTERNS = /\b(energy\s+crunch|energy\s+prices?|energy\s+market|power\s+grid\s+shortage|utility\s+rates?|electricity\s+prices?|oil\s+prices?|gas\s+prices?|stock\s+market|inflation\s+rate|recession|gdp\s+growth|trade\s+deficit|central\s+bank\s+rate|interest\s+rates?|weathering\s+europe|energy\s+transition)\b/i
const CONFLICT_OVERRIDE = /\b(attack|strike|airstrike|missile|bomb|kill|dead|wound|troops|military|war|conflict|rebel|coup|terror|threat|weapon|sanction|invad)\b/i

function isConflictRelevant(title: string, description: string, eventType: string): boolean {
  if (RELEVANT_EVENT_TYPES.has(eventType)) return true
  const combined = `${title} ${description}`.toLowerCase()
  if (ECON_BLOCK_PATTERNS.test(combined) && !CONFLICT_OVERRIDE.test(combined)) return false
  return RELEVANCE_KEYWORDS.some((keyword) => combined.includes(keyword))
}

function parsePublishedAt(item: RssItem): Date | null {
  const raw = item.pubDate ?? item.isoDate
  if (!raw) return null
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function ingestNewsRSS(): Promise<{
  stored: number
  skipped: number
  skipped_stale: number
  errors: number
  sources_ok: number
}> {
  const supabase = createServiceClient()
  let stored = 0
  let skipped = 0
  let skipped_stale = 0
  let errors = 0
  let sources_ok = 0
  const toUpsert: Array<Record<string, unknown>> = []
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const recentFingerprintSet = new Set<string>()

  const fetchResults = await Promise.allSettled(
    NEWS_SOURCES.map(async (src) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)
      try {
        const response = await fetch(src.url, {
          headers: {
            'User-Agent': 'ConflictOps/1.0 (conflictradar.co; RSS reader)',
            Accept: 'application/rss+xml, application/xml, text/xml, */*',
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return { src, xml: await response.text() }
      } finally {
        clearTimeout(timeout)
      }
    }),
  )

  for (const result of fetchResults) {
    if (result.status === 'rejected') {
      errors++
      continue
    }

    const { src, xml } = result.value
    sources_ok++
    const items = parseRSS(xml, src.name)

    for (const item of items) {
      const publishedAt = parsePublishedAt(item)
      if (publishedAt && publishedAt < cutoff) continue

      if (!src.official && publishedAt) {
        const ageHours = (Date.now() - publishedAt.getTime()) / (60 * 60 * 1000)
        if (ageHours > 6) {
          skipped_stale++
          continue
        }
      }

      const occurredAt = publishedAt?.toISOString() ?? new Date().toISOString()
      const fingerprint = titleFingerprint(item.title)
      if (recentFingerprintSet.has(fingerprint)) {
        skipped++
        continue
      }
      recentFingerprintSet.add(fingerprint)

      const fullText = `${item.title} ${item.description}`
      const eventType = detectEventType(fullText)
      if (!isConflictRelevant(item.title, item.description, eventType)) {
        skipped++
        continue
      }

      const severity = Math.min(scoreSeverity(fullText), 2) as 1 | 2
      const location = detectLocation(fullText)
      const region = location.region ?? src.region ?? null
      const cleanUrl = item.link.split('?')[0]?.split('#')[0] ?? item.link
      const sourceId = `news_rss:${src.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}:${Buffer.from(cleanUrl).toString('base64').slice(0, 32)}`
      const snippet = cleanDescription(item.description, item.title)

      const isHumanitarianReport = isHumanitarianBureaucracy({ title: item.title, description: snippet })
      toUpsert.push({
        source: 'news_rss',
        source_id: sourceId,
        event_type: eventType,
        title: item.title.slice(0, 500),
        description: snippet,
        region,
        country_code: null,
        severity,
        status: 'developing',
        occurred_at: occurredAt,
        is_humanitarian_report: isHumanitarianReport,
        heavy_lane_processed: false,
        provenance_raw: {
          source: src.name,
          attribution: `${src.name} (via RSS)`,
          url: item.link,
          tier: src.tier,
          state_media: src.tier === 'C',
          official: Boolean(src.official),
        } as Record<string, unknown>,
        raw: {
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          isoDate: item.isoDate,
          sourceName: src.name,
        } as Record<string, unknown>,
      })
    }
  }

  const batchSize = 20
  for (let index = 0; index < toUpsert.length; index += batchSize) {
    const batch = toUpsert.slice(index, index + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map((record) => supabase.from('events').upsert(record, { onConflict: 'source,source_id', ignoreDuplicates: true })),
    )

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && !result.value.error) stored++
      else skipped++
    }
  }

  return { stored, skipped, skipped_stale, errors, sources_ok }
}
