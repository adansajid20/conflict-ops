import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchEconomicIndicators } from '@/lib/ingest/economic'
import type { ApiResponse } from '@conflict-ops/shared'

type EconomicMarketRow = {
  iso2: string
  name: string
  trend: 'up' | 'down' | 'flat' | 'unknown'
  activeSanctionsCount: number
  riskTier: 'Low' | 'Medium' | 'High'
  latestGdp: number | null
}

export async function GET(): Promise<NextResponse<ApiResponse<EconomicMarketRow[]>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const indicators = await fetchEconomicIndicators()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('events')
    .select('country_code')
    .eq('event_type', 'sanctions')
    .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const sanctionCounts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ country_code: string | null }>) {
    if (!row.country_code) continue
    sanctionCounts.set(row.country_code, (sanctionCounts.get(row.country_code) ?? 0) + 1)
  }

  const result: EconomicMarketRow[] = indicators.map((item) => {
    const activeSanctionsCount = sanctionCounts.get(item.iso2) ?? 0
    const riskTier: EconomicMarketRow['riskTier'] = activeSanctionsCount >= 3 || item.trend === 'down'
      ? 'High'
      : activeSanctionsCount >= 1 || item.trend === 'flat'
        ? 'Medium'
        : 'Low'

    return {
      iso2: item.iso2,
      name: item.name,
      trend: item.trend,
      activeSanctionsCount,
      riskTier,
      latestGdp: item.latestGdp,
    }
  })

  return NextResponse.json({ success: true, data: result })
}
