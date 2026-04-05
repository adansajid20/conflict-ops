export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const search = url.searchParams.get('q')
  const advisory = url.searchParams.get('advisory')
  const minRisk = parseFloat(url.searchParams.get('min_risk') ?? '0')

  let query = supabase.from('country_profiles').select('*').order('risk_score', { ascending: false })
  if (search) query = query.ilike('country_name', `%${search}%`)
  if (advisory) query = query.eq('travel_advisory', advisory)
  if (minRisk > 0) query = query.gte('risk_score', minRisk)

  const { data, error } = await query.limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ countries: data ?? [] })
}
