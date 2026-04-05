export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'
import { detectTrends, updateCountryRiskScores } from '@/lib/intelligence/forecasting'

export const maxDuration = 60

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  const validSecret = process.env['INTERNAL_SECRET'] ?? ''

  if (!token || token !== validSecret) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const lastRun = await getCachedSnapshot<{ ts: string }>('forecast:last_run')
  const lastRunMs = lastRun?.ts ? new Date(lastRun.ts).getTime() : 0
  if (lastRunMs && (Date.now() - lastRunMs) < 23 * 60 * 60 * 1000) {
    return Response.json({ success: true, data: { signals_created: 0, countries_updated: 0, skipped: true } })
  }

  const signalsCreated = await detectTrends()
  const countriesUpdated = await updateCountryRiskScores()
  await setCachedSnapshot('forecast:last_run', { ts: new Date().toISOString() }, 23 * 60 * 60)

  return Response.json({ success: true, data: { signals_created: signalsCreated, countries_updated: countriesUpdated } })
}
