import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 10

/**
 * Server-side article preview fetcher.
 * Fetches OG tags / meta description from a URL and returns a short snippet.
 * Never exposes raw HTML to client; returns only extracted text.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ snippet: null }, { status: 400 })

  // Basic URL validation
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('bad protocol')
  } catch {
    return NextResponse.json({ snippet: null }, { status: 400 })
  }

  // Skip known aggregators — they never return useful OG descriptions
  const SKIP_DOMAINS = ['news.google.com', 'msn.com', 'yahoo.com', 'bing.com', 'flipboard.com', 'feedly.com']
  if (SKIP_DOMAINS.some(d => parsedUrl.hostname.includes(d))) {
    return NextResponse.json({ snippet: null })
  }

  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ConflictOps/1.0; +https://conflictradar.co)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(7000),
    })

    if (!res.ok) return NextResponse.json({ snippet: null })

    const html = await res.text()

    // Extract OG description first
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{10,600})["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']{10,600})["'][^>]+property=["']og:description["']/i)?.[1]

    // Fallback: meta description
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,600})["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']{10,600})["'][^>]+name=["']description["']/i)?.[1]

    // Fallback: first substantial paragraph text (strip tags)
    let paraText: string | null = null
    if (!ogDesc && !metaDesc) {
      const paraMatch = html.match(/<p[^>]*>([\s\S]{60,800}?)<\/p>/i)
      if (paraMatch) {
        paraText = (paraMatch[1] ?? '')
          .replace(/<[^>]+>/g, '') // strip inner tags
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 400)
      }
    }

    // Filter out generic/useless aggregator descriptions
    const GENERIC_DESCRIPTIONS = [
      'comprehensive up-to-date news coverage',
      'aggregated from sources all over the world by google news',
      'google news',
      'read full articles',
      'stay updated with the latest news',
      'breaking news',
      'latest news, breaking news',
      'msn news',
      'yahoo news',
      'find latest news',
    ]
    const isGeneric = (text: string) =>
      GENERIC_DESCRIPTIONS.some(g => text.toLowerCase().includes(g))

    const rawSnippet = ogDesc ?? metaDesc ?? paraText ?? null
    const snippet = rawSnippet && !isGeneric(rawSnippet) ? rawSnippet : null

    return NextResponse.json({
      snippet: snippet ? snippet.substring(0, 400) : null,
    }, {
      headers: { 'Cache-Control': 'public, max-age=3600' }, // cache 1h
    })
  } catch {
    return NextResponse.json({ snippet: null })
  }
}
