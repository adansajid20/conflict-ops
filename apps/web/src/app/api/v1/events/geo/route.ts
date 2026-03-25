/**
 * GET /api/v1/events/geo
 * Returns events with location as GeoJSON { type, coordinates }
 * Uses PostGIS ST_AsGeoJSON to convert geography → JSON
 */
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'

type GeoEvent = {
  id: string
  title: string
  event_type: string
  severity: number | null
  country_code: string | null
  region: string | null
  source: string
  occurred_at: string
  location: { type: 'Point'; coordinates: [number, number] } | null
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Use RPC to get events with proper GeoJSON coordinates
  // raw SQL via Supabase's postgres REST API
  const { data, error } = await supabase.rpc('get_events_geo', { p_limit: 500 })

  if (error) {
    // Fallback: try selecting without location
    const { data: fallback } = await supabase
      .from('events')
      .select('id,title,event_type,severity,country_code,region,source,occurred_at')
      .not('status', 'eq', 'clustered')
      .order('occurred_at', { ascending: false })
      .limit(500)

    return Response.json({
      success: true,
      data: (fallback ?? []).map(e => ({ ...e, location: null })),
      meta: { geo_rpc_error: error.message },
    })
  }

  return Response.json({ success: true, data: data as GeoEvent[] })
}
