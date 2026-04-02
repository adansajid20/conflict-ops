import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'
import { isSafeMode } from '@/lib/doctor/safe-mode-check'
import { isBlocklisted } from '@/lib/classification'
import { humanizeDriver, isGeopoliticalType, computeSeverityCounts, sanitizeEventForClient } from '@/lib/event-presentation'

export const dynamic = 'force-dynamic'

// ─── types ────────────────────────────────────────────────────────────────────

interface EventRow {
  id: string
  source: string | null
  event_type: string | null
  title: string | null
  description: string | null
  region: string | null
  country_code: string | null
  severity: number | null
  status: string | null
  occurred_at: string | null
  ingested_at: string | null
  location: string | null
  provenance_raw: { url?: string; attribution?: string; source?: string } | null
}

export interface HotRegion {
  region: string
  riskLevel: 'Critical' | 'High' | 'Elevated' | 'Moderate' | 'Monitored'
  eventCount: number
  topDrivers: string[]
  topCountries: string[]
}

export interface OverviewResponse {
  lastUpdatedAt: string | null
  freshnessStatus: 'Fresh' | 'Delayed' | 'Stale' | 'Offline'
  freshnessDescription: string
  freshnessColor: 'green' | 'yellow' | 'orange' | 'red'
  coverageLevel: 'High' | 'Medium' | 'Low'
  coverageTooltip: string
  kpis: {
    eventsWindow: number
    events7d: number
    hotRegionCount: number
    criticalHighCount: number
    developingCount: number
    activeAlertsCount: number
    breaking2h: number
  }
  topStories: EventRow[]
  hotRegions: HotRegion[]
  notices: string[]
  hasOrg: boolean
  window: string
  severityCounts: { critical: number; high: number; medium: number; low: number }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function computeFreshness(lastIngestedAt: string | null): {
  label: 'Fresh' | 'Delayed' | 'Stale' | 'Offline'
  description: string
  color: 'green' | 'yellow' | 'orange' | 'red'
} {
  if (!lastIngestedAt) return { label: 'Offline', description: 'No recent data', color: 'red' }
  const ageMs = Date.now() - new Date(lastIngestedAt).getTime()
  const ageMin = Math.floor(ageMs / 60000)
  // Fresh: <120 min (2h) — FreshnessBanner handles 30–120 min soft warning separately
  // Delayed: 2h–12h; Stale/Offline: >12h
  if (ageMin < 120) return { label: 'Fresh', description: `${ageMin}m ago`, color: 'green' }
  if (ageMin < 720) return { label: 'Delayed', description: `${Math.floor(ageMin / 60)}h ago`, color: 'yellow' }
  return { label: 'Stale', description: `${Math.floor(ageMin / 60)}h ago`, color: 'red' }
}

function computeCoverage(distinctSourceCount: number, eventCount: number): {
  label: 'High' | 'Medium' | 'Low'
  tooltip: string
} {
  if (distinctSourceCount >= 3 && eventCount >= 50)
    return { label: 'High', tooltip: 'Multiple independent sources confirm activity across regions.' }
  if (distinctSourceCount >= 2 || eventCount >= 20)
    return { label: 'Medium', tooltip: 'Partial coverage from some sources. Core tracking active.' }
  return { label: 'Low', tooltip: 'Limited source diversity. Tracking may be incomplete.' }
}

function computeFreshnessScore(event: { occurred_at: string; severity?: string | number | null }): number {
  const ageMs = Date.now() - new Date(event.occurred_at).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)

  const freshnessScore =
    ageHours <= 3 ? 100 :
    ageHours <= 6 ? 80 :
    ageHours <= 12 ? 50 :
    ageHours <= 24 ? 20 : 5

  const normalizedSeverity = typeof event.severity === 'string'
    ? event.severity.toLowerCase()
    : event.severity == 4
      ? 'critical'
      : event.severity == 3
        ? 'high'
        : event.severity == 2
          ? 'medium'
          : null

  const severityBonus =
    normalizedSeverity === 'critical' ? 30 :
    normalizedSeverity === 'high' ? 20 :
    normalizedSeverity === 'medium' ? 10 : 0

  return freshnessScore + severityBonus
}

const RISK_ORDER: Record<HotRegion['riskLevel'], number> = {
  Critical: 5,
  High: 4,
  Elevated: 3,
  Moderate: 2,
  Monitored: 1,
}

function computeHotRegions(events: EventRow[]): HotRegion[] {
  const map = new Map<
    string,
    { count: number; sev4: number; sev3: number; sev2: number; geoSev4: number; geoSev3: number; types: Map<string, number>; countries: Set<string> }
  >()

  const GEO_PLACEHOLDER_REGIONS = new Set(['global', 'world', '', 'un', 'united_nations', 'north_america', 'oceania'])

  const REGION_DISPLAY: Record<string, string> = {
    'middle_east': 'Middle East',
    'eastern_europe': 'Eastern Europe',
    'south_asia': 'South Asia',
    'east_asia': 'East Asia',
    'sub_saharan_africa': 'Sub-Saharan Africa',
    'southeast_asia': 'Southeast Asia',
    'latin_america': 'Latin America',
    'north_africa': 'North Africa',
    'central_asia': 'Central Asia',
    'west_africa': 'West Africa',
    'east_africa': 'East Africa',
    'central_africa': 'Central Africa',
    'europe': 'Europe',
    'asia_pacific': 'Asia Pacific',
    'africa': 'Africa',
    'asia': 'Asia',
  }

  for (const e of events) {
    // Normalize to snake_case for dedup key
    const rawRegion = e.region || 'global'
    const regionSlug = rawRegion.toLowerCase().replace(/\s+/g, '_')
    const region = REGION_DISPLAY[regionSlug] ?? rawRegion
    // Skip placeholder regions
    if (GEO_PLACEHOLDER_REGIONS.has(regionSlug)) continue

    const entry = map.get(region) ?? {
      count: 0, sev4: 0, sev3: 0, sev2: 0, geoSev4: 0, geoSev3: 0,
      types: new Map(), countries: new Set()
    }
    entry.count++
    const sev = e.severity ?? 1
    if (sev >= 4) entry.sev4++
    else if (sev >= 3) entry.sev3++
    else if (sev >= 2) entry.sev2++
    // Geopolitical risk counts: exclude natural_disaster from scoring
    if (isGeopoliticalType(e.event_type)) {
      if (sev >= 4) entry.geoSev4++
      else if (sev >= 3) entry.geoSev3++
    }
    if (e.event_type) entry.types.set(e.event_type, (entry.types.get(e.event_type) ?? 0) + 1)
    if (e.country_code) entry.countries.add(e.country_code)
    map.set(region, entry)  // key is display name — already deduped via slug normalization
  }

  const regions: HotRegion[] = []
  for (const [region, data] of map.entries()) {
    // Risk level based on geopolitical events AND severity
    let riskLevel: HotRegion['riskLevel']
    if (data.geoSev4 >= 1) riskLevel = 'Critical'
    else if (data.geoSev3 >= 5) riskLevel = 'Critical'
    else if (data.geoSev3 >= 2) riskLevel = 'High'
    else if (data.geoSev3 >= 1 || data.sev2 >= 10) riskLevel = 'Elevated'
    else if (data.count >= 5) riskLevel = 'Moderate'
    else riskLevel = 'Monitored'

    // Humanize driver labels
    const topDrivers = [...data.types.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t]) => humanizeDriver(t))

    regions.push({
      region,
      riskLevel,
      eventCount: data.count,
      topDrivers,
      topCountries: [...data.countries].slice(0, 5),
    })
  }

  return regions
    .sort((a, b) => {
      const rd = RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel]
      return rd !== 0 ? rd : b.eventCount - a.eventCount
    })
    .slice(0, 8)
}

const WINDOW_MS: Record<string, number> = {
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
}

// ─── handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request): Promise<NextResponse<OverviewResponse | { error: string }>> {
  const { userId } = await auth()
  // Public access allowed — userId null means unauthenticated (anonymous feed view)

  const url = new URL(req.url)
  const win = url.searchParams.get('window') ?? '24h'
  if (!WINDOW_MS[win]) return NextResponse.json({ error: 'Invalid window' }, { status: 400 })

  const cacheKey = `cache:overview:${win}`

  if (await isSafeMode()) {
    const safeCached = await getCachedSnapshot<OverviewResponse>(cacheKey)
    if (safeCached) {
      return NextResponse.json(safeCached, { headers: { 'X-Safe-Mode': 'true' } })
    }

    return NextResponse.json({
      lastUpdatedAt: null,
      freshnessStatus: 'Offline',
      freshnessDescription: 'Safe mode active',
      freshnessColor: 'red',
      coverageLevel: 'Low',
      coverageTooltip: 'Safe mode is serving fallback data.',
      kpis: {
        eventsWindow: 0,
        events7d: 0,
        hotRegionCount: 0,
        criticalHighCount: 0,
        developingCount: 0,
        activeAlertsCount: 0,
        breaking2h: 0,
      },
      topStories: [],
      hotRegions: [],
      notices: ['Safe mode active. Showing fallback overview.'],
      hasOrg: false,
      window: win,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    }, { headers: { 'X-Safe-Mode': 'true' } })
  }

  const cached = await getCachedSnapshot<OverviewResponse>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  const supabase = createServiceClient()
  const since = new Date(Date.now() - WINDOW_MS[win]!).toISOString()
  const since7d = new Date(Date.now() - WINDOW_MS['7d']!).toISOString()
  const topStoriesSince6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const topStoriesSince24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Parallel queries — never expose source health/pipeline status
  const [
    windowEvents,
    count7dRes,
    critHighRes,
    developingRes,
    freshRes,
    orgRes,
    alertsRes,
    breakingRes,
    topStories,
  ] = await Promise.all([
    // All events in window (for hot regions + coverage)
    supabase
      .from('events')
      .select('id,source,event_type,title,description,region,country_code,severity,status,occurred_at,ingested_at,location::text,provenance_raw,summary_short')
      .gte('occurred_at', since)
      .eq('is_humanitarian_report', false)
      .not('source', 'ilike', '%usgs%')
      .not('source', 'ilike', '%eonet%')
      .not('source', 'ilike', '%nasa%')
      .not('event_type', 'in', '("natural_disaster","wildfire","earthquake")')
      .not('region', 'in', '("North America","Oceania","Global")')
      .order('severity', { ascending: false })
      .order('occurred_at', { ascending: false })
      .limit(500),

    // Count 7d (always, regardless of window)
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', since7d),

    // Critical + high count in window
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', since)
      .gte('severity', 3),

    // Developing/pending in window
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', since)
      .in('status', ['developing', 'pending']),

    // Most recent ingest for freshness
    supabase
      .from('events')
      .select('ingested_at')
      .eq('is_humanitarian_report', false)
      .order('ingested_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .single(),

    // User's org (null for unauthenticated)
    userId
      ? supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
      : Promise.resolve({ data: null, error: null }),

    // Active alerts (only if org exists — handled below)
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('read', false),

    // Breaking events in last 2h (severity >= 3)
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('occurred_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .gte('severity', 3),

    // Top stories (conflict/news) — freshness-first shortlist from last 6h, then 24h fallback
    // Use occurred_at: this is the article publish time in the actual schema.
    // Exclude: noaa (weather), nasa_eonet (natural fires), usgs (earthquakes) — these go in weather bucket
    supabase
      .from('events')
      .select('id,source,event_type,title,description,region,country_code,severity,status,occurred_at,ingested_at,location::text,provenance_raw,summary_short')
      .gte('occurred_at', topStoriesSince6h)
      .eq('is_humanitarian_report', false)
      .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .not('source', 'in', '("noaa","nasa_eonet","nasa-eonet","usgs")')
      .not('title', 'ilike', '%forest fire notification%')
      .not('title', 'ilike', '%prescribed fire%')
      .not('title', 'ilike', '%guidance on child marriage%')
      .not('event_type', 'eq', 'natural_disaster')
      .order('occurred_at', { ascending: false })
      .limit(20),
  ])

  const hasOrg = !!(orgRes.data?.org_id)
  const allEvents = (windowEvents.data ?? []) as EventRow[]
  let conflictCandidates = (topStories.data ?? []) as EventRow[]

  if (conflictCandidates.length < 5) {
    const topStories24hRes = await supabase
      .from('events')
      .select('id,source,event_type,title,description,region,country_code,severity,status,occurred_at,ingested_at,location::text,provenance_raw,summary_short')
      .gte('occurred_at', topStoriesSince24h)
      .eq('is_humanitarian_report', false)
      .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .not('source', 'in', '("noaa","nasa_eonet","nasa-eonet","usgs")')
      .not('title', 'ilike', '%forest fire notification%')
      .not('title', 'ilike', '%prescribed fire%')
      .not('title', 'ilike', '%guidance on child marriage%')
      .not('event_type', 'eq', 'natural_disaster')
      .order('occurred_at', { ascending: false })
      .limit(20)

    conflictCandidates = (topStories24hRes.data ?? []) as EventRow[]
  }

  // Fetch disaster sources separately — cap at 3 total in Top Stories
  // Only show severity >= 2 NOAA alerts and severity >= 3 EONET/USGS events
  const disasterRes = await supabase
    .from('events')
    .select('id,source,event_type,title,description,region,country_code,severity,status,occurred_at,ingested_at,location::text,provenance_raw,summary_short')
    .gte('occurred_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())  // last 12h only
    .eq('is_humanitarian_report', false)
    .in('source', ['noaa'])                        // NOAA only — usgs/eonet too noisy for top stories
    .gte('severity', 4)                            // CRITICAL weather events only (Red Flag Warning = 3, skip it)
    .not('title', 'ilike', '%green%')
    .order('severity', { ascending: false })
    .order('occurred_at', { ascending: false })
    .limit(3)
  const weatherCandidates = (disasterRes.data ?? []) as EventRow[]

  // Filter out blocklisted titles from top stories
  const filteredConflict = conflictCandidates.filter(e => !isBlocklisted(e.title ?? ''))

  // Pure chronological — newest first, no scoring. BREAKING section handles importance surfacing.
  const sortedConflict = [...filteredConflict].sort((a, b) =>
    new Date(b.occurred_at ?? b.ingested_at ?? 0).getTime() -
    new Date(a.occurred_at ?? a.ingested_at ?? 0).getTime()
  )
  const sortedWeather = [...weatherCandidates].sort((a, b) => {
    const severityDiff = Number(b.severity ?? 1) - Number(a.severity ?? 1)
    if (severityDiff !== 0) return severityDiff
    return new Date(b.occurred_at ?? b.ingested_at ?? 0).getTime() - new Date(a.occurred_at ?? a.ingested_at ?? 0).getTime()
  })
  // Dedup by title — remove near-identical events (e.g. 3x "Green forest fire in Thailand")
  const seenTitles = new Set<string>()
  const dedupedConflict = sortedConflict.filter(e => {
    const key = (e.title ?? '').toLowerCase().trim().slice(0, 60)
    if (seenTitles.has(key)) return false
    seenTitles.add(key)
    return true
  })
  const dedupedWeather = sortedWeather.filter(e => {
    const key = (e.title ?? '').toLowerCase().trim().slice(0, 60)
    if (seenTitles.has(key)) return false
    seenTitles.add(key)
    return true
  })

  // Fuzzy title dedup — skip if first 5 words match an already-seen title
  function titleFingerprint(t: string): string {
    return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 5).join(' ')
  }

  const DISASTER_CAP = 3
  const weatherSlots = Math.min(dedupedWeather.length, DISASTER_CAP)
  const conflictSlots = 20 - weatherSlots
  const stories: EventRow[] = [
    ...dedupedConflict.slice(0, conflictSlots),
    ...dedupedWeather.slice(0, weatherSlots),
  ]

  const seenFingerprints = new Set<string>()
  const dedupedFinal = stories.filter(e => {
    const fp = titleFingerprint(e.title ?? '')
    if (seenFingerprints.has(fp)) return false
    seenFingerprints.add(fp)
    return true
  })

  const lastIngested = (freshRes.data?.ingested_at as string | null) ?? null
  const freshness = computeFreshness(lastIngested)

  const distinctSources = new Set(allEvents.map((e) => e.source).filter(Boolean)).size
  const coverage = computeCoverage(distinctSources, allEvents.length)

  const hotRegions = computeHotRegions(allEvents)

  const notices: string[] = []
  if (freshness.label === 'Stale' || freshness.label === 'Offline') {
    notices.push('Updates are delayed. Core tracking continues. Try refresh.')
  }

  const severityCounts = computeSeverityCounts(allEvents)

  const payload: OverviewResponse = {
    lastUpdatedAt: lastIngested,
    freshnessStatus: freshness.label,
    freshnessDescription: freshness.description,
    freshnessColor: freshness.color,
    coverageLevel: coverage.label,
    coverageTooltip: coverage.tooltip,
    kpis: {
      eventsWindow: allEvents.length,
      events7d: count7dRes.count ?? 0,
      hotRegionCount: hotRegions.length,
      criticalHighCount: critHighRes.count ?? 0,
      developingCount: developingRes.count ?? 0,
      activeAlertsCount: hasOrg ? (alertsRes.count ?? 0) : 0,
      breaking2h: breakingRes.count ?? 0,
    },
    topStories: dedupedFinal.map((story) => ({
      ...story,
      ...sanitizeEventForClient(story as unknown as Record<string, unknown>),
      source: sanitizeEventForClient(story as unknown as Record<string, unknown>).outlet_name,
      ingested_at: story.ingested_at,
      occurred_at: story.occurred_at,
      provenance_raw: null,
    })),
    hotRegions,
    notices,
    hasOrg,
    window: win,
    severityCounts,
  }

  // Cache for 5 minutes (300s)
  await setCachedSnapshot(cacheKey, payload, 300)

  return NextResponse.json(payload)
}
