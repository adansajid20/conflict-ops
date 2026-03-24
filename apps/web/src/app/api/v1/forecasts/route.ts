import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'
import type { ApiResponse, Forecast } from '@conflict-ops/shared'

export async function GET(req: Request): Promise<NextResponse<ApiResponse<Forecast[]>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const countryCode = url.searchParams.get('country')
  const horizon = url.searchParams.get('horizon') ?? '30'

  const cacheKey = `forecasts:${countryCode ?? 'all'}:${horizon}`
  const cached = await getCachedSnapshot<Forecast[]>(cacheKey)
  if (cached) {
    return NextResponse.json({ success: true, data: cached, meta: { cached: true } })
  }

  const supabase = createServiceClient()
  let query = supabase
    .from('forecasts')
    .select('*')
    .eq('horizon_days', parseInt(horizon))
    .order('score', { ascending: false, nullsFirst: false })
    .limit(50)

  if (countryCode) query = query.eq('country_code', countryCode)

  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const forecasts = (data ?? []) as unknown as Forecast[]
  await setCachedSnapshot(cacheKey, forecasts, TTL.FORECAST)

  return NextResponse.json({ success: true, data: forecasts })
}
