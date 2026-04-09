export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

const INTERACTION_WEIGHTS: Record<string, number> = {
  alert_create: 5, report_generate: 4, pin_to_board: 3, share: 3,
  dwell: 2, search: 2, click: 1, view: 0.5,
}

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const h7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: interactions } = await supabase.from('user_interactions').select('region, category, user_id, interaction_type').gt('created_at', h7d)

  const regionScores = new Map<string, { score: number; users: Set<string>; count: number }>()
  const categoryScores = new Map<string, { score: number; users: Set<string> }>()

  for (const i of interactions ?? []) {
    const w = INTERACTION_WEIGHTS[i.interaction_type] ?? 1
    if (i.region) {
      if (!regionScores.has(i.region)) regionScores.set(i.region, { score: 0, users: new Set(), count: 0 })
      const r = regionScores.get(i.region)!
      r.users.add(i.user_id); r.score += w; r.count++
    }
    if (i.category) {
      if (!categoryScores.has(i.category)) categoryScores.set(i.category, { score: 0, users: new Set() })
      const c = categoryScores.get(i.category)!
      c.users.add(i.user_id); c.score += w
    }
  }

  let scored = 0
  for (const [region, data] of regionScores) {
    await supabase.from('intelligence_value_scores').upsert({ dimension_type: 'region', dimension_value: region, value_score: data.score, interaction_count: data.count, unique_users: data.users.size, trending: data.score > 50, calculated_at: new Date().toISOString() }, { onConflict: 'dimension_type,dimension_value' })
    scored++
  }
  for (const [cat, data] of categoryScores) {
    await supabase.from('intelligence_value_scores').upsert({ dimension_type: 'category', dimension_value: cat, value_score: data.score, interaction_count: data.score, unique_users: data.users.size, trending: data.score > 30, calculated_at: new Date().toISOString() }, { onConflict: 'dimension_type,dimension_value' })
    scored++
  }

  return NextResponse.json({ scored })
}
