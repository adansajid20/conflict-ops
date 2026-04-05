export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()

  const [{ data: actors }, { data: rels }] = await Promise.all([
    supabase.from('actors').select('id,name,display_name,actor_type,type,region,country_code,threat_level,event_count,influence_score').order('event_count', { ascending: false }).limit(60),
    supabase.from('actor_relationships').select('actor_a,actor_b,actor_id,related_actor_id,relationship,relationship_type,strength').order('strength', { ascending: false }).limit(200),
  ])

  return NextResponse.json({
    nodes: (actors ?? []).map(a => ({
      id: a.id,
      name: a.name,
      display_name: a.display_name ?? a.name,
      actor_type: a.actor_type ?? a.type ?? 'organization',
      region: a.region ?? a.country_code ?? null,
      threat_level: a.threat_level ?? 'unknown',
      event_count: a.event_count ?? 0,
      influence_score: a.influence_score ?? 0,
    })),
    edges: (rels ?? []).map(r => ({
      source: r.actor_id ?? r.actor_a,
      target: r.related_actor_id ?? r.actor_b,
      type: r.relationship_type ?? r.relationship,
      strength: r.strength ?? 0.5,
    })),
  })
}
