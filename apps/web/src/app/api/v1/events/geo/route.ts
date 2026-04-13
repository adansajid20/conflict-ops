/**
 * GET /api/v1/events/geo
 * Returns events with location as GeoJSON { type, coordinates }
 * Uses PostGIS ST_AsGeoJSON to convert geography → JSON
 */
export const dynamic = 'force-dynamic'

import { safeAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

export type GeoEvent = {
  id: string
  title: string
  event_type: string | null
  severity: number | null
  country_code: string | null
  region: string | null
  source: string
  occurred_at: string
  ingested_at: string
  description: string | null
  status: string | null
  provenance_raw: Record<string, unknown> | null
  location: { type: 'Point'; coordinates: [number, number] } | null
}

export async function GET() {
  const { userId } = await safeAuth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('get_events_geo', { p_limit: 500 })

  if (error) {
    // Fallback: select without location, centroid fallback handled client-side
    const { data: fallback } = await supabase
      .from('events')
      .select('id,title,event_type,severity,country_code,region,source,occurred_at,ingested_at,description,status,provenance_raw')
      .not('status', 'eq', 'clustered')
      .order('occurred_at', { ascending: false })
      .limit(500)

    return Response.json({
      ok: true,
      data: (fallback ?? []).map(e => ({ ...e, location: null })),
      meta: { geo_rpc_error: error.message },
    })
  }

  return Response.json({ ok: true, data: data as GeoEvent[] })
}
