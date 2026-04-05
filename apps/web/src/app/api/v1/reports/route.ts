export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50)

  let query = supabase.from('reports').select('id, report_type, title, summary, region, is_public, created_at').order('created_at', { ascending: false }).limit(limit)
  if (type) query = query.eq('report_type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}
