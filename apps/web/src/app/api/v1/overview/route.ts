import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'
import { isSafeMode } from '@/lib/doctor/safe-mode-check'
import { isBlocklisted } from '@/lib/classification'
import { humanizeDriver, isGeopoliticalType, computeSeverityCounts, sanitizeEventForClient, getRegionDisplay } from '@/lib/event-presentation'

export const dynamic = 'force-dynamic'

interface EventRow {
  id: string
  source: string | null
  source_id?: string | null
  event_type: string | null
  title: string | null
  description: string | null
  summary_short?: string | null
  entities?: unknown[] | null
  region: string | null
  country_code: string | null
  severity: number | null
  status: string | null
  occurred_at: string | null
  ingested_at: string | null
  location: string | null
  provenance_raw: { url?: string; attribution?: string; source?: string; outlet?: string } | null
  raw?: { outlet?: string } | null
  significance_score?: number | null
}

export interface HotRegion {
  region: string
  slug: string
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
    activeConflictZones: number
    mostActiveRegion: string | null
  }
  topStories: EventRow[]
  hotRegions: HotRegion[]
  notices: string[]
  hasOrg: boolean
  window: string
  severityCounts: { critical: number; high: number; medium: number; low: number }
}

function computeFreshness(lastIngestedAt: string | null): {
  label: 'Fresh' | 'Delayed' | 'Stale' | 'Offline'
  description: string
  color: 'green' | 'yellow' | 'orange' | 'red'
} {
  if (!lastIngestedAt) return { label: 'Offline', description: 'No recent data', color: 'red' }
  const ageMs = Date.now() - new Date(lastIngestedAt).getTime()
  const ageMin = Math.floor(ageMs / 60000)
  if (ageMin < 120) return { label: 'Fresh', description: `${ageMin}m ago`, color: 'green' }
  if (ageMin < 720) return { label: 'Delayed', description: `${Math.floor(ageMin / 60)}h ago`, color: 'yellow' }
  return { label: 'Stale', description: `${Math.floor(ageMin / 60)}h ago`, color: 'red' }
}

function computeCoverage(distinctSourceCount: number, eventCount: number): {
  label: 'High' | 'Medium' | 'Low'
  tooltip: string
} {
  if (distinctSourceCount >= 3 && eventCount >= 50) {
    return { label: 'High', tooltip: 'Multiple independent sources confirm activity across regions.' }
  }
  if (distinctSourceCount >= 2 || eventCount >= 20) {
    return { label: 'Medium', tooltip: 'Partial coverage from some sources. Core tracking active.' }
  }
  return { label: 'Low', tooltip: 'Limited source diversity. Tracking may be incomplete.' }
}

const RISK_ORDER: Record<HotRegion['riskLevel'], number> = {
  Critical: 5,
  High: 4,
  Elevated: 3,
  Moderate: 2,
  Monitored: 1,
}

function normalizeRegionSlug(region: string | null | undefined): string {
  return (region ?? 'global').toLowerCase().replace(/\s+/g, '_')
}

function computeHotRegions(events: EventRow[]): HotRegion[] {
  const map = new Map<string, { count: number; sev2: number; geoSev4: number; geoSev3: number; types: Map<string, number>; countries: Set<string> }>()
  const GEO_PLACEHOLDER_REGIONS = new Set(['global', 'world', '', 'un', 'united_nations', 'north_america', 'oceania'])

  for (const event of events) {
    const slug = normalizeRegionSlug(event.region)
    if (GEO_PLACEHOLDER_REGIONS.has(slug)) continue
    const region = getRegionDisplay(slug) ?? event.region ?? 'Global'
    const entry = map.get(slug) ?? { count: 0, sev2: 0, geoSev4: 0, geoSev3: 0, types: new Map(), countries: new Set() }
    entry.count += 1
    const severity = event.severity ?? 1
    if (severity >= 2) entry.sev2 += 1
    if (isGeopoliticalType(event.event_type)) {
      if (severity >= 4) entry.geoSev4 += 1
      else if (severity >= 3) entry.geoSev3 += 1
    }
    if (event.event_type) entry.types.set(event.event_type, (entry.types.get(event.event_type) ?? 0) + 1)
    if (event.country_code) entry.countries.add(event.country_code)
    map.set(slug, entry)
    if (region !== getRegionDisplay(slug)) {
      // no-op; keeps formatter in play without duplicate storage
    }
  }

  const regions: HotRegion[] = []
  for (const [slug, data] of map.entries()) {
    let riskLevel: HotRegion['riskLevel']
    if (data.geoSev4 >= 1) riskLevel = 'Critical'
    else if (data.geoSev3 >= 5) riskLevel = 'Critical'
    else if (data.geoSev3 >= 2) riskLevel = 'High'
    else if (data.geoSev3 >= 1 || data.sev2 >= 10) riskLevel = 'Elevated'
    else if (data.count >= 5) riskLevel = 'Moderate'
    else riskLevel = 'Monitored'

    regions.push({
      region: getRegionDisplay(slug) ?? slug,
      slug,
      riskLevel,
      eventCount: data.count,
      topDrivers: [...data.types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type]) => humanizeDriver(type)),
      topCountries: [...data.countries].slice(0, 5),
    })
  }

  return regions.sort((a, b) => {
    const riskDiff = RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel]
    return riskDiff !== 0 ? riskDiff : b.eventCount - a.eventCount
  }).slice(0, 8)
}

const WINDOW_MS: Record<string, number> = {
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
}

export async function GET(req: Request): Promise<NextResponse<OverviewResponse | { error: string }>> {
  let userId: string | null = null
  try { userId = (await auth())?.userId ?? null } catch { /* Clerk auth unavailable */ }
  const url = new URL(req.url)
  const win = url.searchParams.get('window') ?? '24h'

  if (!WINDOW_MS[win]) return NextResponse.json({ error: 'Invalid window' }, { status: 400 })

  const cacheKey = `cache:overview:${win}`

  if (await isSafeMode()) {
    const safeCached = await getCachedSnapshot<OverviewResponse>(cacheKey)
    if (safeCached) return NextResponse.json(safeCached, { headers: { 'X-Safe-Mode': 'true' } })

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
        activeConflictZones: 0,
        mostActiveRegion: null,
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
  if (cached) return NextResponse.json(cached)

  try {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - WINDOW_MS[win]!).toISOString()
  const since7d = new Date(Date.now() - WINDOW_MS['7d']!).toISOString()
  const topStoriesSince24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [windowEvents, count7dRes, critHighRes, developingRes, freshRes, orgRes, alertsRes, breakingRes, activeConflictZonesRes, mostActiveRegionRpcRes, topStoriesRes] = await Promise.all([
    supabase
      .from('events')
      .select('id,source,source_id,event_type,title,description,summary_short,entities,region,country_code,severity,status,occurred_at,ingested_at,location,provenance_raw,raw,significance_score')
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
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', since7d),
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', since).gte('severity', 3),
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', since).in('status', ['developing', 'pending']),
    supabase.from('events').select('ingested_at').eq('is_humanitarian_report', false).not('source', 'in', '("noaa","nasa_eonet","nasa-eonet","usgs","gdacs")').not('title', 'ilike', '%thunderstorm warning%').not('title', 'ilike', '%weather alert%').not('title', 'ilike', '%red flag warning%').order('ingested_at', { ascending: false, nullsFirst: false }).limit(1).single(),
    userId ? supabase.from('users').select('org_id').eq('clerk_user_id', userId).single() : Promise.resolve({ data: null, error: null }),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('read', false),
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()).gte('severity', 3),
    supabase
      .from('events')
      .select('region')
      .gte('occurred_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .gte('severity', 3)
      .in('event_type', ['conflict', 'armed_conflict', 'airstrike', 'military', 'terrorism'])
      .not('region', 'is', null),
    supabase.rpc('get_most_active_region', {}).then(r => r, () => ({ data: null, error: 'rpc not available' })),
    supabase
      .from('events')
      .select('id,source,source_id,event_type,title,description,summary_short,entities,region,country_code,severity,status,occurred_at,ingested_at,location,provenance_raw,raw,significance_score')
      .gte('occurred_at', topStoriesSince24h)
      .eq('is_humanitarian_report', false)
      .not('source', 'in', '("noaa","nasa_eonet","nasa-eonet","usgs")')
      .not('title', 'ilike', '%forest fire notification%')
      .not('title', 'ilike', '%prescribed fire%')
      .not('title', 'ilike', '%guidance on child marriage%')
      .not('title', 'ilike', '%shopping coupon%')
      .not('title', 'ilike', '%discount voucher%')
      .not('title', 'ilike', '%tornado warning%')
      .not('title', 'ilike', '%severe thunderstorm warning%')
      .not('title', 'ilike', '%flood warning%')
      .not('title', 'ilike', '%winter storm warning%')
      .not('title', 'ilike', '% by NWS%')
      .not('event_type', 'eq', 'natural_disaster')
      .order('occurred_at', { ascending: false })
      .limit(40),
  ])

  const hasOrg = !!orgRes.data?.org_id
  const allEvents = (windowEvents.data ?? []) as EventRow[]
  const conflictCandidates = ((topStoriesRes.data ?? []) as EventRow[]).filter((event) => !isBlocklisted(event.title ?? ''))

  function titleFingerprint(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 5).join(' ')
  }

  const seenFingerprints = new Set<string>()
  const finalTopStories = conflictCandidates.filter((event) => {
    const fingerprint = titleFingerprint(event.title ?? '')
    if (seenFingerprints.has(fingerprint)) return false
    seenFingerprints.add(fingerprint)
    return true
  }).slice(0, 20)

  const hotRegions = computeHotRegions(allEvents)
  const freshness = computeFreshness((freshRes.data?.ingested_at as string | null) ?? null)
  const distinctSources = new Set(allEvents.map((event) => event.source).filter(Boolean)).size
  const coverage = computeCoverage(distinctSources, allEvents.length)
  const severityCounts = computeSeverityCounts(allEvents)

  const regionCounts = allEvents.reduce((acc, event) => {
    if (event.region) acc[event.region] = (acc[event.region] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const computedMostActiveRegion = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const rpcMostActiveRegion = typeof mostActiveRegionRpcRes.data === 'string'
    ? mostActiveRegionRpcRes.data
    : Array.isArray(mostActiveRegionRpcRes.data)
      ? String((mostActiveRegionRpcRes.data[0] as { region?: string } | undefined)?.region ?? '') || null
      : null
  const mostActiveRegionSlug = rpcMostActiveRegion || computedMostActiveRegion
  const activeConflictZones = new Set(((activeConflictZonesRes.data ?? []) as Array<{ region: string | null }>).map((row) => normalizeRegionSlug(row.region)).filter(Boolean)).size

  const notices: string[] = []
  if (freshness.label === 'Stale' || freshness.label === 'Offline') notices.push('Updates are delayed. Core tracking continues. Try refresh.')

  const payload: OverviewResponse = {
    lastUpdatedAt: (freshRes.data?.ingested_at as string | null) ?? null,
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
      activeConflictZones,
      mostActiveRegion: mostActiveRegionSlug ? getRegionDisplay(normalizeRegionSlug(mostActiveRegionSlug)) : null,
    },
    topStories: finalTopStories.map((story) => {
      const sanitized = sanitizeEventForClient(story as unknown as Record<string, unknown>)
      return {
        ...story,
        description: sanitized.description,
        outlet_name: sanitized.outlet_name,
        significance_tier: sanitized.significance_tier,
      }
    }),
    hotRegions,
    notices,
    hasOrg,
    window: win,
    severityCounts,
  }

  await setCachedSnapshot(cacheKey, payload, 60)
  return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Overview computation failed: ${message}` }, { status: 500 })
  }
}

