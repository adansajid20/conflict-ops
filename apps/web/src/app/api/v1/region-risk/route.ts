export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()

  // Get latest score per region
  const { data, error } = await supabase
    .from('region_risk_scores')
    .select('region, risk_score, trend, trend_delta, calculated_at')
    .order('calculated_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Dedupe — keep only latest per region
  const seen = new Set<string>()
  const latest = (data ?? []).filter(row => {
    if (seen.has(row.region)) return false
    seen.add(row.region)
    return true
  })

  return NextResponse.json({ success: true, data: latest })
}
