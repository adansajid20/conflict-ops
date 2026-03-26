import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEMO_FLIGHTS = [
  { icao24: '43c001', callsign: 'RCH221', origin_country: 'United States', latitude: 31.9, longitude: 35.0, altitude: 9200, is_military: true, is_isr: false, squawk: '0000', last_seen: new Date().toISOString() },
  { icao24: '43c002', callsign: 'FORTE10', origin_country: 'Italy', latitude: 44.5, longitude: 33.8, altitude: 12800, is_military: true, is_isr: true, squawk: '0000', last_seen: new Date().toISOString() },
  { icao24: '43c003', callsign: 'UAE204', origin_country: 'United Arab Emirates', latitude: 25.2, longitude: 55.4, altitude: 10600, is_military: false, is_isr: false, squawk: '2301', last_seen: new Date().toISOString() },
  { icao24: '43c004', callsign: 'NATO41', origin_country: 'Germany', latitude: 47.5, longitude: 37.1, altitude: 11400, is_military: true, is_isr: false, squawk: '4451', last_seen: new Date().toISOString() },
  { icao24: '43c005', callsign: 'MEDEVAC7', origin_country: 'Jordan', latitude: 32.1, longitude: 36.0, altitude: 6400, is_military: false, is_isr: false, squawk: '7700', last_seen: new Date().toISOString() },
]

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

  const rows = (data ?? []).length ? (data ?? []) : DEMO_FLIGHTS.slice(0, limit)
  return NextResponse.json({ success: true, data: rows, meta: { demo: !(data?.length ?? 0) } })
}
