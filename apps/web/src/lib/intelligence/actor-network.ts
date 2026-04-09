import { createServiceClient } from '@/lib/supabase/server'

export type ActorNode = {
  id: string
  name: string
  type: string | null
  country_code: string | null
  total_events: number
  primary_regions: string[]
  event_types: string[]
  average_severity: number
  activity_trend: 'increasing' | 'stable' | 'decreasing'
  threat_level: 'low' | 'medium' | 'high' | 'critical'
  connected_actor_ids: string[]
}

export type ActorEdge = {
  source_id: string
  target_id: string
  weight: number
  type: 'allied' | 'opposed' | 'unknown'
  co_occurrence_count: number
}

export type Faction = {
  id: string
  name: string
  actor_ids: string[]
  description: string
  primary_countries: string[]
}

export type ActorNetwork = {
  nodes: ActorNode[]
  edges: ActorEdge[]
  factions: Faction[]
  generated_at: string
}

export type ActorProfile = {
  actor_id: string
  name: string
  type: string | null
  country_code: string | null
  aliases: string[]
  total_events: number
  events_30d: number
  events_7d: number
  primary_regions: string[]
  event_types_distribution: Record<string, number>
  average_severity: number
  recent_activity: Array<{
    date: string
    event_count: number
    avg_severity: number
  }>
  activity_trend: 'increasing' | 'stable' | 'decreasing'
  threat_level: 'low' | 'medium' | 'high' | 'critical'
  connected_actors: Array<{
    actor_id: string
    name: string
    co_occurrences: number
    relationship_type: 'allied' | 'opposed' | 'unknown'
  }>
  estimated_capabilities: string[]
  known_locations: Array<{
    country_code: string
    region: string
    event_count: number
  }>
}

/**
 * Build co-occurrence network from events
 * Actors appearing in same events within 48h are connected
 */
export async function buildCoOccurrenceNetwork(
  countryCode?: string
): Promise<Map<string, Map<string, { count: number; side_conflict: boolean }>>> {
  const supabase = createServiceClient()

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('events')
    .select('id, actor_ids, entities, occurred_at, country_code')
    .gte('occurred_at', ninetyDaysAgo)

  if (countryCode) {
    query = query.eq('country_code', countryCode)
  }

  const { data: events } = await query

  if (!events || events.length === 0) {
    return new Map()
  }

  // Group events by 48h window
  const network = new Map<string, Map<string, { count: number; side_conflict: boolean }>>()

  for (const event of events) {
    const eventTime = new Date(event.occurred_at as string).getTime()
    const actorIds = Array.isArray(event.actor_ids) ? event.actor_ids.filter((id): id is string => typeof id === 'string') : []

    // Extract actors from entities JSONB if actor_ids is empty
    const entitiesActors: string[] = []
    if (event.entities && typeof event.entities === 'object' && 'actors' in event.entities) {
      const actors = event.entities.actors
      if (Array.isArray(actors)) {
        for (const actor of actors) {
          if (typeof actor === 'object' && actor !== null && 'id' in actor) {
            entitiesActors.push(String(actor.id))
          } else if (typeof actor === 'string') {
            entitiesActors.push(actor)
          }
        }
      }
    }

    const allActors = [...new Set([...actorIds, ...entitiesActors])].filter((a): a is string => typeof a === 'string')

    // Create edges between all pairs of actors in this event
    for (let i = 0; i < allActors.length; i++) {
      for (let j = i + 1; j < allActors.length; j++) {
        const actor1 = allActors[i] as string
        const actor2 = allActors[j] as string

        if (!network.has(actor1)) {
          network.set(actor1, new Map())
        }

        const actor1Map = network.get(actor1)!
        const existing = actor1Map.get(actor2) ?? { count: 0, side_conflict: false }
        existing.count += 1
        actor1Map.set(actor2, existing)

        // Add reverse edge
        if (!network.has(actor2)) {
          network.set(actor2, new Map())
        }
        const actor2Map = network.get(actor2)!
        const existing2 = actor2Map.get(actor1) ?? { count: 0, side_conflict: false }
        existing2.count += 1
        actor2Map.set(actor1, existing2)
      }
    }
  }

  return network
}

/**
 * Generate actor profiles from event data
 */
export async function generateActorProfiles(
  countryCode?: string
): Promise<Map<string, ActorProfile>> {
  const supabase = createServiceClient()

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get all events for this period
  let query = supabase
    .from('events')
    .select('id, actor_ids, entities, occurred_at, country_code, region, event_type, severity')
    .gte('occurred_at', ninetyDaysAgo)

  if (countryCode) {
    query = query.eq('country_code', countryCode)
  }

  const { data: events } = await query

  if (!events || events.length === 0) {
    return new Map()
  }

  // Get actor metadata
  const { data: actors } = await supabase.from('actors').select('id, name, type, country_code, aliases')

  const actorMap = new Map<string, { name: string; type: string | null; country_code: string | null; aliases: string[] }>()
  if (actors) {
    for (const actor of actors) {
      actorMap.set(actor.id as string, {
        name: (actor.name as string) || 'Unknown',
        type: (actor.type as string | null) || null,
        country_code: (actor.country_code as string | null) || null,
        aliases: (Array.isArray(actor.aliases) ? actor.aliases : []) as string[],
      })
    }
  }

  // Aggregate by actor
  const actorEvents = new Map<string, { events: typeof events; total: number; recent30d: number; recent7d: number }>()

  for (const event of events) {
    const eventTime = new Date(event.occurred_at as string).getTime()
    const thirtyMs = new Date(thirtyDaysAgo).getTime()
    const sevenMs = new Date(sevenDaysAgo).getTime()

    const actorIds = Array.isArray(event.actor_ids) ? event.actor_ids.filter((id): id is string => typeof id === 'string') : []

    // Extract from entities
    const entitiesActors: string[] = []
    if (event.entities && typeof event.entities === 'object' && 'actors' in event.entities) {
      const actors = event.entities.actors
      if (Array.isArray(actors)) {
        for (const actor of actors) {
          if (typeof actor === 'object' && actor !== null && 'id' in actor) {
            entitiesActors.push(String(actor.id))
          } else if (typeof actor === 'string') {
            entitiesActors.push(actor)
          }
        }
      }
    }

    const allActors = [...new Set([...actorIds, ...entitiesActors])].filter((a): a is string => typeof a === 'string')

    for (const actorId of allActors) {
      if (!actorEvents.has(actorId)) {
        actorEvents.set(actorId, { events: [], total: 0, recent30d: 0, recent7d: 0 })
      }
      const entry = actorEvents.get(actorId)!
      entry.events.push(event)
      entry.total += 1
      if (eventTime >= thirtyMs) entry.recent30d += 1
      if (eventTime >= sevenMs) entry.recent7d += 1
    }
  }

  // Generate profiles
  const profiles = new Map<string, ActorProfile>()

  for (const [actorId, { events: actorEventsList, total, recent30d, recent7d }] of actorEvents) {
    const metadata = actorMap.get(actorId)

    // Aggregate regions and event types
    const regions = new Map<string, number>()
    const eventTypes = new Map<string, number>()
    let severitySum = 0

    // Daily distribution for trend
    const dailyEvents = new Map<string, number>()

    for (const event of actorEventsList) {
      const region = (event.region as string | null) || 'Unknown'
      regions.set(region, (regions.get(region) ?? 0) + 1)

      const eventType = (event.event_type as string | null) || 'unknown'
      eventTypes.set(eventType, (eventTypes.get(eventType) ?? 0) + 1)

      severitySum += (event.severity as number) || 1

      const day = new Date(event.occurred_at as string).toISOString().split('T')[0] || ''
      if (day) dailyEvents.set(day, (dailyEvents.get(day) ?? 0) + 1)
    }

    const avgSeverity = total > 0 ? severitySum / total : 0

    // Determine trend: compare recent7d to prior23d
    const prior23d = recent30d - recent7d
    let activityTrend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (prior23d > 0) {
      const ratio = recent7d / prior23d
      if (ratio > 1.3) activityTrend = 'increasing'
      else if (ratio < 0.7) activityTrend = 'decreasing'
    } else if (recent7d > 0) {
      activityTrend = 'increasing'
    }

    // Calculate threat level
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    const threatScore = Math.min(10, recent7d * 0.4 + avgSeverity * 0.3 + (activityTrend === 'increasing' ? 2 : 0) + total * 0.1)
    if (threatScore >= 8) threatLevel = 'critical'
    else if (threatScore >= 5) threatLevel = 'high'
    else if (threatScore >= 2) threatLevel = 'medium'

    // Recent activity timeline (last 30 days, daily)
    const recentActivity: Array<{
      date: string
      event_count: number
      avg_severity: number
    }> = []

    const thirtyDays = Array.from(dailyEvents.entries())
      .filter(([date]) => new Date(date).getTime() >= new Date(thirtyDaysAgo).getTime())
      .sort()

    for (const [date, count] of thirtyDays) {
      const dayEvents = actorEventsList.filter((e) => new Date(e.occurred_at as string).toISOString().split('T')[0] === date)
      const daySeverity = dayEvents.length > 0 ? dayEvents.reduce((sum, e) => sum + ((e.severity as number) || 1), 0) / dayEvents.length : 0
      recentActivity.push({ date, event_count: count, avg_severity: daySeverity })
    }

    // Aggregate locations
    const locations: Array<{
      country_code: string
      region: string
      event_count: number
    }> = []

    for (const event of actorEventsList) {
      const cc = (event.country_code as string | null) || 'Unknown'
      const region = (event.region as string | null) || 'Unknown'
      const existing = locations.find((l) => l.country_code === cc && l.region === region)
      if (existing) {
        existing.event_count += 1
      } else {
        locations.push({ country_code: cc, region, event_count: 1 })
      }
    }

    profiles.set(actorId, {
      actor_id: actorId,
      name: metadata?.name || 'Unknown',
      type: metadata?.type || null,
      country_code: metadata?.country_code || null,
      aliases: metadata?.aliases || [],
      total_events: total,
      events_30d: recent30d,
      events_7d: recent7d,
      primary_regions: Array.from(regions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([r]) => r),
      event_types_distribution: Object.fromEntries(eventTypes),
      average_severity: Math.round(avgSeverity * 100) / 100,
      recent_activity: recentActivity,
      activity_trend: activityTrend,
      threat_level: threatLevel,
      connected_actors: [],
      estimated_capabilities: inferCapabilities(metadata?.type, avgSeverity, Array.from(eventTypes.keys())),
      known_locations: locations,
    })
  }

  return profiles
}

/**
 * Infer capabilities from actor type and event patterns
 */
function inferCapabilities(type: string | null | undefined, avgSeverity: number, eventTypes: string[]): string[] {
  const capabilities: Set<string> = new Set()

  if (type?.toLowerCase().includes('state') || type?.toLowerCase().includes('military')) {
    capabilities.add('air_operations')
    capabilities.add('artillery')
    capabilities.add('armor')
    capabilities.add('logistics')
  }

  if (type?.toLowerCase().includes('armed') || type?.toLowerCase().includes('insurgent') || type?.toLowerCase().includes('militia')) {
    capabilities.add('asymmetric_warfare')
    capabilities.add('guerrilla_tactics')
    capabilities.add('ied_operations')
  }

  if (avgSeverity >= 3.5) {
    capabilities.add('heavy_weapons')
    capabilities.add('organized_command')
  }

  if (eventTypes.includes('airstrike') || eventTypes.includes('bombing')) {
    capabilities.add('air_assets')
  }

  if (eventTypes.includes('maritime_incident') || eventTypes.includes('naval')) {
    capabilities.add('maritime_operations')
  }

  return Array.from(capabilities)
}

/**
 * Detect factions using community detection on co-occurrence network
 */
export async function detectFactions(network: Map<string, Map<string, { count: number; side_conflict: boolean }>>): Promise<Faction[]> {
  if (network.size === 0) return []

  // Simple greedy clustering: actors with high co-occurrence are in same faction
  const factions: Faction[] = []
  const assigned = new Set<string>()

  const actors = Array.from(network.keys())

  for (const startActor of actors) {
    if (assigned.has(startActor)) continue

    // BFS to find connected component with high co-occurrence
    const faction: string[] = []
    const queue = [startActor]
    const visited = new Set<string>([startActor])

    while (queue.length > 0) {
      const current = queue.shift()!
      faction.push(current)
      assigned.add(current)

      const connections = network.get(current) || new Map()
      for (const [neighbor, { count }] of connections) {
        if (!visited.has(neighbor) && count >= 2) {
          // Threshold: at least 2 co-occurrences
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    if (faction.length >= 2) {
      // Only create faction if it has 2+ actors
      factions.push({
        id: `faction_${factions.length}`,
        name: inferFactionName(faction),
        actor_ids: faction,
        description: `Faction with ${faction.length} actors showing frequent co-occurrence`,
        primary_countries: [],
      })
    }
  }

  return factions
}

/**
 * Infer faction name from actor types
 */
function inferFactionName(actorIds: string[]): string {
  // This is simplified; in production, would look up actor metadata
  if (actorIds.length >= 5) return 'Large Coalition'
  return `Faction (${actorIds.length} actors)`
}

/**
 * Build complete actor network graph
 */
export async function buildActorNetwork(countryCode?: string): Promise<ActorNetwork> {
  const coOccurrence = await buildCoOccurrenceNetwork(countryCode)
  const profiles = await generateActorProfiles(countryCode)

  // Convert profiles to nodes
  const nodes: ActorNode[] = Array.from(profiles.values()).map((profile) => ({
    id: profile.actor_id,
    name: profile.name,
    type: profile.type,
    country_code: profile.country_code,
    total_events: profile.total_events,
    primary_regions: profile.primary_regions,
    event_types: Object.keys(profile.event_types_distribution),
    average_severity: profile.average_severity,
    activity_trend: profile.activity_trend,
    threat_level: profile.threat_level,
    connected_actor_ids: [],
  }))

  // Build edges
  const edges: ActorEdge[] = []
  const edgeSet = new Set<string>()

  for (const [sourceId, connections] of coOccurrence) {
    for (const [targetId, { count }] of connections) {
      // Only add one direction per edge
      const edgeKey = [sourceId, targetId].sort().join('|')
      if (edgeSet.has(edgeKey)) continue
      edgeSet.add(edgeKey)

      const sourceProfile = profiles.get(sourceId)
      const targetProfile = profiles.get(targetId)

      if (!sourceProfile || !targetProfile) continue

      // Infer relationship type (simplified)
      let relationshipType: 'allied' | 'opposed' | 'unknown' = 'unknown'
      if (sourceProfile.primary_regions.some((r) => targetProfile.primary_regions.includes(r))) {
        // Co-operating in same region
        relationshipType = 'allied'
      }

      edges.push({
        source_id: sourceId,
        target_id: targetId,
        weight: Math.min(1, count / 10), // Normalize: 10+ occurrences = weight 1
        type: relationshipType,
        co_occurrence_count: count,
      })

      // Add to connected_actor_ids
      const sourceNode = nodes.find((n) => n.id === sourceId)
      const targetNode = nodes.find((n) => n.id === targetId)
      if (sourceNode && !sourceNode.connected_actor_ids.includes(targetId)) {
        sourceNode.connected_actor_ids.push(targetId)
      }
      if (targetNode && !targetNode.connected_actor_ids.includes(sourceId)) {
        targetNode.connected_actor_ids.push(sourceId)
      }
    }
  }

  // Detect factions
  const factions = await detectFactions(coOccurrence)

  return {
    nodes,
    edges,
    factions,
    generated_at: new Date().toISOString(),
  }
}

/**
 * Get detailed profile for a single actor
 */
export async function getActorProfile(actorId: string): Promise<ActorProfile | null> {
  const profiles = await generateActorProfiles()
  return profiles.get(actorId) || null
}

/**
 * Enrich profile with connected actors
 */
export async function enrichActorProfile(profile: ActorProfile): Promise<ActorProfile> {
  const supabase = createServiceClient()
  const coOccurrence = await buildCoOccurrenceNetwork()
  const profiles = await generateActorProfiles()

  const connections = coOccurrence.get(profile.actor_id) || new Map()

  profile.connected_actors = Array.from(connections.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10) // Top 10 connected actors
    .map(([actorId, { count, side_conflict }]) => {
      const connectedProfile = profiles.get(actorId)
      return {
        actor_id: actorId,
        name: connectedProfile?.name || 'Unknown',
        co_occurrences: count,
        relationship_type: (side_conflict ? 'opposed' : 'allied') as 'allied' | 'opposed' | 'unknown',
      }
    })

  return profile
}
