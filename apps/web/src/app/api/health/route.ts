export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const FRESHNESS_MS = 30 * 60 * 1000 // 30 minutes = "live"

async function checkTable(
  supabase: ReturnType<typeof createServiceClient>,
  table: string,
  timeCol: string
): Promise<{ ok: boolean; age_minutes: number | null }> {
  try {
    const { data } = await supabase
      .from(table)
      .select(timeCol)
      .order(timeCol, { ascending: false })
      .limit(1)
      .single()
    if (!data) return { ok: false, age_minutes: null }
    const val = (data as unknown as Record<string, unknown>)[timeCol]
    if (!val) return { ok: false, age_minutes: null }
    const ageMs = Date.now() - new Date(String(val)).getTime()
    return { ok: ageMs < FRESHNESS_MS, age_minutes: Math.round(ageMs / 60000) }
  } catch {
    return { ok: false, age_minutes: null }
  }
}

export async function GET() {
  const supabase = createServiceClient()

  // ── Source freshness checks ────────────────────────────────────────────────
  const [newsCheck, seismicCheck, firesCheck, flightsCheck, vesselsCheck] = await Promise.all([
    checkTable(supabase, 'events', 'occurred_at'),
    checkTable(supabase, 'seismic_events', 'occurred_at'),
    checkTable(supabase, 'fire_detections', 'created_at'),
    checkTable(supabase, 'flight_tracks', 'last_seen'),
    checkTable(supabase, 'vessel_tracks', 'last_seen'),
  ])

  const sourceDetail = [
    { name: 'News/Events', ok: newsCheck.ok, age_minutes: newsCheck.age_minutes },
    { name: 'Seismic', ok: seismicCheck.ok, age_minutes: seismicCheck.age_minutes },
    { name: 'Fire Detections', ok: firesCheck.ok, age_minutes: firesCheck.age_minutes },
    { name: 'Flights', ok: flightsCheck.ok, age_minutes: flightsCheck.age_minutes },
    { name: 'Vessels', ok: vesselsCheck.ok, age_minutes: vesselsCheck.age_minutes },
  ]

  const liveCount = sourceDetail.filter(s => s.ok).length

  // ── Event stats ────────────────────────────────────────────────────────────
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  // ── Last ingest (most recent event) ───────────────────────────────────────
  const { data: latestEvent } = await supabase
    .from('events')
    .select('occurred_at')
    .order('occurred_at', { ascending: false })
    .limit(1)
    .single()

  const lastSuccessAt = latestEvent?.occurred_at ?? null
  const ingestAgeMin = lastSuccessAt
    ? Math.round((Date.now() - new Date(lastSuccessAt).getTime()) / 60000)
    : null

  const healthy = liveCount > 0 && (ingestAgeMin === null || ingestAgeMin < 60)

  return NextResponse.json({
    healthy,
    // Shape expected by layout.tsx SidebarStatus
    sources: {
      live: liveCount,
      enabled: sourceDetail.length,
      detail: sourceDetail,
    },
    ingest: {
      last_success_at: lastSuccessAt,
      age_minutes: ingestAgeMin,
    },
    events: {
      total: totalEvents ?? 0,
    },
    // Legacy fallback shape (SidebarStatus.tsx in components/)
    enabledSources: sourceDetail,
    lastIngestAt: lastSuccessAt,
    eventCount: totalEvents ?? 0,
    safe_mode: false,
    timestamp: new Date().toISOString(),
  }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
