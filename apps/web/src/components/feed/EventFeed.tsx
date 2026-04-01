'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ChevronDown, ChevronUp, Download, Search, X } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import { IntelDrawer } from '@/components/intel/IntelDrawer'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { eventToIntelItem } from '@/types/intel-item'
import { safeRelativeTime } from '@/lib/utils/time'
import { EVENT_TYPE_TO_CATEGORY, getBestDescription, getEffectiveType, getLocationDisplay, getSignificanceTier, sanitizeSourceDisplay } from '@/lib/event-presentation'

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
  description_lang?: string | null
  provenance_raw?: Record<string, unknown> | null
  location?: string | null
  significance_score?: number | null
  intelligence_summary?: string | null
  entities?: {
    actors?: string[]
    locations?: string[]
    weapons?: string[]
    casualties?: string
  } | null
  escalation_indicator?: boolean | null
  _corroborated_by?: string[]
  _source_count?: number
  _confidence?: 'confirmed' | 'corroborated' | 'unverified'
}

function formatFeedTitle(title: string, source: string): string {
  if (!title) return ''
  if (source === 'noaa') {
    const parts = title.split(/\s+(?:issued|in effect)/i)
    const type = parts.length > 0 && parts[0] ? parts[0].trim() : title
    const locMatch = title.match(/by NWS\s+(.+?)(?:\s+(?:until|$))/i)
    const loc = locMatch?.[1] ? ` · NWS ${locMatch[1].trim()}` : ''
    const short = type + loc
    return short.length > 90 ? `${short.slice(0, 87)}…` : short
  }
  return title.length > 110 ? `${title.slice(0, 107)}…` : title
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
  { label: 'All', value: 0, emoji: null },
  { label: 'Critical', value: 4, emoji: '🔴' },
  { label: 'High', value: 3, emoji: '🟠' },
  { label: 'Medium', value: 2, emoji: '🟡' },
  { label: 'Low', value: 1, emoji: '⚫' },
] as const

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

const AlertCircleIcon = AlertCircle as unknown as ComponentType<{ size?: number; style?: CSSProperties }>
const ChevronDownIcon = ChevronDown as unknown as ComponentType<{ size?: number; style?: CSSProperties }>
const ChevronUpIcon = ChevronUp as unknown as ComponentType<{ size?: number; style?: CSSProperties }>
const DownloadIcon = Download as unknown as ComponentType<{ size?: number; style?: CSSProperties }>
const SearchIcon = Search as unknown as ComponentType<{ size?: number; className?: string; style?: CSSProperties }>
const XIcon = X as unknown as ComponentType<{ size?: number; style?: CSSProperties }>

const PILL_ACTIVE: React.CSSProperties = { background: '#2563EB', color: '#fff', border: '1px solid #2563EB', borderRadius: '9999px', padding: '3px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', lineHeight: '1.4', whiteSpace: 'nowrap' }
const PILL_INACTIVE: React.CSSProperties = { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '9999px', padding: '3px 10px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', lineHeight: '1.4', whiteSpace: 'nowrap' }

export function EventFeed() {
  const [sortOrder, setSortOrder] = useState<'newest' | 'significance'>('newest')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [feedTab, setFeedTab] = useState<'all' | 'humanitarian'>('all')
  const [severityFilter, setSeverityFilter] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [languageFilter, setLanguageFilter] = useState<string>('all')
  const [rawFeed, setRawFeed] = useState(false)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FeedEvent | null>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [countdown, setCountdown] = useState(60)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)
  const [lastSeenAt, setLastSeenAt] = useState<string>(new Date().toISOString())
  const listRef = useRef<HTMLDivElement>(null)

  const fetchEvents = useCallback(async (reset = false) => {
    setLoading(true)
    const params = new URLSearchParams({ window: timeWindow, limit: '200', offset: '0' })
    if (languageFilter !== 'all') params.set('lang', languageFilter)
    if (rawFeed) params.set('raw', 'true')
    if (feedTab === 'humanitarian') {
      params.set('include_humanitarian', 'true')
      params.set('type', 'humanitarian_only')
    }

    try {
      const response = await fetch(`/api/v1/events?${params.toString()}`, { cache: 'no-store' })
      const json = (await response.json()) as { data?: FeedEvent[]; nextCursor?: string | null }
      const incoming = json.data ?? []
      setEvents(incoming)
      setNextCursor(json.nextCursor ?? null)
      setCountdown(30)
    } finally {
      setLoading(false)
    }
  }, [feedTab, languageFilter, rawFeed, timeWindow])

  useEffect(() => { void fetchEvents(true) }, [fetchEvents])
  useEffect(() => {
    const interval = setInterval(() => setCountdown((value) => (value <= 1 ? 30 : value - 1)), 1000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => { if (countdown === 1) void fetchEvents(true) }, [countdown, fetchEvents])
  useEffect(() => {
    const interval = setInterval(() => { void fetchEvents(true) }, 30000)
    return () => clearInterval(interval)
  }, [fetchEvents])
  useEffect(() => {
    if (events.length === 0) return
    const nextNewCount = events.filter((event) => {
      const eventTs = event.occurred_at ?? event.ingested_at
      return typeof eventTs === 'string' && eventTs > lastSeenAt
    }).length
    setNewCount(nextNewCount)
  }, [events, lastSeenAt])
  useEffect(() => {
    if (events.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const eventId = params.get('eventId')
    if (eventId && !selected) {
      const found = events.find((event) => event.id === eventId)
      if (found) setSelected(found)
    }
  }, [events, selected])

  const filteredEvents = useMemo(() => {
    let result = events
    if (categoryFilter !== 'all') result = result.filter((event) => (EVENT_TYPE_TO_CATEGORY[getEffectiveType(event.event_type)] ?? 'News') === categoryFilter)
    if (severityFilter > 0) result = result.filter((event) => Number(event.severity ?? 0) >= severityFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((event) => event.title.toLowerCase().includes(q) || (event.description ?? '').toLowerCase().includes(q))
    }
    if (languageFilter !== 'all') result = result.filter((event) => (event.description_lang ?? 'unknown') === languageFilter)

    const sorted = [...result]
    if (sortOrder === 'significance') {
      sorted.sort((left, right) => {
        const sigDiff = (right.significance_score ?? 0) - (left.significance_score ?? 0)
        if (sigDiff !== 0) return sigDiff
        return new Date(right.ingested_at ?? right.occurred_at ?? 0).getTime() - new Date(left.ingested_at ?? left.occurred_at ?? 0).getTime()
      })
      return sorted
    }

    sorted.sort((left, right) => new Date(right.occurred_at ?? right.ingested_at ?? 0).getTime() - new Date(left.occurred_at ?? left.ingested_at ?? 0).getTime())
    return sorted
  }, [categoryFilter, events, languageFilter, searchQuery, severityFilter, sortOrder])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (event.key === 'j' || (event.key === 'ArrowDown' && !selected)) {
        event.preventDefault()
        setFocusedIndex((index) => Math.min(index + 1, filteredEvents.length - 1))
      } else if (event.key === 'k' || (event.key === 'ArrowUp' && !selected)) {
        event.preventDefault()
        setFocusedIndex((index) => Math.max(index - 1, 0))
      } else if (event.key === 'Enter' && focusedIndex >= 0 && !selected) {
        const current = filteredEvents[focusedIndex]
        if (current) {
          setSelected(current)
          window.history.pushState({}, '', `?eventId=${current.id}`)
        }
      } else if (event.key === 'Escape' && selected) {
        setSelected(null)
        window.history.pushState({}, '', window.location.pathname)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filteredEvents, focusedIndex, selected])

  const drawerItem = useMemo(() => (selected ? eventToIntelItem(selected as never) : null), [selected])
  const drawerItems = useMemo(() => filteredEvents.map((event) => eventToIntelItem(event as never)), [filteredEvents])
  const languages = useMemo(() => ['all', ...Array.from(new Set(events.map((event) => event.description_lang).filter((value): value is string => Boolean(value)))).sort()], [events])

  const exportCsv = () => {
    const header = ['id', 'source', 'title', 'severity', 'country', 'region', 'occurred_at']
    const rows = filteredEvents.map((event) => [event.id, event.source, JSON.stringify(event.title ?? ''), event.severity ?? '', event.country_code ?? '', event.region ?? '', event.occurred_at ?? ''])
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `conflict-ops-feed-${Date.now()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setCategoryFilter('all')
    setSeverityFilter(0)
    setSearchQuery('')
    setLanguageFilter('all')
    setTimeWindow('24h')
    setRawFeed(false)
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="sticky top-0 z-10 space-y-2 border-b px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search events…" style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: '6px', padding: '5px 10px 5px 30px', fontSize: '13px' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}><XIcon size={12} /></button>}
          </div>
          <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className="shrink-0 rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-surface-2)' }}>
            {languages.map((language) => <option key={language} value={language}>{language === 'all' ? 'All languages' : language}</option>)}
          </select>
          <button onClick={() => setRawFeed((value) => !value)} style={rawFeed ? PILL_ACTIVE : PILL_INACTIVE}>Raw Feed</button>
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'newest' | 'significance')} className="shrink-0 rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-surface-2)' }}>
            <option value="newest">Newest First</option>
            <option value="significance">Most Significant</option>
          </select>
          <button onClick={exportCsv} className="btn-ghost inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}><DownloadIcon size={12} /> Export</button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5" style={{ fontSize: '11px' }}>
          <button onClick={() => setFeedTab('all')} style={feedTab === 'all' ? PILL_ACTIVE : PILL_INACTIVE}>Main Feed</button>
          <button onClick={() => setFeedTab('humanitarian')} style={feedTab === 'humanitarian' ? { ...PILL_ACTIVE, background: '#0f766e', border: '1px solid #0f766e' } : PILL_INACTIVE}>Humanitarian</button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />
          {TIME_WINDOWS.map((windowValue) => <button key={windowValue} onClick={() => setTimeWindow(windowValue)} style={timeWindow === windowValue ? PILL_ACTIVE : PILL_INACTIVE}>{windowValue}</button>)}
          <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />
          {CATEGORIES.map((category) => <button key={category.value} onClick={() => setCategoryFilter(category.value)} style={categoryFilter === category.value ? PILL_ACTIVE : PILL_INACTIVE}>{category.label}</button>)}
          <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 4px' }} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>SEV:</span>
          {SEV_FILTERS.map((filter) => {
            const count = filter.value === 0 ? events.length : filter.value === 4 ? events.filter((event) => Number(event.severity ?? 0) === 4).length : events.filter((event) => Number(event.severity ?? 0) >= filter.value).length
            return <button key={filter.value} onClick={() => setSeverityFilter(filter.value)} style={severityFilter === filter.value ? PILL_ACTIVE : PILL_INACTIVE}>{filter.emoji ? `${filter.emoji} ` : ''}{filter.label}<span style={{ opacity: 0.6, marginLeft: '3px' }}>({count})</span></button>
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" ref={listRef}>
        {newCount > 0 && (
          <div
            className="cursor-pointer bg-blue-600 px-4 py-2 text-center text-sm text-white"
            onClick={() => { setLastSeenAt(new Date().toISOString()); setNewCount(0); window.scrollTo(0, 0) }}
          >
            ↑ {newCount} new event{newCount > 1 ? 's' : ''} — click to refresh
          </div>
        )}
        {loading && events.length === 0 ? (
          <div className="p-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="mb-1 flex animate-pulse gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}><div className="w-1 self-stretch rounded" style={{ background: 'var(--border)' }} /><div className="flex-1 space-y-2"><div className="h-4 w-3/4 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} /><div className="h-3 w-1/2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} /></div></div>)}</div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"><AlertCircleIcon size={32} style={{ color: 'var(--text-muted)' }} /><div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No events match current filters</div><motion.button whileTap={{ scale: 0.95 }} onClick={clearFilters} className="btn-ghost inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}><XIcon size={14} /> Clear filters</motion.button></div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredEvents.map((event, index) => {
              const selectedState = selected?.id === event.id
              const focused = focusedIndex === index
              const sColor = sevColor(event.severity)
              const sLabel = sevLabel(event.severity)
              const tier = getSignificanceTier(event.significance_score)
              const sourceName = event.source ? sanitizeSourceDisplay(event.source) : ''
              const country = getLocationDisplay({ ...event, severity: typeof event.severity === 'number' ? event.severity : null })
              const title = formatFeedTitle(event.title, event.source).toUpperCase()
              const snippet = getBestDescription({ ...event, severity: typeof event.severity === 'number' ? event.severity : null, description: event.intelligence_summary ?? event.description ?? null, summary_short: event.intelligence_summary ?? undefined }, 220)
              const actors = Array.isArray(event.entities?.actors) ? event.entities?.actors.filter(Boolean) : []
              const sourceCount = event._source_count ?? 1
              const corroborated = event._corroborated_by ?? []
              const expanded = expandedSources[event.id] ?? false

              return (
                <motion.div key={event.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }} onClick={() => { setSelected(event); setFocusedIndex(index); window.history.pushState({}, '', `?eventId=${event.id}`) }} tabIndex={0} onFocus={() => setFocusedIndex(index)} onKeyDown={(keyEvent: React.KeyboardEvent) => { if (keyEvent.key === 'Enter') { setSelected(event); window.history.pushState({}, '', `?eventId=${event.id}`) } }} className="interactive-card flex cursor-pointer items-start gap-0 border-b px-0 py-3 outline-none transition-colors hover:bg-white/5" style={{ pointerEvents: 'auto', borderColor: 'var(--border)', borderLeft: selectedState ? '3px solid #2563EB' : '3px solid transparent', background: selectedState ? 'rgba(37,99,235,0.08)' : focused ? 'rgba(255,255,255,0.04)' : 'transparent', boxShadow: focused && !selectedState ? 'inset 0 0 0 1px rgba(37,99,235,0.2)' : undefined, paddingLeft: '13px', paddingRight: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      {sLabel && <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', padding: '1px 5px', borderRadius: '3px', background: `${sColor}22`, color: sColor, border: `1px solid ${sColor}44`, letterSpacing: '0.05em' }}>{sLabel}</span>}
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>{country !== 'Location unknown' ? `${country} · ` : ''}{safeRelativeTime(event.occurred_at ?? event.ingested_at)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.bgColor} ${tier.color}`}>{tier.label}</span>
                      {sourceName ? <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>{sourceName}{sourceCount > 1 ? ` +${sourceCount - 1}` : ''}</span> : null}
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '6px', letterSpacing: '0.04em' }}>{title}</div>

                    {snippet && snippet !== title ? (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: sourceCount > 1 ? '6px' : 0 }}>{snippet}</div>
                    ) : null}
                    {actors.length > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}><strong style={{ color: 'var(--text-secondary)' }}>Actors:</strong> {actors.join(' · ')}</div>}

                    {sourceCount > 1 && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation()
                            setExpandedSources((current) => ({ ...current, [event.id]: !expanded }))
                          }}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide"
                          style={{ borderColor: 'var(--border)', color: event._confidence === 'confirmed' ? '#22c55e' : '#eab308', background: event._confidence === 'confirmed' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)' }}
                        >
                          {expanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
                          {sourceName} +{sourceCount - 1} sources
                        </button>
                        {expanded && corroborated.length > 0 && (
                          <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>{[sourceName, ...corroborated].join(' · ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--border)' }}>
        <button disabled={loading || !nextCursor} className="btn-ghost rounded-md border px-3 py-1.5 disabled:opacity-40" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', fontSize: '12px' }}>{loading ? 'Loading…' : nextCursor ? 'Load more' : `End of feed — ${filteredEvents.length} events displayed`}</button>
        <div style={{ color: (() => { const latest = filteredEvents[0]?.occurred_at ?? filteredEvents[0]?.ingested_at ?? null; if (!latest) return 'var(--text-muted)'; return Date.now() - new Date(latest).getTime() > 30 * 60 * 1000 ? '#f59e0b' : 'var(--text-muted)' })(), fontSize: '11px' }}>{filteredEvents.length}/{events.length} events · Latest {filteredEvents[0] ? safeRelativeTime(filteredEvents[0]?.occurred_at ?? filteredEvents[0]?.ingested_at) : 'n/a'} · Refreshing in {countdown}s</div>
      </div>

      <ErrorBoundary>
        <IntelDrawer item={drawerItem} items={drawerItems} onClose={() => { setSelected(null); window.history.pushState({}, '', window.location.pathname) }} onNavigate={(item) => { const event = events.find((entry) => entry.id === item.id); const index = filteredEvents.findIndex((entry) => entry.id === item.id); if (event) { setSelected(event); setFocusedIndex(index); window.history.pushState({}, '', `?eventId=${event.id}`) } }} />
      </ErrorBoundary>
    </div>
  )
}
