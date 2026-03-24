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
  const severity = url.searchParams.get('severity')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  const cacheKey = `events:${countryCode ?? 'all'}:${severity ?? 'all'}:${limit}:${offset}`

  // Safe mode: serve cached snapshot
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

  // Get org for plan check
  const { data: user } = await supabase
    .from('users')
    .select('org_id')
    .eq('clerk_user_id', userId)
    .single()

  let query = supabase
    .from('events')
    .select('id,source,event_type,title,description,region,country_code,location,severity,status,occurred_at,ingested_at,provenance_raw,provenance_inferred')
    .not('status', 'eq', 'clustered')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply history limit based on plan
  if (user?.org_id) {
    const limits = await getOrgPlanLimits(user.org_id)
    if (limits.historyDays !== -1) {
      const cutoff = new Date(Date.now() - limits.historyDays * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('occurred_at', cutoff)
    }
  }

  if (countryCode) query = query.eq('country_code', countryCode)
  if (severity) query = query.eq('severity', parseInt(severity))

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const events = (data ?? []) as unknown as ConflictEvent[]

  // Cache result
  await setCachedSnapshot(cacheKey, events, TTL.FEED)

  return NextResponse.json({ success: true, data: events })
}
