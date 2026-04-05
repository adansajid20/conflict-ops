export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const actorId = url.searchParams.get('actor_id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '80'), 200)

  let query = supabase
    .from('actor_relationships')
    .select('id,actor_a,actor_b,actor_id,related_actor_id,relationship,relationship_type,strength,evidence_count,notes')
    .order('strength', { ascending: false })
    .limit(limit)

  if (actorId) {
    query = query.or(`actor_a.eq.${actorId},actor_b.eq.${actorId},actor_id.eq.${actorId},related_actor_id.eq.${actorId}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Normalise columns
  const relationships = (data ?? []).map(r => ({
    ...r,
    actor_id: r.actor_id ?? r.actor_a,
    related_actor_id: r.related_actor_id ?? r.actor_b,
    relationship_type: r.relationship_type ?? r.relationship,
  }))

  return NextResponse.json({ relationships })
}
