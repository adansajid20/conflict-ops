import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEMO_VESSELS = [
  { mmsi: 271000111, ship_name: 'CO Shadow', ship_type: 35, latitude: 33.2, longitude: 35.4, speed: 18, flag: 'TR', zone_name: 'Eastern Mediterranean', last_seen: new Date().toISOString() },
  { mmsi: 271000112, ship_name: 'Black Sea Watch', ship_type: 35, latitude: 44.9, longitude: 36.6, speed: 12, flag: 'RO', zone_name: 'Black Sea', last_seen: new Date().toISOString() },
  { mmsi: 271000113, ship_name: 'Levant Trader', ship_type: 70, latitude: 31.6, longitude: 32.3, speed: 14, flag: 'PA', zone_name: 'Suez Approaches', last_seen: new Date().toISOString() },
  { mmsi: 271000114, ship_name: 'Red Sea Meridian', ship_type: 80, latitude: 15.1, longitude: 42.7, speed: 16, flag: 'LR', zone_name: 'Bab el-Mandeb', last_seen: new Date().toISOString() },
  { mmsi: 271000115, ship_name: 'Dnipro Relay', ship_type: 60, latitude: 46.2, longitude: 30.7, speed: 10, flag: 'UA', zone_name: 'Odesa Littoral', last_seen: new Date().toISOString() },
]

export async function GET(req: Request) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const militaryOnly = url.searchParams.get('military') === 'true'

  const supabase = createServiceClient()
  let query = supabase
    .from('maritime_tracks')
    .select('mmsi,ship_name,ship_type,latitude,longitude,speed,flag,zone_name,last_seen')
    .order('last_seen', { ascending: false })
    .limit(limit)

  if (militaryOnly) query = query.eq('ship_type', 35)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).length ? (data ?? []) : DEMO_VESSELS.slice(0, limit)
  return NextResponse.json({ success: true, data: rows, meta: { demo: !(data?.length ?? 0) } })
}
