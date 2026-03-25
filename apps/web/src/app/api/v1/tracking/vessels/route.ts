import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const militaryOnly = url.searchParams.get('military') === 'true'

  const supabase = createServiceClient()
  let query = supabase
    .from('vessel_tracks')
    .select('mmsi,ship_name,ship_type,latitude,longitude,speed,flag,zone_name,last_seen')
    .order('last_seen', { ascending: false })
    .limit(limit)

  if (militaryOnly) query = query.eq('ship_type', 35)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data ?? [] })
}
