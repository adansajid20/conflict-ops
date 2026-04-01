import Parser from 'rss-parser'
import { createServiceClient } from '../supabase/server'
import { isBlocklisted, classifyByTitle } from '../classification'

const RSS_FEEDS = [
  { url: 'https://feeds.reuters.com/reuters/worldNews', outlet: 'Reuters', trust: 95 },
  { url: 'https://feeds.reuters.com/Reuters/domesticNews', outlet: 'Reuters', trust: 95 },
  { url: 'https://rsshub.app/apnews/topics/apf-intlnews', outlet: 'AP News', trust: 90 },
  { url: 'https://rsshub.app/apnews/topics/apf-africa', outlet: 'AP News', trust: 90 },
  { url: 'https://rsshub.app/apnews/topics/apf-asiapac', outlet: 'AP News', trust: 90 },
  { url: 'https://rsshub.app/apnews/topics/apf-europe', outlet: 'AP News', trust: 90 },
  { url: 'https://rsshub.app/apnews/topics/apf-middleeast', outlet: 'AP News', trust: 90 },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', outlet: 'BBC News', trust: 88 },
  { url: 'http://feeds.bbci.co.uk/news/world/middle_east/rss.xml', outlet: 'BBC News', trust: 88 },
  { url: 'http://feeds.bbci.co.uk/news/world/europe/rss.xml', outlet: 'BBC News', trust: 88 },
  { url: 'http://feeds.bbci.co.uk/news/world/africa/rss.xml', outlet: 'BBC News', trust: 88 },
  { url: 'http://feeds.bbci.co.uk/news/world/asia/rss.xml', outlet: 'BBC News', trust: 88 },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', outlet: 'Al Jazeera', trust: 82 },
  { url: 'https://rss.dw.com/rdf/rss-en-world', outlet: 'DW News', trust: 80 },
  { url: 'https://www.france24.com/en/rss', outlet: 'France 24', trust: 78 },
  { url: 'https://www.middleeasteye.net/rss', outlet: 'Middle East Eye', trust: 75 },
  { url: 'https://english.alaraby.co.uk/rss.xml', outlet: 'Al-Araby', trust: 72 },
  { url: 'https://www.thenationalnews.com/rss.xml', outlet: 'The National', trust: 72 },
  { url: 'https://rsshub.app/afp/news/en', outlet: 'AFP', trust: 90 },
] as const

interface FeedEntry {
  url: string
  outlet: string
  trust: number
}

const parser = new Parser({
  timeout: 5000,
  headers: { 'User-Agent': 'ConflictRadar/1.0 (conflict intelligence aggregator)' },
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
    } else {
      errors += 1
    }
  }

  return { inserted, skipped, errors }
}

async function parseFeed(
  feed: FeedEntry,
  supabase: ReturnType<typeof createServiceClient>
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0

  try {
    const parsed = await parser.parseURL(feed.url)

    for (const item of parsed.items ?? []) {
      if (!item.title) {
        skipped += 1
        continue
      }

      const title = item.title.trim()
      const link = item.link ?? item.guid ?? null

      if (isBlocklisted(title, link ?? '')) {
        skipped += 1
        continue
      }

      const occurredAt = item.pubDate ? new Date(item.pubDate) : new Date()
      const ageMs = Date.now() - occurredAt.getTime()

      if (Number.isNaN(occurredAt.getTime()) || ageMs > 3 * 60 * 60 * 1000) {
        skipped += 1
        continue
      }

      const externalId = link ?? item.guid ?? title
      const description = (item.contentSnippet ?? item.summary ?? null)?.slice(0, 500) ?? null

      const event = {
        title,
        description,
        source_id: link,
        occurred_at: occurredAt.toISOString(),
        source: 'rss_live',
        event_type: classifyByTitle(title),
        external_id: externalId,
        severity: 1,
        status: 'developing',
        is_humanitarian_report: false,
        raw: {
          outlet: feed.outlet,
          trust: feed.trust,
          feed_url: feed.url,
          guid: item.guid ?? null,
        },
      }

      const { error } = await supabase
        .from('events')
        .upsert(event, { onConflict: 'external_id', ignoreDuplicates: true })

      if (error) skipped += 1
      else inserted += 1
    }
  } catch {
    skipped += 1
  }

  return { inserted, skipped }
}
