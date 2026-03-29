/**
 * NewsAPI — 80,000+ news sources
 * Free tier: 100 requests/day
 * Register: https://newsapi.org/register
 *
 * Required env var: NEWS_API_KEY
 * If not set, gracefully skips.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { detectEventType } from './utils'

// Focused on conflict/security — no domestic crime, sports, finance
const CONFLICT_KEYWORDS = '(war OR airstrike OR "military operation" OR "killed in" OR bombing OR ceasefire OR invasion OR siege OR coup OR "rebel forces" OR "terrorist attack" OR "missile strike" OR "drone strike" OR casualties OR "armed conflict" OR "ground offensive" OR "war crimes")'

interface NewsAPIArticle {
  source: { id: string | null; name: string }
  author: string | null
  title: string
  description: string | null
  url: string
  urlToImage: string | null
  publishedAt: string  // ISO 8601
  content: string | null
}

interface NewsAPIResponse {
  status: string
  totalResults: number
  articles: NewsAPIArticle[]
}

export async function ingestNewsAPI(): Promise<{ stored: number; skipped: number; errors: number; disabled?: boolean }> {
  const apiKey = process.env['NEWS_API_KEY']
  if (!apiKey) {
    console.log('[NewsAPI] Skipping: NEWS_API_KEY not set. Get free key at https://newsapi.org/register')
    return { stored: 0, skipped: 0, errors: 0, disabled: true }
  }

  const supabase = createServiceClient()
  let stored = 0, skipped = 0, errors = 0

  // NewsAPI free tier: 100 req/day — query last 6h sorted by publishedAt
  const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000)

  try {
    const params = new URLSearchParams({
      q: CONFLICT_KEYWORDS,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '100',
      apiKey,
    })

    const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, {
      headers: { 'User-Agent': 'ConflictOps/1.0 (conflictradar.co)' },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) return { stored: 0, skipped: 0, errors: 1 }

    const data: NewsAPIResponse = await res.json()
    if (data.status !== 'ok') return { stored: 0, skipped: 0, errors: 1 }

    for (const article of data.articles) {
      if (!article.title || article.title === '[Removed]') { skipped++; continue }

      const pubDate = new Date(article.publishedAt)
      if (pubDate < cutoff) { skipped++; continue }

      const cleanUrl = article.url.split('?')[0]!
      const source_id = `newsapi:${article.source.name?.toLowerCase().replace(/[^a-z0-9]/g, '_') ?? 'unknown'}:${Buffer.from(cleanUrl).toString('base64').slice(0, 32)}`

      const description = article.description ?? article.content?.slice(0, 500) ?? article.title
      const fullText = `${article.title} ${description}`
      const evType = detectEventType(fullText)

      const { error } = await supabase.from('events').upsert({
        source: 'newsapi',
        source_id,
        event_type: evType,
        title: article.title.slice(0, 500),
        description: description.slice(0, 2000),
        region: null,
        country_code: null,
        severity: 1,
        status: 'developing',
        occurred_at: pubDate.toISOString(),
        heavy_lane_processed: false,
        provenance_raw: {
          source: article.source.name ?? 'NewsAPI',
          attribution: `${article.source.name} (via NewsAPI)`,
          url: article.url,
        } as Record<string, unknown>,
        raw: { title: article.title, url: article.url, source: article.source } as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (error) skipped++
      else stored++
    }
  } catch (e) {
    console.error('[NewsAPI]', e)
    errors++
  }

  return { stored, skipped, errors }
}
