export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const search = url.searchParams.get('q')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)

  let query = supabase
    .from('actors')
    .select('id, name, display_name, actor_type, type, region, country_code, threat_level, event_count, influence_score, description, aliases, last_seen, tags')
    .order('event_count', { ascending: false })
    .limit(limit)

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalise: actor_type falls back to type
  const actors = (data ?? []).map(a => ({
    ...a,
    actor_type: a.actor_type ?? a.type ?? 'organization',
  }))

  return NextResponse.json({ actors, success: true, data: actors })
}
