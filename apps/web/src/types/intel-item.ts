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
  url: string | null
}

export function eventToIntelItem(e: Record<string, unknown>): IntelItem {
  const raw = ((e.provenance_raw ?? e.raw ?? {}) as Record<string, unknown>)
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
    description: (e.description as string) ?? null,
    url: (raw.url as string) ?? null,
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
  return `${Math.floor(h / 24)}d ago`
}

export function severityLabel(s: number | null): string {
  if (!s) return 'UNKNOWN'
  return ['', 'LOW', 'ELEVATED', 'HIGH', 'CRITICAL', 'CRITICAL+'][s] ?? 'UNKNOWN'
}

export function severityColor(s: number | null): string {
  if (!s) return 'var(--text-muted)'
  return ['', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#FF0000'][s] ?? 'var(--text-muted)'
}
