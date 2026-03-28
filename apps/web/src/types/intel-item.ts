export type IntelItem = {
  id: string
  kind: 'event' | 'evidence'
  title: string
  source: string
  country_code: string | null
  region: string | null
  severity: number | null
  event_type: string | null
  occurred_at: string | null
  ingested_at: string
  description: string | null
  snippet?: string | null
  url: string | null
  location?: string | null
  _corroborated_by?: string[]
  _source_count?: number
  _confidence?: 'confirmed' | 'corroborated' | 'unverified'
}

/** Extract source URL from provenance_raw for any source format */
function extractUrl(raw: Record<string, unknown>): string | null {
  // Direct url field
  if (raw.url) return String(raw.url)
  // GDELT uses ActionGeo_SourceURL or SOURCEURL
  if (raw.SOURCEURL) return String(raw.SOURCEURL)
  if (raw.ActionGeo_SourceURL) return String(raw.ActionGeo_SourceURL)
  // ReliefWeb
  if (raw.fields && typeof raw.fields === 'object') {
    const f = raw.fields as Record<string, unknown>
    if (f.url) return String(f.url)
    if (f.origin) return String(f.origin)
  }
  // NASA EONET
  if (Array.isArray(raw.sources) && raw.sources.length > 0) {
    const s = (raw.sources as Array<Record<string, unknown>>)[0]
    if (s?.url) return String(s.url)
  }
  // GDACS
  if (raw.link) return String(raw.link)
  return null
}

/** Extract description from provenance_raw if DB description field is null */
function extractDesc(raw: Record<string, unknown>): string | null {
  if (raw.description) return String(raw.description).slice(0, 500)
  if (raw.body) return String(raw.body).slice(0, 500)
  // ReliefWeb
  if (raw.fields && typeof raw.fields === 'object') {
    const f = raw.fields as Record<string, unknown>
    if (f.body) return String(f.body).slice(0, 500)
  }
  // GDACS
  if (raw.summary) return String(raw.summary).slice(0, 500)
  return null
}

export function eventToIntelItem(e: Record<string, unknown>): IntelItem {
  const raw = ((e.provenance_raw ?? e.raw ?? {}) as Record<string, unknown>)
  const desc = (e.description as string) ?? extractDesc(raw) ?? null
  const snippetRaw = (e.snippet as string) ?? null
  // Ensure description never shows placeholder text
  const BAD_DESC = new Set(['No description provided', 'N/A', 'null', 'undefined'])
  const cleanDesc = desc && !BAD_DESC.has(desc.trim()) ? desc : null
  const displaySnippet = snippetRaw || cleanDesc?.slice(0, 200) || null
  return {
    id: String(e.id ?? ''),
    kind: 'event',
    title: String(e.title ?? 'Untitled'),
    source: String(e.source ?? ''),
    country_code: (e.country_code as string) ?? null,
    region: (e.region as string) ?? null,
    severity: typeof e.severity === 'number' ? e.severity : null,
    event_type: (e.event_type as string) ?? null,
    occurred_at: (e.occurred_at as string) ?? null,
    ingested_at: String(e.ingested_at ?? new Date().toISOString()),
    description: cleanDesc ?? String(e.title ?? 'Untitled'),
    snippet: displaySnippet,
    url: extractUrl(raw),
    location: (e.location as string) ?? null,
    _corroborated_by: (e._corroborated_by as string[]) ?? undefined,
    _source_count: typeof e._source_count === 'number' ? e._source_count : undefined,
    _confidence: (e._confidence as 'confirmed' | 'corroborated' | 'unverified') ?? undefined,
  }
}

export function safeTimeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Unknown time'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'Unknown time'
  const m = Math.floor((Date.now() - d.getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function severityLabel(s: number | null): string {
  if (!s) return 'UNKNOWN'
  return ['', 'LOW', 'ELEVATED', 'HIGH', 'CRITICAL', 'CRITICAL+'][s] ?? 'UNKNOWN'
}

export function severityColor(s: number | null): string {
  if (!s) return 'var(--text-muted)'
  return ['', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#FF0000'][s] ?? 'var(--text-muted)'
}
