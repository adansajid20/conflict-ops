export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

const CONFLICT_KEYWORDS = ['airstrike','missile','bombing','attack','military','troops','conflict','war','ceasefire','sanctions','coup','explosion','insurgent','rebel','militia','drone strike','nuclear','refugee','humanitarian crisis','territorial dispute','naval blockade','cyber attack','assassination','ethnic cleansing','arms deal','mercenary','Wagner','NATO','UN Security Council','martial law','border clash','ceasefire violation','peace talks','embargo','proxy war']

const FOCUS_REGIONS = ['Ukraine','Russia','Gaza','Israel','Iran','Syria','Yemen','Houthi','Sudan','Myanmar','Taiwan','North Korea','Ethiopia','Somalia','Libya','Sahel','Mali','Lebanon','Afghanistan','Kashmir']

function extractRegion(text: string): string {
  const lower = (text ?? '').toLowerCase()
  for (const r of FOCUS_REGIONS) {
    if (lower.includes(r.toLowerCase())) return r
  }
  return 'global'
}

function toSnake(region: string): string {
  return region.toLowerCase().replace(/[\s-]+/g, '_')
}

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  let collected = 0

  // Source 1: NewsData.io
  const newsDataKey = process.env.NEWSDATA_API_KEY
  if (newsDataKey) {
    try {
      const keywords = CONFLICT_KEYWORDS.slice(0, 5).join(' OR ')
      const res = await fetch(`https://newsdata.io/api/1/latest?apikey=${newsDataKey}&q=${encodeURIComponent(keywords)}&language=en&category=politics,world`, { signal: AbortSignal.timeout(15000) })
      if (res.ok) {
        const data = await res.json() as { results?: Array<{ title?: string; description?: string; link?: string; source_id?: string; country?: string[]; pubDate?: string }> }
        for (const a of data.results ?? []) {
          if (!a.title || !a.link) continue
          const region = toSnake(a.country?.[0] ?? extractRegion(a.title))
          await supabase.from('events').upsert({ title: a.title.slice(0, 500), description: (a.description ?? '').slice(0, 2000), source_id: a.link, source: a.source_id ?? new URL(a.link).hostname, severity: 2, region, occurred_at: a.pubDate ? new Date(a.pubDate).toISOString() : new Date().toISOString(), enriched: false }, { onConflict: 'source_id', ignoreDuplicates: true })
          collected++
        }
      }
    } catch (e) { console.warn('NewsData error:', e) }
  }

  // Source 2: GNews
  const gnewsKey = process.env.GNEWS_API_KEY
  if (gnewsKey) {
    try {
      for (const region of FOCUS_REGIONS.slice(0, 4)) {
        const res = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(region + ' conflict OR attack OR military')}&lang=en&max=10&apikey=${gnewsKey}`, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) continue
        const data = await res.json() as { articles?: Array<{ title?: string; description?: string; url?: string; source?: { name?: string }; publishedAt?: string }> }
        for (const a of data.articles ?? []) {
          if (!a.title || !a.url) continue
          await supabase.from('events').upsert({ title: a.title.slice(0, 500), description: (a.description ?? '').slice(0, 2000), source_id: a.url, source: a.source?.name ?? new URL(a.url).hostname, severity: 2, region: toSnake(region), occurred_at: a.publishedAt ? new Date(a.publishedAt).toISOString() : new Date().toISOString(), enriched: false }, { onConflict: 'source_id', ignoreDuplicates: true })
          collected++
        }
        await new Promise(r => setTimeout(r, 250))
      }
    } catch (e) { console.warn('GNews error:', e) }
  }

  // Source 3: MediaStack
  const mediaKey = process.env.MEDIASTACK_API_KEY
  if (mediaKey) {
    try {
      const res = await fetch(`http://api.mediastack.com/v1/news?access_key=${mediaKey}&keywords=conflict,military,attack,sanctions&languages=en&limit=50&sort=published_desc`, { signal: AbortSignal.timeout(15000) })
      if (res.ok) {
        const data = await res.json() as { data?: Array<{ title?: string; description?: string; url?: string; source?: string; country?: string; published_at?: string }> }
        for (const a of data.data ?? []) {
          if (!a.title || !a.url) continue
          const region = toSnake(a.country ?? extractRegion(a.title))
          await supabase.from('events').upsert({ title: a.title.slice(0, 500), description: (a.description ?? '').slice(0, 2000), source_id: a.url, source: a.source ?? 'mediastack', severity: 2, region, occurred_at: a.published_at ? new Date(a.published_at).toISOString() : new Date().toISOString(), enriched: false }, { onConflict: 'source_id', ignoreDuplicates: true })
          collected++
        }
      }
    } catch (e) { console.warn('MediaStack error:', e) }
  }

  if (!newsDataKey && !gnewsKey && !mediaKey) {
    return NextResponse.json({ collected: 0, disabled: true, reason: 'No news API keys configured' })
  }

  return NextResponse.json({ collected })
}
