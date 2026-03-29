import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 15

const SKIP_DOMAINS = ['news.google.com', 'msn.com', 'yahoo.com', 'bing.com', 'flipboard.com', 'feedly.com', 't.co', 'bit.ly', 'tinyurl.com']

const GENERIC_SNIPPETS = [
  'comprehensive up-to-date news coverage',
  'aggregated from sources all over the world by google news',
  'stay updated with the latest news',
  'read full articles from',
  'breaking news and latest headlines',
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
    // Check if we ended up at a different URL
    if (res.url && res.url !== url && !res.url.includes('news.google.com')) {
      return res.url
    }
    // Try to extract canonical URL from page HTML
    const html = await res.text()
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    if (canonical && !canonical.includes('news.google.com')) return canonical
  } catch { /* best effort */ }
  return url
}

/** Extract article body text from HTML — tries article/main tags, then paragraphs */
function extractArticleText(html: string): string | null {
  // 1. Try <article> tag
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch?.[1]) {
    const text = stripHtml(articleMatch[1])
    if (text.length > 100) return text.substring(0, 1200)
  }

  // 2. Try <main> tag
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch?.[1]) {
    const text = stripHtml(mainMatch[1])
    if (text.length > 100) return text.substring(0, 1200)
  }

  // 3. Collect all substantial <p> paragraphs
  const paragraphs: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let match
  while ((match = pRegex.exec(html)) !== null) {
    const text = stripHtml(match[1] ?? '')
    if (text.length > 60) paragraphs.push(text)
  }
  if (paragraphs.length > 0) {
    return paragraphs.join(' ').substring(0, 1200)
  }

  return null
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
    // If still Google News after resolution, skip
    if (targetUrl.includes('news.google.com')) {
      return NextResponse.json({ snippet: null })
    }
  }

  // Skip other known aggregators
  if (SKIP_DOMAINS.some(d => parsedUrl.hostname.includes(d))) {
    return NextResponse.json({ snippet: null })
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return NextResponse.json({ snippet: null })

    const html = await res.text()

    // First try full article body extraction
    const articleText = extractArticleText(html)
    if (articleText && articleText.length > 80 && !isGeneric(articleText)) {
      return NextResponse.json(
        { snippet: articleText.substring(0, 1200) },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      )
    }

    // Fallback: OG description / meta description
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,600})["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']{10,600})["'][^>]+property=["']og:description["']/i)?.[1]
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,600})["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']{10,600})["'][^>]+name=["']description["']/i)?.[1]

    const fallback = ogDesc ?? metaDesc ?? null
    if (fallback && !isGeneric(fallback)) {
      return NextResponse.json(
        { snippet: fallback.substring(0, 600) },
        { headers: { 'Cache-Control': 'public, max-age=3600' } }
      )
    }

    return NextResponse.json({ snippet: null })
  } catch {
    return NextResponse.json({ snippet: null })
  }
}
