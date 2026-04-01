import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { isIPAllowed, extractRequestIp } from '@/lib/security/ip-check'
import { getCachedSnapshot, setCachedSnapshot, TTL } from '@/lib/cache/redis'
import { isSafeMode } from '@/lib/doctor/safe-mode-check'
import { clusterEvents } from '@/lib/ingest/dedup'
import { isBlocklisted } from '@/lib/classification'
import { getBestDescription, getEffectiveType, isStaleReliefWebContent, sanitizeEventForClient } from '@/lib/event-presentation'
import type { ApiResponse, ConflictEvent } from '@conflict-ops/shared'

export async function GET(req: Request): Promise<NextResponse> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const countryCode = url.searchParams.get('country')
  const source = url.searchParams.get('source')
  const severity = url.searchParams.get('severity')
  const search = url.searchParams.get('search')
  const language = url.searchParams.get('lang')
  const window = url.searchParams.get('window')
  const since = url.searchParams.get('since')
  const rawMode = url.searchParams.get('raw') === 'true'
  const includeHumanitarian = url.searchParams.get('include_humanitarian') === 'true'
  const humanitarianOnly = url.searchParams.get('type') === 'humanitarian_only'
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  let sinceParam = since
  if (!sinceParam && window) {
    const msMap: Record<string, number> = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
    const ms = msMap[window] ?? 86400000
    sinceParam = new Date(Date.now() - ms).toISOString()
  }

  const cacheKey = `cache:events:${countryCode ?? 'all'}:${source ?? 'all'}:${severity ?? 'all'}:${search ?? ''}:${language ?? 'all'}:${rawMode ? 'raw' : 'intel'}:${limit}:${offset}`

  const safe = await isSafeMode()
  if (safe) {
    const cached = await getCachedSnapshot<ConflictEvent[]>(cacheKey)
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        meta: { safe_mode: true, cached: true },
      }, {
        headers: { 'X-Safe-Mode': 'true' },
      })
    }

    return NextResponse.json({
      success: true,
      data: [] as ConflictEvent[],
      meta: { safe_mode: true, cached: false },
    }, {
      headers: { 'X-Safe-Mode': 'true' },
    })
  }

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('org_id')
    .eq('clerk_user_id', userId)
    .single()

  if (user?.org_id) {
    const requestIp = extractRequestIp(req)
    const allowed = await isIPAllowed(user.org_id, requestIp)
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'IP not allowed for this organization.' }, { status: 403 })
    }

    const [{ data: orgData }, limits] = await Promise.all([
      supabase.from('orgs').select('overage_policy').eq('id', user.org_id).single(),
      getOrgPlanLimits(user.org_id),
    ])

    const eventCap = limits.dataRetentionDays === -1 ? -1 : limits.dataRetentionDays * 100
    if (orgData?.overage_policy === 'cap' && eventCap !== -1) {
      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
      const { count } = await supabase.from('events').select('id', { count: 'exact', head: true }).gte('ingested_at', monthStart)
      if ((count ?? 0) >= eventCap) {
        return NextResponse.json({ success: false, error: 'Event limit reached. Upgrade or change overage policy.' }, { status: 429 })
      }
    }
  }

  let query = supabase
    .from('events')
    .select('id,source,source_id,event_type,title,description,description_translated,description_lang,region,country_code,severity,status,occurred_at,published_at,created_at,ingested_at,provenance_raw,provenance_inferred,location::text,significance_score,intelligence_summary,summary_short,summary_full,content,entities,analyzed_at,escalation_indicator,cluster_id,outlet_name,location_confidence,key_actors,source_url,corroboration_count,is_humanitarian_report')
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
  if (language) query = query.eq('description_lang', language)
  if (!rawMode) query = query.or('significance_score.gte.40,significance_score.is.null')
  if (!includeHumanitarian && !humanitarianOnly) query = query.eq('is_humanitarian_report', false)
  if (humanitarianOnly) query = query.eq('is_humanitarian_report', true)
  // Exclude weather/earthquake/fire sources from Intel Feed default "All" view —
  // they belong on the globe. Users can still filter by source explicitly.
  if (!source) {
    query = query.not('source', 'in', '("noaa","usgs","nasa-eonet","nasa_eonet")')
  }
  // Use ingested_at for time window filtering — news articles are published hours/days ago
  // but ingested NOW. Filtering by occurred_at would exclude all news from the 1h/6h window.
  if (sinceParam) query = query.gte('ingested_at', sinceParam)
  // Also require occurred_at within 30 days — prevents heartbeat-corrupted old events
  // (forest fires from March 22, WHO Nov 2025) from appearing in short time windows
  if (sinceParam) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('occurred_at', thirtyDaysAgo)
  }


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

  // Tighter stale filter for ReliefWeb/UNHCR — cap at 7 days (they publish old reports constantly)
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const staleFiltered = !source ? rawEvents.filter(e => {
    const raw = e as unknown as Record<string, unknown>
    const src = String(raw.source ?? '')
    if (src === 'reliefweb' || src === 'unhcr') {
      const ts = String(raw.occurred_at ?? '')
      return ts ? new Date(ts).getTime() > sevenDaysAgoMs : true
    }
    return true
  }) : rawEvents

  // First pass: hard gate (existing logic)
  const hardGated = staleFiltered.filter(e => passesRelevanceGate(e as unknown as Record<string, unknown>))
  // Second pass: numeric score gate — block hard-blocked consumer content
  const relevantData = hardGated.filter(e => computeRelevanceScore(e as unknown as Record<string, unknown>) >= MIN_RELEVANCE)
  // Third pass: shared blocklist — catch any remaining consumer/entertainment noise
  const blocklistGated = relevantData.filter(e => !isBlocklisted(String((e as unknown as Record<string,unknown>).title ?? '')))

  // --- FIX 2: Snippet field — never blank, never "No description provided" ---
  // Use shared getBestDescription for clean ReliefWeb/UNHCR handling
  const eventsWithSnippet = blocklistGated.map(e => {
    const raw = e as unknown as Record<string,unknown>
    const src = String(raw.source ?? '')
    // For ReliefWeb/UNHCR: use shared stale content cleaner
    const isReliefSource = src === 'reliefweb' || src === 'unhcr'
    const desc = ((raw.description_translated as string | null | undefined) ?? (raw.description as string | null | undefined))?.trim() ?? ''
    const title = String(raw.title ?? '')

    let cleanDesc: string
    if (isReliefSource && isStaleReliefWebContent(desc)) {
      cleanDesc = title
    } else {
      cleanDesc = getBestDescription(
        { description: desc, title, source: src } as Parameters<typeof getBestDescription>[0],
        400
      )
    }

    const snippet = cleanDesc.length > 10 ? cleanDesc.slice(0, 200) : title.slice(0, 200)
    return {
      ...raw,
      description: cleanDesc || title,
      description_lang: (raw.description_lang as string | null | undefined) ?? null,
      snippet,
      // Expose effective_type for category alignment groundwork
      effective_type: getEffectiveType(raw.event_type as string | null),
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
  const events = clustered.map(({ canonical, corroborated_by, source_count, confidence }) => {
    const base = canonical as unknown as Record<string, unknown>
    if (rawMode) {
      return {
        ...base,
        _corroborated_by: corroborated_by,
        _source_count: source_count,
        _confidence: confidence,
        _relevance_score: computeRelevanceScore(base),
      }
    }
    return {
      ...sanitizeEventForClient({
        ...base,
        corroboration_count: typeof base.corroboration_count === 'number' ? base.corroboration_count : source_count,
      }),
      source: sanitizeEventForClient(base).outlet_name,
      region: base.region ?? null,
      country_code: base.country_code ?? null,
      location: base.location ?? null,
      event_type: base.event_type ?? null,
      significance_score: undefined,
      intelligence_summary: base.summary_short ?? base.intelligence_summary ?? null,
      snippet: sanitizeEventForClient(base).description,
      _corroborated_by: corroborated_by.map((entry) => sanitizeEventForClient({ source: entry, title: entry }).outlet_name),
      _source_count: source_count,
      _confidence: confidence,
      ingested_at: typeof base.published_at === 'string' ? base.published_at : (typeof base.occurred_at === 'string' ? base.occurred_at : (typeof base.created_at === 'string' ? base.created_at : null)),
      occurred_at: typeof base.published_at === 'string' ? base.published_at : (typeof base.occurred_at === 'string' ? base.occurred_at : (typeof base.created_at === 'string' ? base.created_at : null)),
      description_lang: null,
      provenance_raw: null,
      entities: { actors: Array.isArray(base.key_actors) ? base.key_actors : [] },
      location_confidence: sanitizeEventForClient(base).location_confidence_label,
      outlet_name: sanitizeEventForClient(base).outlet_name,
      source_url: sanitizeEventForClient(base).source_url,
      summary_short: base.summary_short ?? null,
      key_actors: Array.isArray(base.key_actors) ? base.key_actors : null,
      corroboration_count: typeof base.corroboration_count === 'number' ? base.corroboration_count : source_count,
      is_humanitarian_report: Boolean(base.is_humanitarian_report),
    }
  })

  await setCachedSnapshot(cacheKey, events, TTL.FEED)

  return NextResponse.json({ success: true, data: events })
}
