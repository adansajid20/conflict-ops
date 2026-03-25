import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('flight_tracks')
    .select('icao24,callsign,origin_country,latitude,longitude,altitude,is_military,is_isr,squawk,last_seen')
    .order('last_seen', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data ?? [] })
}
