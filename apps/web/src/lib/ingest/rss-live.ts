import Parser from 'rss-parser'
import { createServiceClient } from '../supabase/server'
import { isBlocklisted, classifyByTitle, inferRegionFromTitle } from '../classification'

const RSS_FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/worldNews', outlet: 'Reuters', trust: 95, region: null },
  { url: 'https://feeds.reuters.com/reuters/topNews', outlet: 'Reuters', trust: 95, region: null },
  { url: 'https://rsshub.app/apnews/topics/apf-intlnews', outlet: 'AP News', trust: 92, region: null },
  { url: 'https://rsshub.app/apnews/topics/apf-africa', outlet: 'AP News', trust: 92, region: 'sub_saharan_africa' },
  { url: 'https://rsshub.app/apnews/topics/apf-asiapac', outlet: 'AP News', trust: 92, region: 'south_asia' },
  { url: 'https://rsshub.app/apnews/topics/apf-europe', outlet: 'AP News', trust: 92, region: 'eastern_europe' },
  { url: 'https://rsshub.app/apnews/topics/apf-middleeast', outlet: 'AP News', trust: 92, region: 'middle_east' },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', outlet: 'BBC News', trust: 88, region: null },
  { url: 'http://feeds.bbci.co.uk/news/world/middle_east/rss.xml', outlet: 'BBC News', trust: 88, region: 'middle_east' },
  { url: 'http://feeds.bbci.co.uk/news/world/europe/rss.xml', outlet: 'BBC News', trust: 88, region: 'eastern_europe' },
  { url: 'http://feeds.bbci.co.uk/news/world/africa/rss.xml', outlet: 'BBC News', trust: 88, region: 'sub_saharan_africa' },
  { url: 'http://feeds.bbci.co.uk/news/world/asia/rss.xml', outlet: 'BBC News', trust: 88, region: 'south_asia' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', outlet: 'Al Jazeera', trust: 83, region: null },
  { url: 'https://rss.dw.com/rdf/rss-en-world', outlet: 'DW News', trust: 80, region: null },
  { url: 'https://www.france24.com/en/rss', outlet: 'France 24', trust: 79, region: null },
  { url: 'https://rsshub.app/afp/news/en', outlet: 'AFP', trust: 90, region: null },
  { url: 'https://www.middleeasteye.net/rss', outlet: 'Middle East Eye', trust: 76, region: 'middle_east' },
  { url: 'https://english.alaraby.co.uk/rss.xml', outlet: 'Al-Araby', trust: 74, region: 'middle_east' },
  { url: 'https://www.thenationalnews.com/rss.xml', outlet: 'The National', trust: 73, region: 'middle_east' },
  { url: 'https://www.dawn.com/feeds/home', outlet: 'Dawn', trust: 76, region: 'south_asia' },
  { url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', outlet: 'Times of India', trust: 72, region: 'south_asia' },
  { url: 'https://www.theeastafrican.co.ke/rss', outlet: 'The East African', trust: 71, region: 'sub_saharan_africa' },
  { url: 'https://www.channelnewsasia.com/rssfeeds/8395986', outlet: 'CNA', trust: 74, region: 'southeast_asia' },
] as const

const CONFLICT_KEYWORDS = [
  'war', 'attack', 'killed', 'airstrike', 'missile', 'troops', 'military',
  'bomb', 'explosion', 'ceasefire', 'sanctions', 'invasion', 'occupation',
  'conflict', 'fighting', 'battle', 'forces', 'soldiers', 'casualties',
  'strike', 'offensive', 'rebel', 'insurgent', 'terrorism', 'terrorist',
  'nuclear', 'weapons', 'siege', 'blockade', 'protest', 'crackdown',
  'arrested', 'detained', 'coup', 'assassination', 'shooting', 'gunfire',
  'hostage', 'kidnap', 'displaced', 'refugee', 'evacuation', 'emergency',
  'threat', 'espionage', 'cyber', 'hack', 'diplomacy', 'crisis', 'tension',
  'humanitarian', 'famine', 'earthquake', 'disaster', 'NATO', 'UN ', 'ICC',
  'Iran', 'Israel', 'Gaza', 'Ukraine', 'Russia', 'Sudan', 'Yemen', 'Syria',
  'Libya', 'Somalia', 'Mali', 'Ethiopia', 'Myanmar', 'Taiwan', 'Pakistan',
  'North Korea', 'Kashmir', 'Houthi', 'Hamas', 'Hezbollah',
] as const

const BOILERPLATE = [
  'please refer to the attached',
  'please find attached',
  'see attached',
  'click here to read',
  'read more at',
] as const

type FeedEntry = (typeof RSS_FEEDS)[number]

function hasConflictKeyword(title: string, desc: string): boolean {
  const text = `${title} ${desc}`.toLowerCase()
  return CONFLICT_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))
}

const parser = new Parser({
  timeout: 8000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConflictRadar/1.0)' },
})

export async function ingestRSSLive(): Promise<{ inserted: number; skipped: number; errors: number }> {
  const supabase = createServiceClient()
  let inserted = 0
  let skipped = 0
  let errors = 0

  const results = await Promise.allSettled(RSS_FEEDS.map((feed) => parseFeed(feed, supabase)))
  for (const result of results) {
    if (result.status === 'fulfilled') {
      inserted += result.value.inserted
      skipped += result.value.skipped
      errors += result.value.errors
    } else {
      errors += 1
    }
  }

  return { inserted, skipped, errors }
}

async function parseFeed(
  feed: FeedEntry,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ inserted: number; skipped: number; errors: number }> {
  let inserted = 0
  let skipped = 0
  let errors = 0

  try {
    const parsed = await parser.parseURL(feed.url)
    const batch: Record<string, unknown>[] = []

    for (const item of (parsed.items ?? []).slice(0, 30)) {
      if (!item.title) {
        skipped += 1
        continue
      }

      const title = item.title.trim()
      const link = item.link ?? item.guid ?? null
      const snippet = (item.contentSnippet ?? item.summary ?? '').slice(0, 500)

      if (isBlocklisted(title, link ?? '', snippet)) {
        skipped += 1
        continue
      }

      if (!hasConflictKeyword(title, snippet)) {
        skipped += 1
        continue
      }

      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date()
      if (Number.isNaN(pubDate.getTime()) || (Date.now() - pubDate.getTime()) > 6 * 60 * 60 * 1000) {
        skipped += 1
        continue
      }

      if (BOILERPLATE.some((fragment) => snippet.toLowerCase().includes(fragment))) {
        skipped += 1
        continue
      }

      if (title.length < 30 && snippet.length < 30) {
        skipped += 1
        continue
      }

      const externalId = link ?? item.guid ?? title
      const region = feed.region ?? inferRegionFromTitle(title)

      batch.push({
        title,
        description: snippet || null,
        source_id: link,
        occurred_at: pubDate.toISOString(),
        source: 'rss_live',
        event_type: classifyByTitle(title),
        external_id: externalId,
        region,
        severity: 1,
        is_humanitarian_report: false,
        raw: {
          outlet: feed.outlet,
          trust: feed.trust,
          feed_url: feed.url,
          guid: item.guid ?? null,
        },
      })
    }

    if (batch.length > 0) {
      const { error } = await supabase.from('events').upsert(batch, {
        onConflict: 'external_id',
        ignoreDuplicates: true,
      })

      if (error) {
        errors += 1
        skipped += batch.length
      } else {
        inserted += batch.length
      }
    }
  } catch {
    errors += 1
  }

  return { inserted, skipped, errors }
}
