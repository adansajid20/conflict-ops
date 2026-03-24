import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isSafeMode, getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'
import type { ApiResponse, DashboardStats } from '@conflict-ops/shared'

export async function GET(): Promise<NextResponse<ApiResponse<DashboardStats>>> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const cacheKey = `dashboard:${userId}`

  // Safe mode: serve snapshot
  const safe = await isSafeMode()
  if (safe) {
    const cached = await getCachedSnapshot<DashboardStats>(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        meta: { safe_mode: true, snapshot_age: 'unknown' },
      })
    }
  }

  const supabase = createServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [eventsResult, alertsResult, missionsResult, sourcesResult] = await Promise.allSettled([
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', today.toISOString()),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('read', false),
    supabase.from('missions').select('id', { count: 'exact', head: true }),
    supabase.from('circuit_breakers').select('id', { count: 'exact', head: true }).eq('status', 'closed'),
  ])

  const stats: DashboardStats = {
    eventsToday: eventsResult.status === 'fulfilled' ? (eventsResult.value.count ?? 0) : 0,
    activeAlerts: alertsResult.status === 'fulfilled' ? (alertsResult.value.count ?? 0) : 0,
    openMissions: missionsResult.status === 'fulfilled' ? (missionsResult.value.count ?? 0) : 0,
    sourcesOnline: sourcesResult.status === 'fulfilled' ? (sourcesResult.value.count ?? 0) : 0,
    lastUpdated: new Date().toISOString(),
  }

  await setCachedSnapshot(cacheKey, stats, TTL.DASHBOARD)

  return NextResponse.json({ success: true, data: stats })
}
