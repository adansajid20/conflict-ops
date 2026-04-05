export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

function domainFrom(src: string): string {
  try { return new URL(src.startsWith('http') ? src : `https://${src}`).hostname.replace('www.', '') }
  catch { return src.slice(0, 60) }
}

const KNOWN_CREDIBILITY: Record<string, { score: number; bias: string; name: string }> = {
  'reuters.com':       { score: 0.95, bias: 'wire_service',  name: 'Reuters' },
  'apnews.com':        { score: 0.95, bias: 'wire_service',  name: 'AP News' },
  'bbc.co.uk':         { score: 0.88, bias: 'independent',   name: 'BBC News' },
  'bbc.com':           { score: 0.88, bias: 'independent',   name: 'BBC News' },
  'aljazeera.com':     { score: 0.80, bias: 'independent',   name: 'Al Jazeera' },
  'theguardian.com':   { score: 0.82, bias: 'independent',   name: 'The Guardian' },
  'nytimes.com':       { score: 0.85, bias: 'independent',   name: 'New York Times' },
  'wsj.com':           { score: 0.85, bias: 'independent',   name: 'Wall Street Journal' },
  'ft.com':            { score: 0.88, bias: 'independent',   name: 'Financial Times' },
  'acleddata.com':     { score: 0.98, bias: 'independent',   name: 'ACLED' },
  'understandingwar.org': { score: 0.90, bias: 'independent', name: 'ISW' },
  'conflictmonitor.org': { score: 0.90, bias: 'independent', name: 'Ukraine Conflict Monitor' },
  'gdelt':             { score: 0.70, bias: 'aggregator',    name: 'GDELT' },
  'rt.com':            { score: 0.35, bias: 'state_media',   name: 'RT (Russia)' },
  'tass.ru':           { score: 0.40, bias: 'state_media',   name: 'TASS' },
  'xinhuanet.com':     { score: 0.40, bias: 'state_media',   name: 'Xinhua' },
  'presstv.ir':        { score: 0.35, bias: 'state_media',   name: 'Press TV (Iran)' },
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()

  // Aggregate source stats from events
  const { data: events } = await supabase.from('events').select('source, source_id').not('source', 'is', null).limit(5000)

  const sourceMap = new Map<string, { total: number; urls: Set<string> }>()
  for (const e of events ?? []) {
    const domain = domainFrom(e.source as string ?? '')
    if (!sourceMap.has(domain)) sourceMap.set(domain, { total: 0, urls: new Set() })
    sourceMap.get(domain)!.total++
    if (e.source_id) sourceMap.get(domain)!.urls.add(e.source_id as string)
  }

  let updated = 0
  for (const [domain, stats] of sourceMap) {
    const known = KNOWN_CREDIBILITY[domain]
    const score = known?.score ?? Math.max(0.3, Math.min(0.85, 0.5 + Math.log10(stats.total + 1) * 0.1))

    await supabase.from('source_credibility').upsert({
      source_domain: domain,
      display_name: known?.name ?? domain,
      credibility_score: score,
      total_events: stats.total,
      bias_indicator: known?.bias ?? 'aggregator',
      last_evaluated: new Date().toISOString(),
    }, { onConflict: 'source_domain' })
    updated++
  }

  // Update credibility scores on events (backfill)
  for (const [domain, data] of Object.entries(KNOWN_CREDIBILITY)) {
    await supabase.from('events').update({ source_credibility_score: data.score }).ilike('source', `%${domain}%`)
  }

  return NextResponse.json({ updated })
}
