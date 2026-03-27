'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Download, Search, X } from 'lucide-react'
import { IntelDrawer } from '@/components/intel/IntelDrawer'
import { eventToIntelItem } from '@/types/intel-item'
import { safeRelativeTime } from '@/lib/utils/time'

type FeedEvent = {
  id: string
  source: string
  title: string
  description?: string | null
  severity?: number | string | null
  region?: string | null
  occurred_at?: string | null
  ingested_at?: string | null
  event_type?: string | null
  country_code?: string | null
  provenance_raw?: Record<string, unknown> | null
  location?: string | null
  _corroborated_by?: string[]
  _source_count?: number
  _confidence?: 'confirmed' | 'corroborated' | 'unverified'
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
  return (
    <span className="rounded-full px-2 py-1 text-[10px] font-medium"
      style={{ background: config[0], color: config[1] }}>
      {config[2]}
    </span>
  )
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
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [selected, setSelected] = useState<FeedEvent | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [countdown, setCountdown] = useState(60)
  const listRef = useRef<HTMLDivElement>(null)

  const fetchEvents = useCallback(async (reset = false, cursor?: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (source !== 'all') params.set('source', source)
    if (severity !== 'all') params.set('severity', severity === 'critical' ? '4' : severity === 'high' ? '3' : severity === 'medium' ? '2' : '1')
    params.set('window', window)
    if (search) params.set('search', search)
    params.set('limit', '50')
    if (cursor) params.set('cursor', cursor)
    else params.set('offset', '0')

    const res = await fetch(`/api/v1/events?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json() as { data?: FeedEvent[]; nextCursor?: string | null }
    const incoming = json.data ?? []
    setNextCursor(json.nextCursor ?? null)
    setEvents(reset ? incoming : prev => [...prev, ...incoming])
    setLastRefresh(new Date())
    setCountdown(60)
    setLoading(false)
  }, [search, severity, source, window])

  // Reset + refetch when filters change (except search which is debounced)
  useEffect(() => {
    setNextCursor(null)
    void fetchEvents(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, severity, window])

  // Debounce search
  useEffect(() => {
    const handle = setTimeout(() => {
      setNextCursor(null)
      void fetchEvents(true)
    }, 300)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Auto-refresh countdown
  useEffect(() => {
    const interval = setInterval(() => setCountdown(v => (v <= 1 ? 60 : v - 1)), 1000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    if (countdown === 1) void fetchEvents(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // Keyboard navigation: j/k, Enter, Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'j' || (e.key === 'ArrowDown' && !selected)) {
        e.preventDefault()
        setFocusedIndex(i => Math.min(i + 1, events.length - 1))
      } else if (e.key === 'k' || (e.key === 'ArrowUp' && !selected)) {
        e.preventDefault()
        setFocusedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && focusedIndex >= 0 && !selected) {
        const evt = events[focusedIndex]
        if (evt) setSelected(evt)
      } else if (e.key === 'Escape' && selected) {
        setSelected(null)
      }
    }
    globalThis.window?.addEventListener('keydown', handler)
    return () => globalThis.window?.removeEventListener('keydown', handler)
  }, [events, focusedIndex, selected])

  const drawerItem = useMemo(() => (selected ? eventToIntelItem(selected as never) : null), [selected])
  const drawerItems = useMemo(() => events.map(e => eventToIntelItem(e as never)), [events])

  const exportCsv = () => {
    const header = ['id', 'source', 'title', 'severity', 'region', 'occurred_at']
    const rows = events.map(event => [event.id, event.source, JSON.stringify(event.title ?? ''), event.severity ?? '', event.region ?? '', event.occurred_at ?? ''])
    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `conflict-ops-feed-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setSource('all'); setSeverity('all'); setWindow('24h'); setSearch('')
    setNextCursor(null)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      {/* Toolbar */}
      <div className="sticky top-0 z-10 border-b px-4 py-3"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <select value={source} onChange={e => setSource(e.target.value)}
            className="rounded px-3 py-1.5 text-sm"
            style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All Sources</option>
            <option value="gdelt">GDELT</option>
            <option value="reliefweb">ReliefWeb</option>
            <option value="gdacs">GDACS</option>
            <option value="unhcr">UNHCR</option>
            <option value="nasa_eonet">NASA EONET</option>
          </select>
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            className="rounded px-3 py-1.5 text-sm"
            style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-surface-2)' }}>
            {WINDOWS.map(item => (
              <motion.button whileTap={{ scale: 0.95 }} key={item} onClick={() => setWindow(item)}
                className="relative rounded-md px-3 py-1.5 text-sm"
                style={{ color: item === window ? '#fff' : 'var(--text-secondary)' }}>
                {item === window && (
                  <motion.span layoutId="time-window-active"
                    style={{ position: 'absolute', inset: 0, background: 'var(--primary)', borderRadius: 6, zIndex: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
                )}
                <span style={{ position: 'relative', zIndex: 1 }}>{item}</span>
              </motion.button>
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search events… (j/k to navigate)"
              className="w-full rounded py-1.5 pl-9 pr-3 text-sm"
              style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="flex-1" />
          <button onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm btn-ghost"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            <DownloadIcon size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {loading && events.length === 0 ? (
          <div className="p-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="mb-3 h-16 rounded-lg skeleton" />)}</div>
        ) : events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircleIcon size={32} style={{ color: 'var(--text-muted)' }} />
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No events match current filters</div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm btn-ghost"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
              <XIcon size={14} /> Clear filters
            </motion.button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3), ease: 'easeOut' }}
                onClick={() => { setSelected(event); setFocusedIndex(index) }}
                tabIndex={0}
                onFocus={() => setFocusedIndex(index)}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') setSelected(event) }}
                className="flex cursor-pointer items-start gap-3 border-b px-4 py-3 transition-colors hover:bg-white/5 interactive-card outline-none"
                style={{
                  borderColor: 'var(--border)',
                  background: focusedIndex === index ? 'rgba(255,255,255,0.04)' : undefined,
                  boxShadow: focusedIndex === index ? 'inset 0 0 0 1px rgba(37,99,235,0.3)' : undefined,
                }}>
                <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: sevColor(event.severity), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mb-1 flex items-center gap-2">
                    <SourceBadge source={event.source} />
                    <span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</span>
                  </div>
                  {/* Corroboration confidence badge */}
                  {(event._source_count ?? 1) > 1 ? (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      background: event._confidence === 'confirmed' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: event._confidence === 'confirmed' ? '#22c55e' : '#eab308',
                      border: `1px solid ${event._confidence === 'confirmed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                    }}>
                      {event._confidence === 'confirmed' ? '✓' : '○'} {event._source_count} source{(event._source_count ?? 1) !== 1 ? 's' : ''}
                    </div>
                  ) : (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginBottom: '4px',
                      background: 'rgba(148, 163, 184, 0.1)',
                      color: '#94a3b8',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                    }}>
                      ○ Unverified
                    </div>
                  )}
                  <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {event.description || 'No description provided.'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {event.region && (
                    <span className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {event.region}
                    </span>
                  )}
                  <div className="mt-1 text-[11px]"
                    style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {safeRelativeTime(event.occurred_at)}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3 text-sm"
        style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => void fetchEvents(false, nextCursor ?? undefined)}
          disabled={loading || !nextCursor}
          className="rounded-md border px-3 py-1.5 btn-ghost disabled:opacity-40"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          {loading ? 'Loading…' : nextCursor ? 'Load more' : 'No more events'}
        </button>
        <div style={{ color: 'var(--text-muted)' }}>
          {events.length} events · Refreshing in {countdown}s
        </div>
      </div>

      <IntelDrawer
        item={drawerItem}
        items={drawerItems}
        onClose={() => setSelected(null)}
        onNavigate={newItem => {
          const idx = events.findIndex(e => e.id === newItem.id)
          if (idx >= 0) { setFocusedIndex(idx); setSelected(events[idx]!) }
        }}
      />
    </div>
  )
}
