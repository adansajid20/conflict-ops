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

// Only count sources that are actually configured/expected to have data
function isConfigured(envKey: string | null): boolean {
  if (!envKey) return true // no key needed = always enabled
  return !!(process.env[envKey])
}

export async function GET() {
  const supabase = createServiceClient()

  const SOURCE_DEFS = [
    { name: 'News/Events', table: 'events', timeCol: 'occurred_at', envKey: null },
    { name: 'Seismic',     table: 'seismic_events', timeCol: 'occurred_at', envKey: null },       // USGS — free
    { name: 'Fires',       table: 'fire_detections', timeCol: 'created_at', envKey: 'NASA_FIRMS_API_KEY' },
    { name: 'Flights',     table: 'flight_tracks',   timeCol: 'last_seen',  envKey: 'OPENSKY_USERNAME' },
    { name: 'Vessels',     table: 'vessel_tracks',   timeCol: 'last_seen',  envKey: 'AISHUB_USERNAME' },
  ]

  // Only check sources that are configured
  const activeSources = SOURCE_DEFS.filter(s => isConfigured(s.envKey))

  const checks = await Promise.all(
    activeSources.map(async s => {
      const result = await checkTable(supabase, s.table, s.timeCol)
      return { name: s.name, ...result, configured: true }
    })
  )

  const liveCount = checks.filter(s => s.ok).length
  const totalCount = activeSources.length

  // Last ingest: check system_status first, fall back to last event
  let lastSuccessAt: string | null = null
  try {
    const { data: ss } = await supabase
      .from('system_status')
      .select('last_ingest_at')
      .eq('id', 'singleton')
      .single()
    lastSuccessAt = (ss as { last_ingest_at: string | null } | null)?.last_ingest_at ?? null
  } catch { /* table may not exist yet */ }

  if (!lastSuccessAt) {
    const { data: latestEvent } = await supabase
      .from('events')
      .select('occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .single()
    lastSuccessAt = (latestEvent as { occurred_at: string | null } | null)?.occurred_at ?? null
  }

  const ingestAgeMin = lastSuccessAt
    ? Math.round((Date.now() - new Date(lastSuccessAt).getTime()) / 60000)
    : null

  // Event count
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })

  const healthy = liveCount > 0 && (ingestAgeMin === null || ingestAgeMin < 60)

  return NextResponse.json({
    healthy,
    sources: {
      live: liveCount,
      enabled: totalCount,
      detail: checks,
    },
    ingest: {
      last_success_at: lastSuccessAt,
      age_minutes: ingestAgeMin,
    },
    events: { total: totalEvents ?? 0 },
    // Legacy shape
    enabledSources: checks,
    lastIngestAt: lastSuccessAt,
    eventCount: totalEvents ?? 0,
    safe_mode: false,
    timestamp: new Date().toISOString(),
  }, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
