'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Download, Search, X } from 'lucide-react'
import { IntelDrawer } from '@/components/intel/IntelDrawer'
import { eventToIntelItem } from '@/types/intel-item'

type FeedEvent = {
  id: string
  source: string
  title: string
  description?: string | null
  severity?: number | string | null
  region?: string | null
  occurred_at?: string | null
}

const WINDOWS = ['1h', '6h', '24h', '7d', '30d'] as const

function sevColor(severity?: number | string | null) {
  const value = Number(severity ?? 0)
  if (value >= 4) return '#EF4444'
  if (value >= 3) return '#F97316'
  if (value >= 2) return '#EAB308'
  if (value >= 1) return '#22C55E'
  return '#64748B'
}

function timeAgo(input?: string | null) {
  if (!input) return 'unknown'
  const diff = Math.max(0, Date.now() - new Date(input).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function SourceBadge({ source }: { source: string }) {
  const key = source?.toLowerCase()
  const palette: Record<string, [string, string, string]> = {
    gdelt: ['rgba(30,64,175,0.18)', '#60A5FA', 'GDELT'],
    reliefweb: ['rgba(13,148,136,0.18)', '#2DD4BF', 'ReliefWeb'],
    gdacs: ['rgba(146,64,14,0.20)', '#FB923C', 'GDACS'],
    unhcr: ['rgba(49,46,129,0.20)', '#A5B4FC', 'UNHCR'],
    nasa_eonet: ['rgba(120,53,15,0.20)', '#FBBF24', 'NASA EONET'],
    'nasa-eonet': ['rgba(120,53,15,0.20)', '#FBBF24', 'NASA EONET'],
  }
  const config = palette[key] ?? ['var(--bg-surface-2)', 'var(--text-secondary)', source]

  return <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ background: config[0], color: config[1] }}>{config[2]}</span>
}

export function EventFeed() {
  const AlertCircleIcon = AlertCircle as any
  const DownloadIcon = Download as any
  const SearchIcon = Search as any
  const XIcon = X as any
  const [source, setSource] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [window, setWindow] = useState<(typeof WINDOWS)[number]>('24h')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [selected, setSelected] = useState<FeedEvent | null>(null)
  const [countdown, setCountdown] = useState(60)

  const fetchEvents = useCallback(async (reset = false) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (source !== 'all') params.set('source', source)
    if (severity !== 'all') params.set('severity', severity === 'critical' ? '4' : severity === 'high' ? '3' : severity === 'medium' ? '2' : '1')
    params.set('window', window)
    if (search) params.set('search', search)
    params.set('limit', '50')
    params.set('offset', String((reset ? 0 : page) * 50))
    const msMap = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
    params.set('since', new Date(Date.now() - msMap[window]).toISOString())
    const res = await fetch(`/api/v1/events?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json() as { data?: FeedEvent[]; success?: boolean }
    const incoming = json.data ?? []
    setEvents(reset ? incoming : [...events, ...incoming])
    setLastRefresh(new Date())
    setCountdown(60)
    setLoading(false)
  }, [events, page, search, severity, source, window])

  useEffect(() => { setPage(0); void fetchEvents(true) }, [source, severity, window])
  useEffect(() => {
    const handle = setTimeout(() => { void fetchEvents(true) }, 250)
    return () => clearTimeout(handle)
  }, [search])
  useEffect(() => {
    const interval = setInterval(() => setCountdown((v) => (v <= 1 ? 60 : v - 1)), 1000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    if (countdown === 60) return
    if (countdown === 1) void fetchEvents(true)
  }, [countdown, fetchEvents])

  const drawerItem = useMemo(() => (selected ? eventToIntelItem(selected as never) : null), [selected])

  const exportCsv = () => {
    const header = ['id', 'source', 'title', 'severity', 'region', 'occurred_at']
    const rows = events.map((event) => [event.id, event.source, JSON.stringify(event.title ?? ''), event.severity ?? '', event.region ?? '', event.occurred_at ?? ''])
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conflict-ops-feed-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setSource('all'); setSeverity('all'); setWindow('24h'); setSearch(''); setPage(0)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="sticky top-0 z-10 border-b px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded px-3 py-1.5 text-sm" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All Sources</option><option value="gdelt">GDELT</option><option value="reliefweb">ReliefWeb</option><option value="gdacs">GDACS</option><option value="unhcr">UNHCR</option><option value="nasa_eonet">NASA EONET</option>
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="rounded px-3 py-1.5 text-sm" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-surface-2)' }}>
            {WINDOWS.map((item) => <button key={item} onClick={() => setWindow(item)} className="rounded-md px-3 py-1.5 text-sm" style={{ background: item === window ? 'var(--primary)' : 'transparent', color: item === window ? '#fff' : 'var(--text-secondary)' }}>{item}</button>)}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." className="w-full rounded pl-9 pr-3 py-1.5 text-sm" style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex-1" />
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}><DownloadIcon size={14} /> Export CSV</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="mb-3 h-16 animate-pulse rounded-lg" style={{ background: 'var(--bg-surface-2)' }} />)}</div>
        ) : events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircleIcon size={32} style={{ color: 'var(--text-muted)' }} />
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No events match current filters</div>
            <button onClick={clearFilters} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}><XIcon size={14} /> Clear filters</button>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} onClick={() => setSelected(event)} className="flex cursor-pointer items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
              <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: sevColor(event.severity), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mb-1 flex items-center gap-2">
                  <SourceBadge source={event.source} />
                  <span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</span>
                </div>
                <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{event.description || 'No description provided.'}</p>
              </div>
              <div className="shrink-0 text-right">
                {event.region && <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{event.region}</span>}
                <div className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{timeAgo(event.occurred_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--border)' }}>
        <button onClick={() => { const next = page + 1; setPage(next); void fetchEvents(false) }} className="rounded-md border px-3 py-1.5" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Load 50 more</button>
        <div style={{ color: 'var(--text-muted)' }}>Refreshing in {countdown}s · last {lastRefresh.toLocaleTimeString()}</div>
      </div>

      <IntelDrawer item={drawerItem} items={drawerItem ? [drawerItem] : []} onClose={() => setSelected(null)} onNavigate={() => undefined} />
    </div>
  )
}
