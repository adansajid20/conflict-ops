import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'

export async function GET() {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cacheKey = 'tracking:stats'
  const cached = await getCachedSnapshot(cacheKey)
  if (cached) return NextResponse.json({ success: true, data: cached })

  const supabase = createServiceClient()
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [vessels, flights, thermal, dark, emergency] = await Promise.allSettled([
    supabase.from('maritime_tracks').select('mmsi', { count: 'exact', head: true }).gte('last_seen', sixHoursAgo),
    supabase.from('flight_tracks').select('icao24', { count: 'exact', head: true }).gte('last_seen', sixHoursAgo),
    supabase.from('events').select('id', { count: 'exact', head: true }).in('event_type', ['thermal_anomaly', 'thermal_anomaly_high']).gte('occurred_at', oneDayAgo),
    supabase.from('maritime_tracks').select('mmsi', { count: 'exact', head: true }).lt('last_seen', sixHoursAgo),
    supabase.from('flight_tracks').select('icao24', { count: 'exact', head: true }).in('squawk', ['7700','7600','7500']).gte('last_seen', sixHoursAgo),
  ])

  const stats = {
    vessels: vessels.status === 'fulfilled' ? (vessels.value.count ?? 0) : 0,
    flights: flights.status === 'fulfilled' ? (flights.value.count ?? 0) : 0,
    thermal_anomalies: thermal.status === 'fulfilled' ? (thermal.value.count ?? 0) : 0,
    dark_vessels: dark.status === 'fulfilled' ? (dark.value.count ?? 0) : 0,
    emergency_squawks: emergency.status === 'fulfilled' ? (emergency.value.count ?? 0) : 0,
    last_updated: new Date().toISOString(),
  }

  await setCachedSnapshot(cacheKey, stats, TTL.DASHBOARD)
  return NextResponse.json({ success: true, data: stats })
}
