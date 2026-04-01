import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'
import { isSafeMode } from '@/lib/doctor/safe-mode-check'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse, DashboardStats } from '@conflict-ops/shared'

function safeModeHeaders(): HeadersInit {
  return { 'X-Safe-Mode': 'true' }
}

export async function GET(): Promise<NextResponse<ApiResponse<DashboardStats | { safe_mode: true; data: [] }>>> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const cacheKey = `cache:dashboard:${userId}`

  if (await isSafeMode()) {
    const cached = await getCachedSnapshot<DashboardStats>(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached, meta: { safe_mode: true, cached: true } }, { headers: safeModeHeaders() })
    }
    return NextResponse.json({ success: true, data: { safe_mode: true, data: [] }, meta: { safe_mode: true, cached: false } }, { headers: safeModeHeaders() })
  }

  const supabase = createServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const h3 = new Date(Date.now() - 3 * 3600000).toISOString()
  const [eventsResult, alertsResult, missionsResult, sourcesResult] = await Promise.allSettled([
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', today.toISOString()),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('read', false),
    supabase.from('missions').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('source').gte('ingested_at', h3),
  ])

  const distinctSources = sourcesResult.status === 'fulfilled'
    ? new Set((sourcesResult.value.data ?? []).map((row: { source: string | null }) => row.source).filter(Boolean)).size
    : 0

  const stats: DashboardStats = {
    eventsToday: eventsResult.status === 'fulfilled' ? (eventsResult.value.count ?? 0) : 0,
    activeAlerts: alertsResult.status === 'fulfilled' ? (alertsResult.value.count ?? 0) : 0,
    openMissions: missionsResult.status === 'fulfilled' ? (missionsResult.value.count ?? 0) : 0,
    sourcesOnline: distinctSources,
    lastUpdated: new Date().toISOString(),
  }

  await setCachedSnapshot(cacheKey, stats, TTL.DASHBOARD)

  return NextResponse.json({ success: true, data: stats })
}
