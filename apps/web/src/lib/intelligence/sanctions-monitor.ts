/**
 * Sanctions Monitoring Intelligence
 *
 * Tracks:
 * 1. Active sanctioned entities appearing in conflict events
 * 2. Sanctions announcements as geopolitical signals
 * 3. Cross-reference between OFAC/UN lists and event actors
 * 4. Violation detection and escalation
 */

import { createServiceClient } from '@/lib/supabase/server'

export type SanctionedEntityActivity = {
  entity_id: string
  entity_name: string
  list_source: 'OFAC_SDN' | 'UN_CONSOLIDATED'
  program: string
  country: string
  recently_active: boolean
  event_count_7d: number
  last_event_date: string | null
  regions_active: string[]
}

export type SanctionsSignal = {
  signal_type: 'sanction_new' | 'sanction_lifted' | 'violation'
  entity_name: string
  program: string
  region: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  description: string
}

/**
 * Cross-reference sanctions entities with event actors
 * When a sanctioned entity appears in event data, flag it as active
 */
export async function detectActiveSanctionedEntities(): Promise<SanctionedEntityActivity[]> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get all sanctioned entities
  const { data: sanctionedEntities } = await supabase
    .from('sanctions_entities')
    .select('id, entity_name, list_source, program, country')
    .order('entity_name')

  if (!sanctionedEntities?.length) return []

  const activities: SanctionedEntityActivity[] = []

  for (const entity of sanctionedEntities) {
    // Search for this entity in recent events using full-text or ILIKE
    const { data: matchingEvents } = await supabase
      .from('events')
      .select('id, region, ingested_at, entities')
      .gte('ingested_at', sevenDaysAgo)

    if (!matchingEvents?.length) continue

    // Filter events where this entity appears (in title, description, or entities JSONB)
    const relevantEvents = matchingEvents.filter(evt => {
      const title = ((evt as Record<string, unknown>).title as string | undefined) ?? ''
      const description = ((evt as Record<string, unknown>).description as string | undefined) ?? ''
      const entitiesJson = evt.entities as Record<string, unknown> | null | undefined
      const entityList = (entitiesJson?.entities ?? []) as string[]

      return title.toLowerCase().includes(entity.entity_name.toLowerCase()) ||
             description.toLowerCase().includes(entity.entity_name.toLowerCase()) ||
             entityList.some(e => e.toLowerCase().includes(entity.entity_name.toLowerCase()))
    })

    if (!relevantEvents.length) continue

    // Extract unique regions from matching events
    const regionsSet = new Set<string>()
    let latestDate: string | null = null

    for (const evt of relevantEvents) {
      const region = (evt as Record<string, unknown>).region as string | undefined
      const ingested = evt.ingested_at as string | undefined
      if (region) regionsSet.add(region)
      if (!latestDate || (ingested && ingested > latestDate)) latestDate = ingested || latestDate
    }

    const regionsList: string[] = []
    regionsSet.forEach(r => regionsList.push(r))

    const activity: SanctionedEntityActivity = {
      entity_id: (entity as Record<string, unknown>).id as string,
      entity_name: entity.entity_name,
      list_source: entity.list_source as 'OFAC_SDN' | 'UN_CONSOLIDATED',
      program: entity.program,
      country: entity.country,
      recently_active: true,
      event_count_7d: relevantEvents.length,
      last_event_date: latestDate,
      regions_active: regionsList,
    }

    activities.push(activity)

    // Generate alert for active sanctioned entity in new region
    const previousRegions = await getPreviousActiveRegions(entity.entity_name, sevenDaysAgo)
    const newRegions = regionsList.filter(r => !previousRegions.includes(r))

    if (newRegions.length > 0) {
      for (const newRegion of newRegions) {
        await supabase.from('correlation_signals').insert({
          signal_type: 'sanctions_violation_new_region',
          title: `Sanctioned entity active in new region: ${entity.entity_name} in ${newRegion}`,
          description: `Sanctioned entity "${entity.entity_name}" (Program: ${entity.program}, Source: ${entity.list_source}) has become active in ${newRegion}. Detected in ${relevantEvents.length} events over the past 7 days. This represents a potential sanctions evasion or violation.`,
          severity: 'high',
          region: newRegion,
          confidence: 0.8,
          signal_sources: {
            entity_name: entity.entity_name,
            program: entity.program,
            event_count: relevantEvents.length,
            new_region: newRegion,
          },
        })
      }
    }
  }

  return activities
}

/**
 * Helper: get regions where an entity was previously active
 */
async function getPreviousActiveRegions(entityName: string, before: string): Promise<string[]> {
  const supabase = createServiceClient()
  const thirtyDaysAgo = new Date(new Date(before).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('events')
    .select('region')
    .ilike('title', `%${entityName}%`)
    .gte('ingested_at', thirtyDaysAgo)
    .lt('ingested_at', before)

  if (!data?.length) return []

  const regionsSet = new Set<string>()
  const regions: string[] = []
  data.forEach(d => {
    const region = (d as Record<string, unknown>).region as string | undefined
    if (region && !regionsSet.has(region)) {
      regionsSet.add(region)
      regions.push(region)
    }
  })
  return regions
}

/**
 * Flag when a new sanctions are announced (escalation signal)
 * This would typically be ingested from news sources or official bulletins
 * For now, detect sudden increase in sanctions entity mentions
 */
export async function detectSanctionsEscalation(): Promise<number> {
  const supabase = createServiceClient()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get all sanctioned entities
  const { data: sanctionedEntities } = await supabase
    .from('sanctions_entities')
    .select('entity_name, program')
    .order('entity_name')

  if (!sanctionedEntities?.length) return 0

  let escalationSignals = 0

  for (const entity of sanctionedEntities) {
    // Count mentions in last 24 hours
    const { data: recentMentions } = await supabase
      .from('events')
      .select('id')
      .gte('ingested_at', twentyFourHoursAgo)

    const recent24h = (recentMentions ?? []).filter(evt =>
      String((evt as Record<string, unknown>).title ?? '').toLowerCase().includes(entity.entity_name.toLowerCase())
    ).length

    // Count mentions in prior 7 days
    const { data: previousMentions } = await supabase
      .from('events')
      .select('id')
      .gte('ingested_at', sevenDaysAgo)
      .lt('ingested_at', twentyFourHoursAgo)

    const previous7d = (previousMentions ?? []).filter(evt =>
      String((evt as Record<string, unknown>).title ?? '').toLowerCase().includes(entity.entity_name.toLowerCase())
    ).length

    // Detect spike: if 24h mentions > 3x the daily average
    const dailyAverage = previous7d / 6 // 6 days prior
    if (recent24h > dailyAverage * 3 && recent24h > 2) {
      await supabase.from('correlation_signals').insert({
        signal_type: 'sanctions_escalation',
        title: `Sanctions escalation signal: ${entity.entity_name} mentions spike`,
        description: `Mentions of sanctioned entity "${entity.entity_name}" (Program: ${entity.program}) have spiked ${Math.round(recent24h / Math.max(dailyAverage, 1))}x above normal in the last 24 hours. May indicate new enforcement action or emerging violation.`,
        severity: 'high',
        region: 'Global',
        confidence: 0.75,
        signal_sources: {
          entity: entity.entity_name,
          mentions_24h: recent24h,
          mentions_7d_avg: Math.round(dailyAverage),
          spike_factor: Math.round(recent24h / Math.max(dailyAverage, 1)),
        },
      })

      escalationSignals++
    }
  }

  return escalationSignals
}

/**
 * Generate composite sanctions report for a region
 * Shows: active entities, recent violations, escalation indicators
 */
export async function getSanctionsActivityByRegion(region: string): Promise<{
  active_entities: SanctionedEntityActivity[]
  violation_signals: number
  escalation_signals: number
  summary: string
}> {
  const supabase = createServiceClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Get all active sanctioned entities
  const allActive = await detectActiveSanctionedEntities()
  const regionActive = allActive.filter(a => a.regions_active.includes(region))

  // Count violation signals
  const { count: violations } = await supabase
    .from('correlation_signals')
    .select('*', { count: 'exact', head: true })
    .eq('signal_type', 'sanctions_violation_new_region')
    .eq('region', region)
    .gte('detected_at', sevenDaysAgo)

  // Count escalation signals
  const { count: escalations } = await supabase
    .from('correlation_signals')
    .select('*', { count: 'exact', head: true })
    .eq('signal_type', 'sanctions_escalation')
    .gte('detected_at', sevenDaysAgo)

  const summary = regionActive.length > 0
    ? `${regionActive.length} sanctioned entities detected active in ${region} over past 7 days with ${violations ?? 0} violation signals and ${escalations ?? 0} escalation indicators.`
    : `No active sanctioned entities detected in ${region}.`

  return {
    active_entities: regionActive,
    violation_signals: violations ?? 0,
    escalation_signals: escalations ?? 0,
    summary,
  }
}

/**
 * Run full sanctions monitoring pipeline
 */
export async function runSanctionsMonitoring(): Promise<{
  active_entities_detected: number
  new_violations: number
  escalation_signals: number
}> {
  const [active, escalations] = await Promise.all([
    detectActiveSanctionedEntities(),
    detectSanctionsEscalation(),
  ])

  // Count new violations from signals
  const supabase = createServiceClient()
  const { count: violations } = await supabase
    .from('correlation_signals')
    .select('*', { count: 'exact', head: true })
    .eq('signal_type', 'sanctions_violation_new_region')
    .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  return {
    active_entities_detected: active.length,
    new_violations: violations ?? 0,
    escalation_signals: escalations,
  }
}
