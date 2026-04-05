export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const search = url.searchParams.get('q')
  const list = url.searchParams.get('list')
  const country = url.searchParams.get('country')
  const confirmed = url.searchParams.get('confirmed')

  if (search && search.length >= 2) {
    // Search mode: fuzzy search entities
    const { data, error } = await supabase.from('sanctions_entities').select('*')
      .ilike('entity_name', `%${search}%`).limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entities: data ?? [], mode: 'search' })
  }

  // Matches mode: return confirmed/pending matches
  let matchQuery = supabase.from('sanctions_matches')
    .select(`*, sanctions_entity:sanctions_entities(entity_name,entity_type,list_source,program,country)`)
    .order('detected_at', { ascending: false })
  if (confirmed === 'true') matchQuery = matchQuery.eq('is_confirmed', true)
  if (list) matchQuery = matchQuery.eq('sanctions_entities.list_source', list)
  const { data: matches, error: mErr } = await matchQuery.limit(50)
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  // Stats
  const { count: totalEntities } = await supabase.from('sanctions_entities').select('id', { count: 'exact', head: true })
  const { count: totalMatches } = await supabase.from('sanctions_matches').select('id', { count: 'exact', head: true })
  const { count: confirmed_count } = await supabase.from('sanctions_matches').select('id', { count: 'exact', head: true }).eq('is_confirmed', true)

  return NextResponse.json({
    matches: matches ?? [],
    stats: { total_entities: totalEntities ?? 0, total_matches: totalMatches ?? 0, confirmed: confirmed_count ?? 0 },
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { id?: string; is_confirmed?: boolean; reviewed?: boolean }
  const { id, is_confirmed, reviewed } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (is_confirmed !== undefined) patch.is_confirmed = is_confirmed
  if (reviewed !== undefined) patch.reviewed = reviewed
  await supabase.from('sanctions_matches').update(patch).eq('id', id)
  return NextResponse.json({ updated: true })
}
