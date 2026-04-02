export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: clusters } = await supabase
    .from('event_clusters')
    .select('cluster_id')
    .eq('event_id', id)

  if (!clusters?.length) return NextResponse.json({ related: [] })

  const clusterIds = clusters.map((c: { cluster_id: string }) => c.cluster_id)

  const { data: members } = await supabase
    .from('event_clusters')
    .select('event_id')
    .in('cluster_id', clusterIds)
    .neq('event_id', id)
    .limit(10)

  if (!members?.length) return NextResponse.json({ related: [] })

  const relatedIds = [...new Set(members.map((m: { event_id: string }) => m.event_id))].slice(0, 3)

  const { data: events } = await supabase
    .from('events')
    .select('id, title, occurred_at, region, severity')
    .in('id', relatedIds)
    .order('occurred_at', { ascending: false })

  return NextResponse.json({ related: events ?? [] })
}
