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
    .order('ingested_at', { ascending: false })
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
  // Exclude weather/earthquake/fire sources from Intel Feed default "All" view —
  // they belong on the globe. Users can still filter by source explicitly.
  if (!source) {
    query = query.not('source', 'in', '("noaa","usgs","nasa-eonet","nasa_eonet")')
  }
  // Use ingested_at for time window filtering — news articles are published hours/days ago
  // but ingested NOW. Filtering by occurred_at would exclude all news from the 1h/6h window.
  if (sinceParam) query = query.gte('ingested_at', sinceParam)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const rawEvents = (data ?? []) as unknown as ConflictEvent[]

  // --- FIX 1: Strict relevance gate — only conflict/security-relevant events pass ---

  // Hard-block consumer/entertainment topics — these NEVER pass regardless of other signals
  const BLOCK_PATTERNS = /\b(playstation|xbox|nintendo|gaming|PS5|PS4|iphone|android|samsung|apple\s+watch|airpods|headphones?|sneakers?|fashion|celebrity|antique|auction|recipe|cooking|travel\s+tips?|vacation|real\s+estate|mortgage|stock\s+tip|crypto\s+pump|NFT|metaverse|fortnite|minecraft|esports?|football\s+scores?|soccer\s+match|basketball\s+game|baseball|tennis\s+championship|golf\s+tournament|olympic\s+games?|F1\s+race|nascar|wrestling\s+event|beauty\s+tips?|skincare|makeup|weight\s+loss|diet\s+pill|energy\s+crunch|energy\s+prices?|energy\s+market|power\s+grid\s+shortage|utility\s+rates?|electricity\s+prices?|weathering\s+europe|energy\s+transition|oil\s+prices?|gas\s+prices?|stock\s+market|inflation\s+rate|recession|trade\s+deficit|central\s+bank\s+rate|interest\s+rates?)\b/i

  // Numeric relevance scoring
  const ALLOWED_CATEGORIES = new Set([
    'armed_conflict', 'airstrike', 'terrorism', 'coup', 'civil_unrest', 'protest',
    'political_crisis', 'sanctions', 'ceasefire', 'diplomacy', 'wmd_threat',
    'humanitarian_crisis', 'natural_disaster', 'security', 'cyber',
    'displacement', 'humanitarian', 'border_incident', 'maritime_incident',
    'aviation_incident', 'military', 'mobilization', 'explosion', 'attack',
  ])

  const AUTH_SOURCES_SET = new Set(['gdacs', 'reliefweb', 'unhcr', 'usgs', 'noaa', 'nasa_eonet', 'acled'])

  function computeRelevanceScore(e: Record<string, unknown>): number {
    const text = `${String(e.title ?? '')} ${String(e.description ?? '')}`.toLowerCase()
    if (BLOCK_PATTERNS.test(text)) return 0

    let score = 0.3
    const src = String(e.source ?? '')
    const evType = String(e.event_type ?? '')
    const sev = Number(e.severity ?? 0)

    if (AUTH_SOURCES_SET.has(src)) score += 0.25
    if (ALLOWED_CATEGORIES.has(evType)) score += 0.25
    // Stronger boost for events already classified as a specific conflict type (not just 'news')
    if (evType !== 'news' && ALLOWED_CATEGORIES.has(evType)) score += 0.1
    if (CONFLICT_KEYWORDS.test(text)) score += 0.25
    if (sev >= 3) score += 0.1
    if (sev >= 4) score += 0.1

    return Math.min(score, 1.0)
  }

  const MIN_RELEVANCE = 0.45

  const INTEL_FEED_TYPES = new Set([
    'armed_conflict', 'airstrike', 'military', 'mobilization', 'ceasefire',
    'civil_unrest', 'protest', 'terrorism', 'explosion', 'attack',
    'political_crisis', 'sanctions', 'diplomacy', 'coup',
    'border_incident', 'maritime_incident', 'aviation_incident',
    'natural_disaster', 'humanitarian_crisis',
    // legacy types from existing ingest
    'displacement', 'humanitarian', 'wmd_threat', 'economic',
    'news', // kept but filtered by keyword below
  ])
  const AUTHORITATIVE_SOURCES_SET = new Set([
    'gdacs', 'unhcr', 'nasa_eonet', 'usgs', 'noaa', 'acled', 'reliefweb',
  ])
  const CONFLICT_KEYWORDS = /\b(war|conflict|attack|airstrike|bomb|missile|troops|military|soldiers|killed|casualties|rebels|insurgent|terrorist|ceasefire|sanctions|coup|invasion|siege|massacre|protest|riot|gunfire|explosion|hostage|refugee|displaced|evacuation|nuclear|chemical|weapon|navy|army|airforce|NATO|peacekeep|humanitarian|aid|crisis|emergency|threat|escalat)\b/i

  function passesRelevanceGate(e: Record<string, unknown>): boolean {
    const src = String(e.source ?? '')
    const evType = String(e.event_type ?? '')
    const title = String(e.title ?? '')
    const desc = String(e.description ?? '')
    const sev = Number(e.severity ?? 0)
    // Authoritative sources always pass
    if (AUTHORITATIVE_SOURCES_SET.has(src)) return true
    // For unverified news sources, REQUIRE conflict keywords regardless of severity
    // (severity is self-reported by ingest and may be wrong)
    const isNewsSrc = src === 'news_rss' || src === 'gdelt' || src === 'newsapi'
    if (isNewsSrc) {
      if (!CONFLICT_KEYWORDS.test(title) && !CONFLICT_KEYWORDS.test(desc)) return false
    } else {
      // Non-news: high severity passes
      if (sev >= 3) return true
    }
    // Check event type
    if (INTEL_FEED_TYPES.has(evType)) {
      // 'news' type from non-authoritative sources requires keyword match
      if (evType === 'news') return CONFLICT_KEYWORDS.test(title) || CONFLICT_KEYWORDS.test(desc)
      return true
    }
    // Keyword fallback for anything else
    return CONFLICT_KEYWORDS.test(title) || CONFLICT_KEYWORDS.test(desc)
  }

  // First pass: hard gate (existing logic)
  const hardGated = rawEvents.filter(e => passesRelevanceGate(e as unknown as Record<string, unknown>))
  // Second pass: numeric score gate — block hard-blocked consumer content
  const relevantData = hardGated.filter(e => computeRelevanceScore(e as unknown as Record<string, unknown>) >= MIN_RELEVANCE)

  // --- FIX 2: Snippet field — never blank, never "No description provided" ---
  const BAD_DESCRIPTIONS = new Set(['No description provided', 'N/A', '', 'null', 'undefined'])
  const eventsWithSnippet = relevantData.map(e => {
    const raw = e as unknown as Record<string,unknown>
    const desc = (raw.description as string | null | undefined)?.trim() ?? ''
    const title = raw.title as string
    const cleanDesc = BAD_DESCRIPTIONS.has(desc) ? '' : desc
    const snippet = cleanDesc.length > 10 ? cleanDesc.slice(0, 200) : title.slice(0, 200)
    return {
      ...raw,
      description: cleanDesc || title,
      snippet,
    } as unknown as ConflictEvent
  })

  // --- FIX 3: Geo cleanup — remove "UN" and placeholder location strings ---
  const GEO_PLACEHOLDERS = new Set(['UN', 'United Nations', 'N/A', 'Unknown', 'Global', 'World', '', 'null'])
  const cleanedEvents = eventsWithSnippet.map(e => {
    const raw = e as unknown as Record<string,unknown>
    const region = (raw.region as string | null) ?? ''
    const cc = (raw.country_code as string | null) ?? ''
    return {
      ...raw,
      region: (region && !GEO_PLACEHOLDERS.has(region)) ? region : null,
      country_code: (cc && cc.length === 2 && !GEO_PLACEHOLDERS.has(cc)) ? cc : null,
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
    _relevance_score: computeRelevanceScore(canonical as unknown as Record<string, unknown>),
  }))

  await setCachedSnapshot(cacheKey, events, TTL.FEED)

  return NextResponse.json({ success: true, data: events })
}
