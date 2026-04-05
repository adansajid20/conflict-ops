export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()

  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d7  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()

  const [r1, r2, r3, r4] = await Promise.all([
    supabase.from('correlation_signals').delete().lt('detected_at', d7),
    supabase.from('fire_detections').delete().lt('created_at', d7),
    supabase.from('seismic_events').delete().lt('event_time', d30),
    supabase.from('internet_outages').delete().lt('start_time', d30),
  ])

  return NextResponse.json({
    correlation_signals_deleted: r1.error ? 0 : 'ok',
    fire_detections_deleted: r2.error ? 0 : 'ok',
    seismic_events_deleted: r3.error ? 0 : 'ok',
    outages_deleted: r4.error ? 0 : 'ok',
  })
}
