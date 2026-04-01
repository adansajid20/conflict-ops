import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'

type ForecastApiData = {
  forecasts: unknown[]
  signals: unknown[]
  countryRiskScores: unknown[]
}

export async function GET(req: Request): Promise<NextResponse<{ success: boolean; data?: ForecastApiData; error?: string }>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const countryCode = url.searchParams.get('country')
  const horizon = url.searchParams.get('horizon') ?? '30'
  const cacheKey = `forecasts:${countryCode ?? 'all'}:${horizon}:intel`
  const cached = await getCachedSnapshot<ForecastApiData>(cacheKey)
  if (cached) return NextResponse.json({ success: true, data: cached })

  const supabase = createServiceClient()
  let forecastQuery = supabase.from('forecasts').select('*').eq('horizon_days', Number.parseInt(horizon, 10)).order('score', { ascending: false, nullsFirst: false }).limit(50)
  if (countryCode) forecastQuery = forecastQuery.eq('country_code', countryCode)

  const [forecastsResult, signalsResult, countryRiskResult] = await Promise.all([
    forecastQuery,
    supabase.from('forecast_signals').select('*').gte('valid_until', new Date().toISOString()).order('created_at', { ascending: false }).limit(50),
    supabase.from('country_risk_scores').select('*').order('risk_score', { ascending: false }).limit(100),
  ])

  if (forecastsResult.error) return NextResponse.json({ success: false, error: forecastsResult.error.message }, { status: 500 })
  if (signalsResult.error) return NextResponse.json({ success: false, error: signalsResult.error.message }, { status: 500 })
  if (countryRiskResult.error) return NextResponse.json({ success: false, error: countryRiskResult.error.message }, { status: 500 })

  const payload: ForecastApiData = {
    forecasts: forecastsResult.data ?? [],
    signals: signalsResult.data ?? [],
    countryRiskScores: countryRiskResult.data ?? [],
  }
  await setCachedSnapshot(cacheKey, payload, TTL.FORECAST)
  return NextResponse.json({ success: true, data: payload })
}
