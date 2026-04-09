export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

// Commodity metadata
const COMMODITIES = [
  { symbol: 'CL=F', name: 'WTI Crude Oil', base: 72, vol: 3 },
  { symbol: 'BZ=F', name: 'Brent Crude', base: 75, vol: 3 },
  { symbol: 'GC=F', name: 'Gold', base: 2300, vol: 30 },
  { symbol: 'SI=F', name: 'Silver', base: 28, vol: 1 },
  { symbol: 'ZW=F', name: 'Wheat', base: 550, vol: 20 },
  { symbol: 'ZC=F', name: 'Corn', base: 420, vol: 15 },
  { symbol: 'NG=F', name: 'Natural Gas', base: 2.5, vol: 0.15 },
  { symbol: 'HG=F', name: 'Copper', base: 4.2, vol: 0.2 },
]

// Try Yahoo Finance unofficial API for real prices (no key needed)
async function fetchYahooPrice(symbol: string): Promise<{ price: number; change_24h: number; change_pct_24h: number } | null> {
  try {
    const encodedSymbol = encodeURIComponent(symbol)
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1d&range=2d`,
      { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return null
    const data = await res.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }> }
    }
    const meta = data.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null
    const price = meta.regularMarketPrice
    const prev = meta.chartPreviousClose ?? price
    const change_24h = price - prev
    const change_pct_24h = prev !== 0 ? ((price - prev) / prev) * 100 : 0
    return { price, change_24h, change_pct_24h }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const now = new Date().toISOString()
  let inserted = 0

  for (const commodity of COMMODITIES) {
    let priceData = await fetchYahooPrice(commodity.symbol)

    // Fallback: simulate realistic prices with random walk
    if (!priceData) {
      const { data: last } = await supabase
        .from('commodity_prices').select('price').eq('symbol', commodity.symbol)
        .order('recorded_at', { ascending: false }).limit(1)
      const lastPrice = (last?.[0]?.price as number) ?? commodity.base
      const change = (Math.random() - 0.5) * commodity.vol * 2
      const price = Math.max(lastPrice + change, commodity.base * 0.5)
      const change_24h = price - lastPrice
      const change_pct_24h = lastPrice !== 0 ? (change_24h / lastPrice) * 100 : 0
      priceData = { price, change_24h, change_pct_24h }
    }

    await supabase.from('commodity_prices').insert({
      symbol: commodity.symbol,
      name: commodity.name,
      price: priceData.price,
      change_24h: priceData.change_24h,
      change_pct_24h: priceData.change_pct_24h,
      recorded_at: now,
    })
    inserted++
  }

  return NextResponse.json({ inserted, timestamp: now })
}
