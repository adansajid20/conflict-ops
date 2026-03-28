import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { isSafeMode, getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'
import { clusterEvents } from '@/lib/ingest/dedup'
import type { ApiResponse, ConflictEvent } from '@conflict-ops/shared'

export async function GET(req: Request): Promise<NextResponse<ApiResponse<ConflictEvent[]>>> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const countryCode = url.searchParams.get('country')
  const source = url.searchParams.get('source')
  const severity = url.searchParams.get('severity')
  const search = url.searchParams.get('search')
  const window = url.searchParams.get('window')
  const since = url.searchParams.get('since')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  let sinceParam = since
  if (!sinceParam && window) {
    const msMap: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
    const ms = msMap[window] ?? 86400000
    sinceParam = new Date(Date.now() - ms).toISOString()
  }

  const cacheKey = `events:${countryCode ?? 'all'}:${source ?? 'all'}:${severity ?? 'all'}:${search ?? ''}:${limit}:${offset}`

  const safe = await isSafeMode()
  if (safe) {
    const cached = await getCachedSnapshot<ConflictEvent[]>(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        meta: { safe_mode: true, cached: true },
      })
    }
  }

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('org_id')
    .eq('clerk_user_id', userId)
    .single()

  let query = supabase
    .from('events')
    .select('id,source,event_type,title,description,region,country_code,severity,status,occurred_at,ingested_at,provenance_raw,provenance_inferred,location::text')
    .not('status', 'eq', 'clustered')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const historyDays = user?.org_id
    ? (await getOrgPlanLimits(user.org_id)).historyDays
    : 30
  if (historyDays !== -1) {
    const cutoff = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('occurred_at', cutoff)
  }

  const severityMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  const severityInt = severity ? (parseInt(severity) || severityMap[severity.toLowerCase()] || null) : null

  if (countryCode) query = query.eq('country_code', countryCode)
  if (severityInt) query = query.eq('severity', severityInt)
  if (source) query = query.eq('source', source)
  if (search) query = query.ilike('title', `%${search}%`)
  if (sinceParam) query = query.gte('occurred_at', sinceParam)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const rawEvents = (data ?? []) as unknown as ConflictEvent[]

  // --- FIX 1: Filter to conflict-relevant events only (guards against pre-gate DB pollution) ---
  const RELEVANT_TYPES = [
    'airstrike', 'armed_conflict', 'terrorism', 'political_crisis',
    'civil_unrest', 'displacement', 'humanitarian', 'wmd_threat',
    'natural_disaster', 'economic',
  ]
  const AUTHORITATIVE_SOURCES = ['noaa', 'acled', 'usgs', 'gdacs', 'unhcr', 'nasa_eonet', 'reliefweb']
  const relevantData = rawEvents.filter(e =>
    AUTHORITATIVE_SOURCES.includes((e as unknown as Record<string,unknown>).source as string) || // authoritative sources always pass
    RELEVANT_TYPES.includes((e as unknown as Record<string,unknown>).event_type as string) ||
    ((e as unknown as Record<string,unknown>).severity as number ?? 0) >= 2 ||
    (e as unknown as Record<string,unknown>).country_code !== null
  )

  // --- FIX 2: Snippet fallback — description is never blank or "No description provided" ---
  const eventsWithSnippet = relevantData.map(e => {
    const raw = e as unknown as Record<string,unknown>
    const desc = raw.description as string | null | undefined
    const title = raw.title as string
    return {
      ...raw,
      description: desc && desc.trim() && desc !== 'No description provided'
        ? desc
        : title.length > 80
          ? `${title.slice(0, 160)}…`
          : title,
    } as unknown as ConflictEvent
  })

  // --- FIX 3: Geo cleanup — remove "UN" and placeholder location strings ---
  const GEO_PLACEHOLDERS = ['UN', 'United Nations', 'N/A', 'Unknown', 'Global', 'World']
  const cleanedEvents = eventsWithSnippet.map(e => {
    const raw = e as unknown as Record<string,unknown>
    const region = raw.region as string | null
    const cc = raw.country_code as string | null
    return {
      ...raw,
      region: (region && !GEO_PLACEHOLDERS.includes(region)) ? region : null,
      country_code: (cc && cc.length === 2 && cc !== 'UN') ? cc : null,
    } as unknown as ConflictEvent
  })

  // Cluster events to deduplicate cross-source stories and add confidence signals
  const clustered = clusterEvents(cleanedEvents as unknown as Array<{
    title: string
    occurred_at: string
    source: string
    event_type: string
    region: string | null
    country_code: string | null
  } & ConflictEvent>)

  // Map back to the expected response format, adding corroboration metadata
  const events = clustered.map(({ canonical, corroborated_by, source_count, confidence }) => ({
    ...(canonical as ConflictEvent),
    _corroborated_by: corroborated_by,
    _source_count: source_count,
    _confidence: confidence,
  }))

  await setCachedSnapshot(cacheKey, events, TTL.FEED)

  return NextResponse.json({ success: true, data: events })
}
