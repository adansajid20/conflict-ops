import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { isSafeMode, getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'
import type { ApiResponse, ConflictEvent } from '@conflict-ops/shared'

export async function GET(req: Request): Promise<NextResponse<ApiResponse<ConflictEvent[]>>> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const countryCode = url.searchParams.get('country')
  const source = url.searchParams.get('source')
  const severity = url.searchParams.get('severity')
  const search = url.searchParams.get('search')
  const window = url.searchParams.get('window')
  const since = url.searchParams.get('since')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  let sinceParam = since
  if (!sinceParam && window) {
    const msMap: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
    const ms = msMap[window] ?? 86400000
    sinceParam = new Date(Date.now() - ms).toISOString()
  }

  const cacheKey = `events:${countryCode ?? 'all'}:${source ?? 'all'}:${severity ?? 'all'}:${search ?? ''}:${limit}:${offset}`

  const safe = await isSafeMode()
  if (safe) {
    const cached = await getCachedSnapshot<ConflictEvent[]>(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        meta: { safe_mode: true, cached: true },
      })
    }
  }

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('org_id')
    .eq('clerk_user_id', userId)
    .single()

  let query = supabase
    .from('events')
    .select('id,source,event_type,title,description,region,country_code,severity,status,occurred_at,ingested_at,provenance_raw,provenance_inferred')
    .not('status', 'eq', 'clustered')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const historyDays = user?.org_id
    ? (await getOrgPlanLimits(user.org_id)).historyDays
    : 30
  if (historyDays !== -1) {
    const cutoff = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('occurred_at', cutoff)
  }

  const severityMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const severityInt = severity ? (parseInt(severity) || severityMap[severity.toLowerCase()] || null) : null

  if (countryCode) query = query.eq('country_code', countryCode)
  if (severityInt) query = query.eq('severity', severityInt)
  if (source) query = query.eq('source', source)
  if (search) query = query.ilike('title', `%${search}%`)
  if (sinceParam) query = query.gte('occurred_at', sinceParam)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const events = (data ?? []) as unknown as ConflictEvent[]

  await setCachedSnapshot(cacheKey, events, TTL.FEED)

  return NextResponse.json({ success: true, data: events })
}
