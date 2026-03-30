'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Download, Search, X } from 'lucide-react'
import { IntelDrawer } from '@/components/intel/IntelDrawer'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { eventToIntelItem } from '@/types/intel-item'
import { safeRelativeTime } from '@/lib/utils/time'
import { EVENT_TYPE_TO_CATEGORY, getEffectiveType, getBestDescription, getLocationDisplay } from '@/lib/event-presentation'
import { getPublicSourceName } from '@/lib/utils/source-display'

type FeedEvent = {
  id: string
  source: string
  title: string
  description?: string | null
  snippet?: string | null
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

// Shorten NOAA titles — strip the full date range, keep alert type + location
function formatFeedTitle(title: string, source: string): string {
  if (!title) return ''
  if (source === 'noaa') {
    // "Red Flag Warning issued March 27 at 9:43PM MDT until March 29 at 8:00PM MDT by NWS Grand Junction CO"
    // → "Red Flag Warning · NWS Grand Junction CO"
    const parts = title.split(/\s+(?:issued|in effect)/i)
    const type = parts.length > 0 && parts[0] ? parts[0].trim() : title
    const locMatch = title.match(/by NWS\s+(.+?)(?:\s+(?:until|$))/i)
    const locGroup = locMatch ? locMatch[1] : null
    const loc = locGroup ? ` · NWS ${locGroup.trim()}` : ''
    const short = type + loc
    return short.length > 90 ? short.slice(0, 87) + '…' : short
  }
  return title.length > 90 ? title.slice(0, 87) + '…' : title
}

const TIME_WINDOWS = ['1h', '6h', '24h', '7d', '30d'] as const
type TimeWindow = (typeof TIME_WINDOWS)[number]

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'Conflict', label: 'Conflict' },
  { value: 'Airstrikes', label: 'Airstrikes' },
  { value: 'Political', label: 'Political' },
  { value: 'Disasters', label: 'Disasters' },
  { value: 'News', label: 'News' },
] as const

const SEV_FILTERS = [
  { label: 'All',      value: 0, emoji: null },
  { label: 'Critical', value: 4, emoji: '🔴' },
  { label: 'High',     value: 3, emoji: '🟠' },
  { label: 'Medium',   value: 2, emoji: '🟡' },
  { label: 'Low',      value: 1, emoji: '⚫' },
]

function sevColor(severity?: number | string | null) {
  const value = Number(severity ?? 0)
  if (value >= 4) return '#EF4444'
  if (value >= 3) return '#F97316'
  if (value >= 2) return '#F59E0B'
  if (value >= 1) return '#3b82f6'
  return '#64748B'
}

function sevLabel(severity?: number | string | null) {
  const value = Number(severity ?? 0)
  if (value >= 4) return 'CRITICAL'
  if (value >= 3) return 'HIGH'
  if (value >= 2) return 'MEDIUM'
  if (value >= 1) return 'LOW'
  return null
}

const PILL_ACTIVE: React.CSSProperties = {
  background: '#2563EB',
  color: '#fff',
  border: '1px solid #2563EB',
  borderRadius: '9999px',
  padding: '3px 10px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  lineHeight: '1.4',
  whiteSpace: 'nowrap',
}

const PILL_INACTIVE: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '9999px',
  padding: '3px 10px',
  fontSize: '11px',
  fontWeight: 500,
  cursor: 'pointer',
  lineHeight: '1.4',
  whiteSpace: 'nowrap',
}

export function EventFeed() {
  const AlertCircleIcon = AlertCircle as React.ElementType
  const DownloadIcon = Download as React.ElementType
  const SearchIcon = Search as React.ElementType
  const XIcon = X as React.ElementType

  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')

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
    params.set('window', timeWindow)
    params.set('limit', '200')
    if (cursor) params.set('cursor', cursor)
    else params.set('offset', '0')

    try {
      const res = await fetch(`/api/v1/events?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json() as { data?: FeedEvent[]; nextCursor?: string | null }
      const incoming = json.data ?? []
      setNextCursor(json.nextCursor ?? null)
      setEvents(reset ? incoming : prev => [...prev, ...incoming])
      setLastRefresh(new Date())
      setCountdown(60)
    } finally {
      setLoading(false)
    }
  }, [timeWindow])

  // Reset + refetch when time window changes
  useEffect(() => {
    setNextCursor(null)
    void fetchEvents(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow])

  // Auto-refresh countdown
  useEffect(() => {
    const interval = setInterval(() => setCountdown(v => (v <= 1 ? 60 : v - 1)), 1000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    if (countdown === 1) void fetchEvents(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown])

  // Deep-link: on mount, read ?eventId and auto-open that event's drawer
  useEffect(() => {
    if (events.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const eventId = params.get('eventId')
    if (eventId && !selected) {
      const found = events.find(e => e.id === eventId)
      if (found) setSelected(found)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  // Keyboard navigation: j/k, Enter, Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'j' || (e.key === 'ArrowDown' && !selected)) {
        e.preventDefault()
        setFocusedIndex(i => Math.min(i + 1, filteredEvents.length - 1))
      } else if (e.key === 'k' || (e.key === 'ArrowUp' && !selected)) {
        e.preventDefault()
        setFocusedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && focusedIndex >= 0 && !selected) {
        const evt = filteredEvents[focusedIndex]
        if (evt) handleEventClick(evt)
      } else if (e.key === 'Escape' && selected) {
        setSelected(null)
        window.history.pushState({}, '', window.location.pathname)
      }
    }
    globalThis.window?.addEventListener('keydown', handler)
    return () => globalThis.window?.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, focusedIndex, selected])

  // Client-side filtering
  const filteredEvents = useMemo(() => {
    let result = events
    if (categoryFilter !== 'all') {
      result = result.filter(e => (EVENT_TYPE_TO_CATEGORY[getEffectiveType(e.event_type)] ?? 'News') === categoryFilter)
    }
    if (severityFilter > 0) {
      result = result.filter(e => (Number(e.severity) || 0) >= severityFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(e => e.title.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q))
    }
    return result
  }, [events, categoryFilter, severityFilter, searchQuery])

  function handleEventClick(event: FeedEvent) {
    setSelected(event)
    window.history.pushState({}, '', `?eventId=${event.id}`)
  }

  const drawerItem = useMemo(() => (selected ? eventToIntelItem(selected as never) : null), [selected])
  const drawerItems = useMemo(() => filteredEvents.map(e => eventToIntelItem(e as never)), [filteredEvents])

  const exportCsv = () => {
    const header = ['id', 'source', 'title', 'severity', 'country', 'region', 'occurred_at']
    const rows = filteredEvents.map(event => [
      event.id, event.source, JSON.stringify(event.title ?? ''), event.severity ?? '',
      event.country_code ?? '', event.region ?? '', event.occurred_at ?? '',
    ])
    const csv = [header.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `conflict-ops-feed-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setCategoryFilter('all')
    setSeverityFilter(0)
    setSearchQuery('')
    setTimeWindow('24h')
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>

      {/* Filter Bar */}
      <div className="sticky top-0 z-10 border-b px-4 py-3 space-y-2"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>

        {/* Row 1: Search + Export */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events…"
              style={{
                width: '100%',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                padding: '5px 10px 5px 30px',
                fontSize: '13px',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}>
                <XIcon size={12} />
              </button>
            )}
          </div>
          <button onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs btn-ghost shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            <DownloadIcon size={12} /> Export
          </button>
        </div>

        {/* Row 2: Time pills | Category pills | Severity pills */}
        <div className="flex flex-wrap items-center gap-1.5" style={{ fontSize: '11px' }}>
          {/* Time window */}
          {TIME_WINDOWS.map(w => (
            <button key={w} onClick={() => setTimeWindow(w)}
              style={timeWindow === w ? PILL_ACTIVE : PILL_INACTIVE}>
              {w}
            </button>
          ))}

          <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />

          {/* Category */}
          {CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => setCategoryFilter(cat.value)}
              style={categoryFilter === cat.value ? PILL_ACTIVE : PILL_INACTIVE}>
              {cat.label}
            </button>
          ))}

          <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />

          {/* Severity */}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>SEV:</span>
          {SEV_FILTERS.map(sf => {
            const count = sf.value === 0
              ? events.length
              : sf.value === 4
                ? events.filter(e => Number(e.severity ?? 0) === sf.value).length
                : events.filter(e => Number(e.severity ?? 0) >= sf.value).length
            return (
              <button key={sf.value} onClick={() => setSeverityFilter(sf.value)}
                style={severityFilter === sf.value ? PILL_ACTIVE : PILL_INACTIVE}>
                {sf.emoji ? `${sf.emoji} ` : ''}{sf.label}
                <span style={{ opacity: 0.6, marginLeft: '3px' }}>({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {loading && events.length === 0 ? (
          <div className="p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 p-4 border-b mb-1" style={{ borderColor: 'var(--border)' }}>
                <div className="w-1 self-stretch rounded" style={{ background: 'var(--border)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <div className="h-3 rounded w-1/2" style={{ background: 'rgba(255,255,255,0.05)' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
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
            {filteredEvents.map((event, index) => {
              const isSelected = selected?.id === event.id
              const isFocused = focusedIndex === index
              const sColor = sevColor(event.severity)
              const sLabel = sevLabel(event.severity)
              const normalizedEvent = { ...event, severity: typeof event.severity === 'number' ? event.severity : null }
              const country = getLocationDisplay(normalizedEvent)
              const sourceName = getPublicSourceName(event.source, event.provenance_raw ?? null, event.title ?? null)
              const snippet = getBestDescription(normalizedEvent, 180)

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
                  onClick={() => { handleEventClick(event); setFocusedIndex(index) }}
                  tabIndex={0}
                  onFocus={() => setFocusedIndex(index)}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleEventClick(event) }}
                  className="flex cursor-pointer items-start gap-0 border-b px-0 py-3 transition-colors hover:bg-white/5 interactive-card outline-none"
                  style={{
                    pointerEvents: 'auto',
                    borderColor: 'var(--border)',
                    borderLeft: isSelected ? '3px solid #2563EB' : '3px solid transparent',
                    background: isSelected
                      ? 'rgba(37,99,235,0.08)'
                      : isFocused
                        ? 'rgba(255,255,255,0.04)'
                        : 'transparent',
                    boxShadow: isFocused && !isSelected ? 'inset 0 0 0 1px rgba(37,99,235,0.2)' : undefined,
                    paddingLeft: '13px',
                    paddingRight: '16px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Row 1: Severity badge + Country · Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {sLabel && (
                        <span style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          fontFamily: 'JetBrains Mono, monospace',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          background: `${sColor}22`,
                          color: sColor,
                          border: `1px solid ${sColor}44`,
                          letterSpacing: '0.05em',
                        }}>
                          {sLabel}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {sourceName} · {country}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>
                        {safeRelativeTime(event.ingested_at ?? event.occurred_at)}
                      </span>
                    </div>

                    {/* Row 2: Title */}
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                      marginBottom: '4px',
                    }}>
                      {formatFeedTitle(event.title, event.source)}
                    </div>

                    {/* Row 3: Snippet */}
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                      marginBottom: (event._source_count ?? 1) > 1 ? '6px' : 0,
                    }}>
                      {snippet}
                    </div>

                    {/* Row 4: Confidence badge (only if multi-source) */}
                    {(event._source_count ?? 1) > 1 && (
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
                        background: event._confidence === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                        color: event._confidence === 'confirmed' ? '#22c55e' : '#eab308',
                        border: `1px solid ${event._confidence === 'confirmed' ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'}`,
                      }}>
                        {event._confidence === 'confirmed' ? '✓' : '○'} {event._source_count} sources
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
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
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: '12px' }}>
          {loading ? 'Loading…' : nextCursor ? 'Load more' : `End of feed — ${filteredEvents.length} events displayed`}
        </button>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          {filteredEvents.length}/{events.length} events · Refreshing in {countdown}s
        </div>
      </div>

      <ErrorBoundary>
        <IntelDrawer
          item={drawerItem}
          items={drawerItems}
          onClose={() => {
            setSelected(null)
            window.history.pushState({}, '', window.location.pathname)
          }}
          onNavigate={newItem => {
            const evt = events.find(e => e.id === newItem.id)
            const idx = filteredEvents.findIndex(e => e.id === newItem.id)
            if (evt) { handleEventClick(evt); setFocusedIndex(idx) }
          }}
        />
      </ErrorBoundary>
    </div>
  )
}
