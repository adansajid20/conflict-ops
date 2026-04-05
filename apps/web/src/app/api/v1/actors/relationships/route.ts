export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const actorId = url.searchParams.get('actor_id')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '80'), 200)

  let query = supabase.from('actor_relationships').select('actor_id, related_actor_id, relationship_type, strength, description, verified').order('strength', { ascending: false }).limit(limit)
  if (actorId) query = query.or(`actor_id.eq.${actorId},related_actor_id.eq.${actorId}`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ relationships: data ?? [] })
}
