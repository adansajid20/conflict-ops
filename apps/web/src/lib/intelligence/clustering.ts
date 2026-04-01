type ClusterableEvent = {
  id: string
  title: string
  source: string
  event_type: string | null
  country_code: string | null
  severity: number | null
  description: string | null
  significance_score: number | null
  embedding: number[] | null
}

type SimilarEventRow = {
  id: string
  cluster_id: string | null
  similarity: number
}

type SupabaseRuntime = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  from: (table: string) => {
    select: (query: string) => {
      in: (column: string, values: string[]) => Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>
      eq: (column: string, value: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> }
    }
    insert: (values: Record<string, unknown>) => { select: (query: string) => { single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } }
    update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
  }
}

function asSupabaseRuntime(client: unknown): SupabaseRuntime {
  return client as SupabaseRuntime
}

export async function clusterEvent(supabaseClient: unknown, event: ClusterableEvent): Promise<boolean> {
  if (!event.embedding || event.embedding.length === 0) return false
  const supabase = asSupabaseRuntime(supabaseClient)

  const { data, error } = await supabase.rpc('find_similar_events', {
    query_embedding: JSON.stringify(event.embedding),
    similarity_threshold: 0.85,
    time_window_hours: 4,
  })

  if (error) return false
  const similar = ((data as SimilarEventRow[] | null) ?? []).filter((row) => row.id !== event.id)

  if (similar.length === 0) {
    const { data: created } = await supabase.from('event_clusters').insert({
      canonical_title: event.title,
      canonical_summary: event.description,
      event_ids: [event.id],
      source_count: 1,
      country_code: event.country_code,
      severity: event.severity,
      event_type: event.event_type,
      significance_score: event.significance_score,
      latest_event_at: new Date().toISOString(),
    }).select('id').single()

    const clusterId = created?.id
    if (typeof clusterId === 'string') {
      await supabase.from('events').update({ cluster_id: clusterId }).eq('id', event.id)
      return true
    }
    return false
  }

  const existingCluster = similar.find((row) => typeof row.cluster_id === 'string' && row.cluster_id)
  if (existingCluster?.cluster_id) {
    const clusterId = existingCluster.cluster_id
    const { data: cluster } = await supabase.from('event_clusters').select('event_ids, source_count').eq('id', clusterId).single()
    const eventIds = Array.isArray(cluster?.event_ids) ? cluster.event_ids.filter((value): value is string => typeof value === 'string') : []
    const nextIds = Array.from(new Set([...eventIds, event.id]))
    await supabase.from('event_clusters').update({ event_ids: nextIds, source_count: nextIds.length, latest_event_at: new Date().toISOString() }).eq('id', clusterId)
    await supabase.from('events').update({ cluster_id: clusterId }).eq('id', event.id)
    return true
  }

  const seedIds = Array.from(new Set([event.id, ...similar.map((row) => row.id)]))
  const { data: similarEvents } = await supabase.from('events').select('id,title,description,country_code,severity,event_type,significance_score').in('id', seedIds)
  const candidates = (similarEvents ?? []).map((row) => ({
    id: typeof row.id === 'string' ? row.id : '',
    title: typeof row.title === 'string' ? row.title : event.title,
    description: typeof row.description === 'string' ? row.description : event.description,
    country_code: typeof row.country_code === 'string' ? row.country_code : event.country_code,
    severity: typeof row.severity === 'number' ? row.severity : event.severity,
    event_type: typeof row.event_type === 'string' ? row.event_type : event.event_type,
    significance_score: typeof row.significance_score === 'number' ? row.significance_score : event.significance_score,
  }))
  const canonical = candidates.sort((left, right) => (right.significance_score ?? 0) - (left.significance_score ?? 0))[0] ?? event

  const { data: created } = await supabase.from('event_clusters').insert({
    canonical_title: canonical.title,
    canonical_summary: canonical.description,
    event_ids: seedIds,
    source_count: seedIds.length,
    country_code: canonical.country_code,
    severity: canonical.severity,
    event_type: canonical.event_type,
    significance_score: canonical.significance_score,
    latest_event_at: new Date().toISOString(),
  }).select('id').single()

  const clusterId = created?.id
  if (typeof clusterId !== 'string') return false

  for (const eventId of seedIds) {
    await supabase.from('events').update({ cluster_id: clusterId }).eq('id', eventId)
  }

  return true
}
