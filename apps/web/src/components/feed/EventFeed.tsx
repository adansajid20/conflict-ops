'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { AlertTriangle, Bell, Copy, Download, ExternalLink, Pin, RefreshCw, Search, SortDesc, X, Clock } from 'lucide-react'
import { getFreshnessStatus } from '@/lib/utils/freshness'
import { getOutletDisplay } from '@/lib/utils/outlet'
import { getRegionDisplay } from '@/lib/event-presentation'

type FeedEvent = {
  id: string
  source?: string | null
  source_id?: string | null
  title: string
  description?: string | null
  snippet?: string | null
  summary_short?: string | null
  summary_full?: string | null
  severity?: number | null
  region?: string | null
  occurred_at?: string | null
  ingested_at?: string | null
  event_type?: string | null
}

type RelatedResponse = { related?: Array<Pick<FeedEvent, 'id' | 'title' | 'occurred_at' | 'region' | 'severity'>> }

type FeedResponse = { data?: FeedEvent[] }

type TimeWindow = '1h' | '6h' | '24h' | '7d' | '30d'
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'
type CategoryFilter = 'all' | 'conflict' | 'airstrikes' | 'political' | 'humanitarian' | 'disasters' | 'cyber' | 'nuclear'
type SortMode = 'newest' | 'severity'
type DetailTab = 'brief' | 'raw' | 'related'

const TIME_WINDOWS: TimeWindow[] = ['1h', '6h', '24h', '7d', '30d']
const CATEGORY_OPTIONS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'conflict', label: 'Conflict' },
  { key: 'airstrikes', label: 'Airstrikes' },
  { key: 'political', label: 'Political' },
  { key: 'humanitarian', label: 'Humanitarian' },
  { key: 'disasters', label: 'Disasters' },
  { key: 'cyber', label: 'Cyber' },
  { key: 'nuclear', label: 'Nuclear' },
]

const SEVERITY_ORDER: SeverityFilter[] = ['all', 'critical', 'high', 'medium', 'low']

const AlertTriangleIcon = AlertTriangle as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const BellIcon = Bell as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const CopyIcon = Copy as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const DownloadIcon = Download as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const ExternalLinkIcon = ExternalLink as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const PinIcon = Pin as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const SearchIcon = Search as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const XIcon = X as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const RefreshIcon = RefreshCw as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const SortIcon = SortDesc as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const ClockIcon = Clock as unknown as ComponentType<{ className?: string; style?: CSSProperties }>

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function toTitleCase(title: string) {
  if (!title) return ''
  const looksUpper = title === title.toUpperCase() && /[A-Z]/.test(title)
  if (!looksUpper) return title
  return title.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function getSeverityMeta(severity?: number | null) {
  const value = severity ?? 1
  if (value >= 4) return { label: 'CRITICAL', chip: 'text-red-300 bg-red-500/15 border-red-500/40', border: 'border-l-red-500', dot: 'bg-red-500' }
  if (value === 3) return { label: 'HIGH', chip: 'text-orange-300 bg-orange-500/15 border-orange-500/40', border: 'border-l-orange-500', dot: 'bg-orange-500' }
  if (value === 2) return { label: 'MEDIUM', chip: 'text-yellow-300 bg-yellow-500/15 border-yellow-500/40', border: 'border-l-yellow-500', dot: 'bg-yellow-500' }
  return { label: 'LOW', chip: 'text-green-300 bg-green-500/15 border-green-500/40', border: 'border-l-green-500', dot: 'bg-green-500' }
}

function matchesSeverity(event: FeedEvent, filter: SeverityFilter) {
  if (filter === 'all') return true
  const sev = event.severity ?? 1
  if (filter === 'critical') return sev === 4
  if (filter === 'high') return sev === 3
  if (filter === 'medium') return sev === 2
  if (filter === 'low') return sev === 1
  return true
}

function matchesCategory(event: FeedEvent, category: CategoryFilter) {
  if (category === 'all') return true
  const value = `${event.event_type ?? ''} ${event.title ?? ''} ${event.description ?? ''}`.toLowerCase()
  if (category === 'conflict') return /(conflict|armed_conflict|attack|military|mobilization|terror|ceasefire|explosion)/.test(value)
  if (category === 'airstrikes') return /(airstrike|missile|drone|strike|bombard|rocket)/.test(value)
  if (category === 'political') return /(politic|coup|sanction|diplom|government|election)/.test(value)
  if (category === 'humanitarian') return /(humanitarian|displacement|aid|refugee|relief|famine)/.test(value)
  if (category === 'disasters') return /(disaster|earthquake|flood|wildfire|storm|cyclone|fire)/.test(value)
  if (category === 'cyber') return /(cyber|hack|malware|ransomware)/.test(value)
  if (category === 'nuclear') return /(nuclear|iaea|radiation|reactor|enrichment)/.test(value)
  return true
}

function relativeTime(timestamp?: string | null) {
  if (!timestamp) return 'Unknown'
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const mins = Math.max(0, Math.floor(diffMs / 60000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatRegion(region?: string | null) {
  return getRegionDisplay(region ?? null) ?? (region ? region.replace(/_/g, ' ') : 'Global')
}

function escCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function exportCsv(events: FeedEvent[]) {
  const header = ['id', 'title', 'severity', 'event_type', 'region', 'occurred_at', 'source', 'source_url', 'summary']
  const rows = events.map((event) => [
    escCsv(event.id),
    escCsv(event.title ?? ''),
    String(event.severity ?? 1),
    escCsv(event.event_type ?? 'general'),
    escCsv(event.region ?? ''),
    event.occurred_at ?? '',
    escCsv(event.source ?? ''),
    escCsv(event.source_id ?? ''),
    escCsv(event.summary_short ?? event.snippet ?? event.description ?? ''),
  ])
  const blob = new Blob([[header.join(','), ...rows.map((row) => row.join(','))].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `intel-feed-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function BreakingBanner({ events }: { events: FeedEvent[] }) {
  const [dismissed, setDismissed] = useState(false)
  const breaking = useMemo(() => events.filter((event) => (event.severity ?? 1) === 4 && event.occurred_at && (Date.now() - new Date(event.occurred_at).getTime()) <= 15 * 60 * 1000).slice(0, 3), [events])
  if (dismissed || breaking.length === 0) return null
  return (
    <div className="sticky top-0 z-20 mb-3 flex items-center gap-3 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-4 py-3 text-sm text-red-100">
      <AlertTriangleIcon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 truncate">
        <span className="mr-2 text-[10px] tracking-[0.2em] font-medium text-red-400">BREAKING</span>
        {breaking.map((event) => toTitleCase(event.title)).join(' • ')}
      </div>
      <button onClick={() => setDismissed(true)} className="rounded p-1 hover:bg-white/10" aria-label="Dismiss breaking banner">
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  )
}

function FeedSidebar({ events, onSelect }: { events: FeedEvent[]; onSelect: (event: FeedEvent) => void }) {
  const hotRegions = useMemo(() => Object.entries(events.reduce<Record<string, number>>((acc, event) => {
    const key = event.region ?? 'global'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6), [events])
  const breaking = useMemo(() => events.filter((event) => event.occurred_at && (Date.now() - new Date(event.occurred_at).getTime()) <= 30 * 60 * 1000).slice(0, 5), [events])
  const critical = useMemo(() => events.filter((event) => (event.severity ?? 1) === 4).slice(0, 5), [events])

  return (
    <aside className="space-y-4">
      <section className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.15em] font-medium text-white/20">Hot Regions</div>
        <div className="space-y-2">
          {hotRegions.map(([region, count]) => (
            <div key={region}>
              <div className="mb-1 flex items-center justify-between text-[12px] text-white/50">
                <span>{formatRegion(region)}</span>
                <span className="text-white/30 tabular-nums">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.max(12, (count / Math.max(hotRegions[0]?.[1] ?? 1, 1)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.15em] font-medium text-white/20">Breaking Events</div>
        <div className="space-y-2">
          {breaking.length === 0 ? <div className="text-[12px] text-white/25">No breaking events in the last 30 minutes.</div> : breaking.map((event) => <button key={event.id} onClick={() => onSelect(event)} className="block w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06] transition-colors duration-150"><div className="text-[12px] font-medium text-white/80">{toTitleCase(event.title)}</div><div className="mt-1 text-[11px] text-white/20">{formatRegion(event.region)} · {relativeTime(event.occurred_at)}</div></button>)}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.15em] font-medium text-white/20">Critical Events</div>
        <div className="space-y-2">
          {critical.length === 0 ? <div className="text-[12px] text-white/25">No critical events in scope.</div> : critical.map((event) => <button key={event.id} onClick={() => onSelect(event)} className="block w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06] transition-colors duration-150"><div className="text-[12px] font-medium text-white/80">{toTitleCase(event.title)}</div><div className="mt-1 text-[11px] text-white/25">{getOutletDisplay(event.source, event.source_id)}</div></button>)}
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
        <div className="mb-3 text-[10px] uppercase tracking-[0.15em] font-medium text-white/20">Data Sources</div>
        <div className="space-y-2 text-[11px] text-white/25">
          <div className="flex justify-between"><span>RSS</span><span>155 active</span></div>
          <div className="flex justify-between"><span>GDELT</span><span>15m</span></div>
          <div className="flex justify-between"><span>ACLED</span><span>15m</span></div>
          <div className="flex justify-between"><span>ReliefWeb</span><span>30m</span></div>
        </div>
      </section>
    </aside>
  )
}

function EventDetailPanel({ events, selectedIndex, onClose, onNavigate }: { events: FeedEvent[]; selectedIndex: number; onClose: () => void; onNavigate: (next: number) => void }) {
  const event = events[selectedIndex]
  const [tab, setTab] = useState<DetailTab>('brief')
  const [related, setRelated] = useState<RelatedResponse['related']>([])

  useEffect(() => {
    setTab('brief')
    setRelated([])
  }, [event?.id])

  useEffect(() => {
    if (!event?.id) return
    fetch(`/api/v1/events/${event.id}/related`)
      .then((response) => response.json() as Promise<RelatedResponse>)
      .then((json) => setRelated(json.related ?? []))
      .catch(() => setRelated([]))
  }, [event?.id])

  if (!event) return null
  const severity = getSeverityMeta(event.severity)
  const freshness = event.occurred_at ? getFreshnessStatus(event.occurred_at) : null
  const sourceLink = event.source_id ?? undefined

  return (
    <div className="fixed inset-0 z-40 bg-black/60 p-4 md:p-8" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0C1220]" onClick={(eventClick) => eventClick.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', severity.chip)}>{severity.label}</span>
            <span className="rounded-full border border-white/[0.06] px-2.5 py-1 text-xs text-white/70">{event.event_type ?? 'general'}</span>
            {freshness ? <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', freshness.color)}>{freshness.label}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={selectedIndex <= 0} onClick={() => onNavigate(selectedIndex - 1)} className="rounded border border-white/[0.06] px-2 py-1 text-xs text-white/70 disabled:opacity-30">Prev</button>
            <button disabled={selectedIndex >= events.length - 1} onClick={() => onNavigate(selectedIndex + 1)} className="rounded border border-white/[0.06] px-2 py-1 text-xs text-white/70 disabled:opacity-30">Next</button>
            <button onClick={onClose} className="rounded border border-white/[0.06] p-2 text-white/30 hover:text-white/60"><XIcon className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-xl font-semibold text-white">{toTitleCase(event.title)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/20">
            <span>{getOutletDisplay(event.source, event.source_id)}</span>
            <span>•</span>
            <span>{formatRegion(event.region)}</span>
            <span>•</span>
            <span>{relativeTime(event.occurred_at)}</span>
          </div>
        </div>

        <div className="flex gap-2 border-b border-white/[0.06] px-5 py-3 text-[12px]">
          <button onClick={() => setTab('brief')} className={cn('rounded-lg px-3 py-1.5 font-medium', tab === 'brief' ? 'bg-blue-500 text-white' : 'text-white/35 hover:text-white/55')}>Intel Brief</button>
          <button onClick={() => setTab('raw')} className={cn('rounded-lg px-3 py-1.5 font-medium', tab === 'raw' ? 'bg-blue-500 text-white' : 'text-white/35 hover:text-white/55')}>Raw Data</button>
          <button onClick={() => setTab('related')} className={cn('rounded-lg px-3 py-1.5 font-medium', tab === 'related' ? 'bg-blue-500 text-white' : 'text-white/35 hover:text-white/55')}>Related</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'brief' ? (
            <div className="space-y-4 text-[12px] leading-7 text-white/70">
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
                {(event.summary_short ?? event.summary_full ?? event.description ?? event.snippet ?? 'No brief available.').trim()}
              </div>
              {event.description && event.description !== event.summary_short ? <div className="text-white/25">{event.description}</div> : null}
            </div>
          ) : null}

          {tab === 'raw' ? (
            <div className="overflow-hidden rounded-xl border border-white/[0.05]">
              {[
                ['id', event.id],
                ['severity', String(event.severity ?? 1)],
                ['event_type', event.event_type ?? ''],
                ['region', event.region ?? ''],
                ['occurred_at', event.occurred_at ?? ''],
                ['source', event.source ?? ''],
                ['source_id', event.source_id ?? ''],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[140px_1fr] border-b border-white/[0.05] bg-white/[0.015] px-4 py-3 text-[12px] last:border-b-0">
                  <div className="font-mono text-white/20">{label}</div>
                  <div className="break-all text-white/70">{value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'related' ? (
            <div className="space-y-2">
              {related && related.length > 0 ? related.map((item) => <div key={item.id} className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3"><div className="text-[12px] font-medium text-white/80">{item.title}</div><div className="mt-1 text-[11px] text-white/20">{formatRegion(item.region)} · {relativeTime(item.occurred_at)}</div></div>) : <div className="rounded-xl border border-dashed border-white/[0.05] px-4 py-8 text-center text-[12px] text-white/25">No related events</div>}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] px-5 py-4">
          <button onClick={() => navigator.clipboard.writeText(`https://conflictradar.co/feed?eventId=${event.id}`)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.06] transition-colors duration-150"><CopyIcon className="h-4 w-4" />Copy Link</button>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.06] transition-colors duration-150"><PinIcon className="h-4 w-4" />Pin</button>
          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-white/70 hover:bg-white/[0.06] transition-colors duration-150"><BellIcon className="h-4 w-4" />Alert</button>
        </div>
        {sourceLink ? <a href={sourceLink} target="_blank" rel="noreferrer" className="border-t border-white/[0.06] px-5 py-3 text-[12px] text-cyan-400"><span className="inline-flex items-center gap-2">Open source <ExternalLinkIcon className="h-4 w-4" /></span></a> : null}
      </div>
    </div>
  )
}

export function EventFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(timer)
  }, [search])

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const response = await fetch(`/api/v1/events?window=${timeWindow}&limit=200`, { cache: 'no-store' })
      const json = await response.json() as FeedResponse
      setEvents(json.data ?? [])
      setLastFetched(new Date())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeWindow])

  useEffect(() => { void fetchEvents() }, [fetchEvents])

  const filteredEvents = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    let result = events.filter((event) => {
      const matchesQuery = !query || `${event.title} ${event.description ?? ''} ${event.region ?? ''} ${event.event_type ?? ''}`.toLowerCase().includes(query)
      return matchesQuery && matchesCategory(event, category) && matchesSeverity(event, severityFilter)
    })

    if (sortMode === 'severity') {
      result = [...result].sort((a, b) => (b.severity ?? 1) - (a.severity ?? 1))
    }

    return result
  }, [events, debouncedSearch, category, severityFilter, sortMode])

  // Severity counts based on currently category+search filtered events (not raw)
  const activeFilteredBase = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    return events.filter((event) => {
      const matchesQuery = !query || `${event.title} ${event.description ?? ''} ${event.region ?? ''} ${event.event_type ?? ''}`.toLowerCase().includes(query)
      return matchesQuery && matchesCategory(event, category)
    })
  }, [events, debouncedSearch, category])

  const severityCounts = useMemo(() => ({
    all: activeFilteredBase.length,
    critical: activeFilteredBase.filter((event) => event.severity === 4).length,
    high: activeFilteredBase.filter((event) => event.severity === 3).length,
    medium: activeFilteredBase.filter((event) => event.severity === 2).length,
    low: activeFilteredBase.filter((event) => (event.severity ?? 1) === 1).length,
  }), [activeFilteredBase])

  const selectedIndex = useMemo(() => filteredEvents.findIndex((event) => event.id === selectedId), [filteredEvents, selectedId])

  useEffect(() => {
    if (selectedId && selectedIndex === -1) setSelectedId(null)
  }, [selectedId, selectedIndex])

  const lastFetchedLabel = lastFetched
    ? `Updated ${lastFetched.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : null

  return (
    <div className="h-full overflow-hidden rounded-xl border border-white/[0.05] bg-[#070B11]">
      <div className="border-b border-white/[0.05] px-4 py-3">
        {/* Row 1: Search + actions */}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events by title, region, or type…"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-8 text-[12px] text-white/70 outline-none placeholder:text-white/20 focus:border-white/[0.12]"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); searchRef.current?.focus() }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/20 hover:text-white/50"
                aria-label="Clear search"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortMode((m) => m === 'newest' ? 'severity' : 'newest')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors duration-150',
              sortMode === 'severity'
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                : 'border-white/[0.06] bg-white/[0.03] text-white/50 hover:bg-white/[0.06]'
            )}
            title={`Sort by ${sortMode === 'newest' ? 'severity' : 'newest first'}`}
          >
            <SortIcon className="h-3.5 w-3.5" />
            {sortMode === 'newest' ? 'Newest' : 'Severity'}
          </button>

          {/* Refresh */}
          <button
            onClick={() => void fetchEvents(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-white/50 hover:bg-white/[0.06] transition-colors duration-150 disabled:opacity-40"
            title="Refresh feed"
          >
            <RefreshIcon className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>

          {/* Export */}
          <button
            onClick={() => exportCsv(filteredEvents)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-white/50 hover:bg-white/[0.06] transition-colors duration-150"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Export
          </button>
        </div>

        {/* Row 2: Time windows + meta info */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TIME_WINDOWS.map((value) => (
              <button
                key={value}
                onClick={() => setTimeWindow(value)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150',
                  timeWindow === value
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-white/[0.06] text-white/35 hover:text-white/55'
                )}
              >
                {value.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-white/20">
            {lastFetchedLabel && (
              <span className="flex items-center gap-1.5">
                <ClockIcon className="h-3 w-3" />
                {lastFetchedLabel}
              </span>
            )}
            <span className="tabular-nums">
              {filteredEvents.length === events.length
                ? `${events.length} events`
                : `${filteredEvents.length} of ${events.length} events`}
            </span>
          </div>
        </div>

        {/* Row 3: Category filters */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setCategory(option.key)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150',
                category === option.key
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'border-white/[0.06] text-white/35 hover:text-white/55'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Row 4: Severity filters with live counts */}
        <div className="flex flex-wrap gap-1.5">
          {SEVERITY_ORDER.map((key) => {
            const label = key === 'all' ? 'All' : `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`
            const count = severityCounts[key]
            return (
              <button
                key={key}
                onClick={() => setSeverityFilter(key)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150',
                  severityFilter === key
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-white/[0.06] text-white/35 hover:text-white/55'
                )}
              >
                {label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid h-[calc(100%-160px)] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-h-0 overflow-y-auto p-4">
          <BreakingBanner events={filteredEvents} />
          <div className="space-y-3">
            {loading ? <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-12 text-center text-[12px] text-white/25">Loading intel feed…</div> : null}
            {!loading && filteredEvents.length === 0 ? <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-12 text-center text-[12px] text-white/25">No events match current filters.</div> : null}
            {!loading && filteredEvents.map((event) => {
              const severity = getSeverityMeta(event.severity)
              const freshness = event.occurred_at ? getFreshnessStatus(event.occurred_at) : null
              return (
                <button key={event.id} onClick={() => setSelectedId(event.id)} className={cn('block w-full rounded-xl border border-white/[0.05] border-l-4 bg-white/[0.015] p-4 text-left hover:bg-white/[0.03] transition-colors duration-150', severity.border)}>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={cn('rounded-full border px-2 py-1 font-semibold', severity.chip)}>{severity.label}</span>
                    {freshness ? <span className={cn('rounded-full border px-2 py-1 font-semibold', freshness.color)}>{freshness.label}</span> : null}
                    <span className="text-white/20">{formatRegion(event.region)}</span>
                    <span className="ml-auto text-white/20">{getOutletDisplay(event.source, event.source_id)} · {relativeTime(event.occurred_at)}</span>
                  </div>
                  <div className="text-[14px] font-medium text-white/80">{toTitleCase(event.title)}</div>
                  <div className="mt-2 line-clamp-2 text-[12px] text-white/25">{event.summary_short ?? event.summary_full ?? event.snippet ?? event.description ?? 'No summary available.'}</div>
                </button>
              )
            })}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto border-l border-white/[0.05] p-4">
          <FeedSidebar events={filteredEvents} onSelect={(event) => setSelectedId(event.id)} />
        </div>
      </div>

      {selectedIndex >= 0 ? <EventDetailPanel events={filteredEvents} selectedIndex={selectedIndex} onClose={() => setSelectedId(null)} onNavigate={(next) => setSelectedId(filteredEvents[next]?.id ?? null)} /> : null}
    </div>
  )
}
