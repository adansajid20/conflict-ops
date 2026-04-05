export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const region = url.searchParams.get('region')
  const type = url.searchParams.get('type')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50)

  let query = supabase
    .from('predictions')
    .select('id, prediction_type, title, description, region, probability, time_horizon_hours, severity_if_true, evidence, outcome, created_at, expires_at')
    .is('outcome', null)
    .gt('expires_at', new Date().toISOString())
    .order('probability', { ascending: false })
    .limit(limit)

  if (region) query = query.ilike('region', `%${region}%`)
  if (type) query = query.eq('prediction_type', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also get recent confirmed predictions for accuracy metrics
  const { data: confirmed } = await supabase
    .from('predictions')
    .select('id, outcome, prediction_type')
    .not('outcome', 'is', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  const total = confirmed?.length ?? 0
  const confirmedCount = confirmed?.filter(p => p.outcome === 'confirmed').length ?? 0
  const accuracy = total > 0 ? Math.round((confirmedCount / total) * 100) : null

  return NextResponse.json({
    predictions: data ?? [],
    meta: {
      total: data?.length ?? 0,
      accuracy_30d: accuracy,
      confirmed_30d: confirmedCount,
      total_evaluated_30d: total,
    },
  })
}
