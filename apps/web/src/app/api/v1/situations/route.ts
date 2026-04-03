export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('situations')
    .select('*')
    .in('status', ['active', 'monitoring'])
    .order('risk_score', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data ?? [] })
}
