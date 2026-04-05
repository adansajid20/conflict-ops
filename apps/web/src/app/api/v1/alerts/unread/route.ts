export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const userId = new URL(req.url).searchParams.get('user_id')
  if (!userId) return NextResponse.json({ count: 0 })
  const { count } = await supabase.from('alert_history').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false)
  return NextResponse.json({ count: count ?? 0 })
}
