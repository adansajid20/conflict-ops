export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

// Region → commodity correlations
const REGION_COMMODITY_MAP: Record<string, string[]> = {
  middle_east: ['CL=F', 'BZ=F', 'NG=F'],
  eastern_europe: ['ZW=F', 'ZC=F', 'NG=F'],
  russia: ['NG=F', 'CL=F', 'BZ=F'],
  ukraine: ['ZW=F', 'ZC=F'],
  red_sea: ['BZ=F', 'HG=F'],
  africa: ['HG=F', 'GC=F'],
  east_asia: ['HG=F', 'SI=F'],
  global: ['GC=F', 'SI=F'],
}

function getCorrelatedCommodities(region: string): string[] {
  const lower = region.toLowerCase()
  for (const [key, commodities] of Object.entries(REGION_COMMODITY_MAP)) {
    if (lower.includes(key) || key.includes(lower.split('_')[0] ?? '')) return commodities
  }
  return ['GC=F'] // Gold is safe-haven for all crises
}

async function callHaiku(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return ''
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const h6 = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  let detected = 0

  // Get critical/high events from last 6 hours
  const { data: events } = await supabase
    .from('events').select('id,title,region,severity,occurred_at')
    .gte('occurred_at', h6).gte('severity', 3).order('occurred_at', { ascending: false }).limit(20)

  for (const event of events ?? []) {
    const commodities = getCorrelatedCommodities(event.region ?? 'global')

    for (const symbol of commodities) {
      // Get price before and after event
      const eventTime = new Date(event.occurred_at as string)
      const beforeTime = new Date(eventTime.getTime() - 2 * 60 * 60 * 1000).toISOString()
      const afterTime = new Date(eventTime.getTime() + 4 * 60 * 60 * 1000).toISOString()

      const [{ data: before }, { data: after }] = await Promise.all([
        supabase.from('commodity_prices').select('price').eq('symbol', symbol)
          .lte('recorded_at', beforeTime).order('recorded_at', { ascending: false }).limit(1).single(),
        supabase.from('commodity_prices').select('price').eq('symbol', symbol)
          .gte('recorded_at', afterTime).order('recorded_at', { ascending: true }).limit(1).single(),
      ])

      if (!before?.price || !after?.price) continue
      const priceBefore = before.price as number
      const priceAfter = after.price as number
      if (priceBefore === 0) continue
      const changePct = ((priceAfter - priceBefore) / priceBefore) * 100

      // Only flag if price moved >1.5%
      if (Math.abs(changePct) < 1.5) continue

      // Check not already stored
      const { data: existing } = await supabase.from('market_correlations')
        .select('id').eq('event_id', event.id).eq('commodity_symbol', symbol).limit(1).single()
      if (existing) continue

      const timeLagHours = 2 // approximate
      const correlationStrength = Math.min(0.95, Math.abs(changePct) / 10)

      let explanation = ''
      try {
        explanation = await callHaiku(
          `In 2 sentences, explain why a ${event.severity >= 4 ? 'critical' : 'high-severity'} event titled "${event.title}" in ${event.region} would cause ${symbol} price to move ${changePct.toFixed(1)}%.`
        )
      } catch { /* ok */ }

      await supabase.from('market_correlations').insert({
        event_id: event.id,
        commodity_symbol: symbol,
        price_before: priceBefore,
        price_after: priceAfter,
        price_change_pct: changePct,
        time_lag_hours: timeLagHours,
        correlation_strength: correlationStrength,
        ai_explanation: explanation,
      })
      detected++
    }
  }

  return NextResponse.json({ detected })
}
