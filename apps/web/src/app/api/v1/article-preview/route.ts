import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

const SKIP_DOMAINS = ['news.google.com', 'msn.com', 'yahoo.com', 'bing.com', 'flipboard.com', 'feedly.com', 't.co', 'bit.ly', 'tinyurl.com']

const GENERIC_SNIPPETS = [
  'comprehensive up-to-date news coverage',
  'aggregated from sources all over the world by google news',
  'stay updated with the latest news',
  'read full articles from',
]

function isGeneric(text: string): boolean {
  const lower = text.toLowerCase()
  return GENERIC_SNIPPETS.some(g => lower.includes(g))
}

/** Strip HTML tags and decode basic entities */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Try to follow Google News redirect to real article URL */
async function resolveGoogleNewsUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConflictOps/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    })
    if (res.url && res.url !== url && !res.url.includes('news.google.com')) return res.url
    const html = await res.text()
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    if (canonical && !canonical.includes('news.google.com')) return canonical
  } catch { /* best effort */ }
  return url
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ snippet: null }, { status: 400 })

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol')
  } catch {
    return NextResponse.json({ snippet: null }, { status: 400 })
  }

  // For Google News, try to resolve to the real article URL first
  let targetUrl = url
  if (parsedUrl.hostname.includes('news.google.com')) {
    targetUrl = await resolveGoogleNewsUrl(url)
    if (targetUrl.includes('news.google.com')) {
      return NextResponse.json({ snippet: null })
    }
  }

  // Skip known aggregators that never have real article content
  if (SKIP_DOMAINS.some(d => parsedUrl.hostname.includes(d))) {
    return NextResponse.json({ snippet: null })
  }

  // --- Strategy 1: Jina Reader API (handles JS-rendered sites, paywalls, bot protection) ---
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(targetUrl)}`, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'text',
        'X-Timeout': '8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (jinaRes.ok) {
      const text = await jinaRes.text()
      // Jina returns markdown/plain text — take first 1200 meaningful chars
      const cleaned = text
        .replace(/\[.*?\]\(.*?\)/g, '') // remove markdown links
        .replace(/#{1,6}\s/g, '')        // remove markdown headers
        .replace(/\*{1,2}(.*?)\*{1,2}/g, '$1') // remove bold/italic
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      if (cleaned.length > 100 && !isGeneric(cleaned)) {
        return NextResponse.json(
          { snippet: cleaned.substring(0, 1200) },
          { headers: { 'Cache-Control': 'public, max-age=3600' } }
        )
      }
    }
  } catch { /* fall through to direct fetch */ }

  // --- Strategy 2: Direct fetch with browser UA ---
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return NextResponse.json({ snippet: null })

    const html = await res.text()

    // Try <article> tag first
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    if (articleMatch?.[1]) {
      const text = stripHtml(articleMatch[1])
      if (text.length > 100 && !isGeneric(text)) {
        return NextResponse.json(
          { snippet: text.substring(0, 1200) },
          { headers: { 'Cache-Control': 'public, max-age=3600' } }
        )
      }
    }

    // OG/meta description fallback
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,600})["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']{10,600})["'][^>]+property=["']og:description["']/i)?.[1]
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,600})["']/i)?.[1]

    const fallback = ogDesc ?? metaDesc ?? null
    if (fallback && !isGeneric(fallback)) {
      return NextResponse.json(
        { snippet: fallback.substring(0, 600) },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      )
    }
  } catch { /* best effort */ }

  return NextResponse.json({ snippet: null })
}
