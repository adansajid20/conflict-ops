export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { createServiceClient } from '@/lib/supabase/server'

function getWorstSeverity(sevs: (number | null)[]): string {
  const nums = sevs.filter((s): s is number => s != null)
  if (nums.some(s => s >= 4)) return 'critical'
  if (nums.some(s => s >= 3)) return 'high'
  if (nums.some(s => s >= 2)) return 'medium'
  return 'low'
}

function calcTrajectory(evts: Array<{ severity: number | null; occurred_at: string | null }>): { direction: string; velocity: number } {
  if (evts.length < 3) return { direction: 'unknown', velocity: 0 }
  const mid = Math.floor(evts.length / 2)
  const recent = evts.slice(0, mid)
  const older = evts.slice(mid)
  const sev = (s: number | null) => s ?? 1
  const recentAvg = recent.reduce((s, e) => s + sev(e.severity), 0) / recent.length
  const olderAvg = older.reduce((s, e) => s + sev(e.severity), 0) / older.length
  const velocity = recentAvg - olderAvg
  let direction = 'stable'
  if (velocity > 0.3) direction = 'escalating'
  else if (velocity < -0.3) direction = 'de_escalating'
  return { direction, velocity: Math.round(velocity * 100) / 100 }
}

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const h48 = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: unclusteredEvents } = await supabase
    .from('events')
    .select('id, title, embedding, severity, category, region, latitude, longitude, occurred_at, escalation_score')
    .not('embedding', 'is', null)
    .is('cluster_id', null)
    .gte('occurred_at', h48)
    .limit(100)

  if (!unclusteredEvents?.length) return NextResponse.json({ new_clusters: 0, assigned_to_existing: 0 })

  let newClusters = 0
  let assignedToExisting = 0

  for (const event of unclusteredEvents) {
    try {
      const { data: similar } = await supabase.rpc('match_events', {
        query_embedding: event.embedding,
        match_threshold: 0.78,
        match_count: 10,
      })

      const clusterVotes = new Map<string, number>()
      if (similar?.length) {
        const { data: clustered } = await supabase
          .from('events')
          .select('id, cluster_id')
          .in('id', similar.map((s: { id: string }) => s.id))
          .not('cluster_id', 'is', null)
        for (const s of clustered ?? []) {
          if (!s.cluster_id) continue
          clusterVotes.set(s.cluster_id, (clusterVotes.get(s.cluster_id) ?? 0) + 1)
        }
      }

      if (clusterVotes.size > 0) {
        const sorted = [...clusterVotes.entries()].sort((a, b) => b[1] - a[1])
        const bestCluster = (sorted[0] as [string, number])[0]
        await supabase.from('events').update({ cluster_id: bestCluster }).eq('id', event.id)

        const { data: clusterEvts } = await supabase.from('events').select('severity, occurred_at').eq('cluster_id', bestCluster).order('occurred_at', { ascending: false }).limit(50)
        const { count } = await supabase.from('events').select('*', { count: 'exact', head: true }).eq('cluster_id', bestCluster)
        const traj = calcTrajectory(clusterEvts ?? [])

        await supabase.from('event_clusters').update({
          event_count: count ?? 0,
          severity: getWorstSeverity(clusterEvts?.map(e => e.severity) ?? []),
          last_event_at: new Date().toISOString(),
          escalation_trajectory: traj.direction,
          escalation_velocity: traj.velocity,
          updated_at: new Date().toISOString(),
        }).eq('id', bestCluster)
        assignedToExisting++
      } else if (similar && similar.length >= 2) {
        const { data: newCluster } = await supabase.from('event_clusters').insert({
          name: (event.title ?? 'Cluster').slice(0, 100),
          region: event.region, event_count: 1, severity: getWorstSeverity([event.severity]),
          centroid_lat: event.latitude, centroid_lng: event.longitude,
          first_event_at: event.occurred_at, last_event_at: event.occurred_at,
          escalation_trajectory: 'unknown',
        }).select('id').single()

        if (newCluster) {
          await supabase.from('events').update({ cluster_id: newCluster.id }).eq('id', event.id)
          newClusters++
        }
      }
    } catch { /* ok */ }
  }

  return NextResponse.json({ new_clusters: newClusters, assigned_to_existing: assignedToExisting })
}
