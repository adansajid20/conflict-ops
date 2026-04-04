export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const region = req.nextUrl.searchParams.get('region')
  const situation_id = req.nextUrl.searchParams.get('situation_id')
  const type = req.nextUrl.searchParams.get('type')

  let query = supabase
    .from('intelligence_reports')
    .select('id,report_type,title,executive_summary,region,situation_id,confidence,generated_at,tier_required')
    .order('generated_at', { ascending: false })
    .limit(20)

  if (region) query = query.eq('region', region)
  if (situation_id) query = query.eq('situation_id', situation_id)
  if (type) query = query.eq('report_type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}
