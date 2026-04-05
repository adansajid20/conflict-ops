export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const symbols = url.searchParams.get('symbols')?.split(',')

  // Get latest price per symbol
  let query = supabase.from('commodity_prices').select('*').order('recorded_at', { ascending: false })
  if (symbols?.length) query = query.in('symbol', symbols)

  const { data, error } = await query.limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deduplicate — latest per symbol
  const seen = new Set<string>()
  const latest = (data ?? []).filter(d => {
    const sym = d.symbol as string
    if (seen.has(sym)) return false
    seen.add(sym)
    return true
  })

  // Get market correlations for context
  const { data: correlations } = await supabase
    .from('market_correlations')
    .select('commodity_symbol,price_change_pct,correlation_strength,ai_explanation,detected_at')
    .order('detected_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ commodities: latest, correlations: correlations ?? [] })
}
