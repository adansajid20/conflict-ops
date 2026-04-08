'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType, CSSProperties } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Clock, MapPin, ExternalLink, X, Radio, ChevronDown, Filter } from 'lucide-react'
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
  country_code?: string | null
  entities?: unknown[] | null
}

type RelatedResponse = { related?: Array<Pick<FeedEvent, 'id' | 'title' | 'occurred_at' | 'region' | 'severity'>> }
type FeedResponse = { data?: FeedEvent[] }

type TimeWindow = '1h' | '6h' | '24h' | '7d' | '30d'
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'
type CategoryFilter = 'all' | 'conflict' | 'airstrikes' | 'political' | 'humanitarian' | 'disasters' | 'cyber' | 'nuclear'
type SortMode = 'newest' | 'severity' | 'relevance'

const TIME_WINDOWS: TimeWindow[] = ['1h', '6h', '24h', '7d', '30d']
const CATEGORY_OPTIONS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'conflict', label: 'Armed Conflict' },
  { key: 'airstrikes', label: 'Airstrikes' },
  { key: 'political', label: 'Political' },
  { key: 'humanitarian', label: 'Humanitarian' },
  { key: 'disasters', label: 'Disasters' },
  { key: 'cyber', label: 'Cyber' },
  { key: 'nuclear', label: 'Nuclear' },
]

const SEVERITY_OPTIONS: Array<{ key: SeverityFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
]

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { stiffness: 120, damping: 20, mass: 0.8 }

const SearchIcon_ = Search as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const XIcon_ = X as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const ClockIcon_ = Clock as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const MapPinIcon_ = MapPin as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const ExternalLinkIcon_ = ExternalLink as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const RadioIcon_ = Radio as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const ChevronDownIcon_ = ChevronDown as unknown as ComponentType<{ className?: string; style?: CSSProperties }>
const FilterIcon_ = Filter as unknown as ComponentType<{ className?: string; style?: CSSProperties }>

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
  if (value >= 4) return { label: 'CRITICAL', color: '#ef4444', bgColor: 'rgb(239, 68, 68)', chip: 'text-red-300 bg-red-500/20 border-red-500/50', border: 'border-l-red-500', dot: 'bg-red-500', glowColor: 'from-red-500/30' }
  if (value === 3) return { label: 'HIGH', color: '#f97316', bgColor: 'rgb(249, 115, 22)', chip: 'text-orange-300 bg-orange-500/20 border-orange-500/50', border: 'border-l-orange-500', dot: 'bg-orange-500', glowColor: 'from-orange-500/30' }
  if (value === 2) return { label: 'MEDIUM', color: '#eab308', bgColor: 'rgb(234, 179, 8)', chip: 'text-yellow-300 bg-yellow-500/20 border-yellow-500/50', border: 'border-l-yellow-500', dot: 'bg-yellow-500', glowColor: 'from-yellow-500/30' }
  return { label: 'LOW', color: '#22c55e', bgColor: 'rgb(34, 197, 94)', chip: 'text-green-300 bg-green-500/20 border-green-500/50', border: 'border-l-green-500', dot: 'bg-green-500', glowColor: 'from-green-500/30' }
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

function StatsSummary({ events }: { events: FeedEvent[] }) {
  const stats = useMemo(() => {
    const critical = events.filter(e => e.severity === 4).length
    const high = events.filter(e => e.severity === 3).length
    const medium = events.filter(e => e.severity === 2).length
    const low = events.filter(e => (e.severity ?? 1) === 1).length

    const regions = Object.entries(events.reduce<Record<string, number>>((acc, e) => {
      const key = e.region ?? 'global'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return { critical, high, medium, low, regions, total: events.length }
  }, [events])

  const maxCount = Math.max(stats.critical, stats.high, stats.medium, stats.low, 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, type: 'spring' as const, ...SPRING_SMOOTH }}
      className="space-y-6"
    >
      {/* Total Events */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-2">Total Events</div>
        <div className="text-4xl font-bold text-white font-mono">{stats.total}</div>
      </div>

      {/* Severity Breakdown */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-3">Severity Breakdown</div>
        <div className="space-y-2.5">
          {[
            { label: 'Critical', count: stats.critical, color: 'bg-red-500', textColor: 'text-red-400' },
            { label: 'High', count: stats.high, color: 'bg-orange-500', textColor: 'text-orange-400' },
            { label: 'Medium', count: stats.medium, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
            { label: 'Low', count: stats.low, color: 'bg-green-500', textColor: 'text-green-400' },
          ].map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="text-white/60">{item.label}</span>
                <span className={cn('font-mono font-semibold', item.textColor)}>{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(5, (item.count / maxCount) * 100)}%` }}
                  transition={{ duration: 0.6, type: 'spring' as const, ...SPRING_SMOOTH }}
                  className={item.color}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Regions */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-3">Top Regions</div>
        <div className="space-y-2.5">
          {stats.regions.map(([region, count], idx) => (
            <motion.div
              key={region}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              className="flex items-center justify-between text-[12px]"
            >
              <span className="text-white/70">{formatRegion(region)}</span>
              <span className="font-mono text-white/40">{count}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function EventCard({ event, isSelected, onClick }: { event: FeedEvent; isSelected: boolean; onClick: () => void }) {
  const severity = getSeverityMeta(event.severity)
  const freshness = event.occurred_at ? getFreshnessStatus(event.occurred_at) : null

  return (
    <motion.button
      layoutId={`event-${event.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY, duration: 0.3 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        'block w-full rounded-xl border border-l-4 bg-gradient-to-br from-white/[0.015] to-white/[0.005] p-4 text-left transition-all duration-200',
        severity.border,
        isSelected ? 'border border-blue-500 bg-blue-500/10' : 'border-white/[0.06] hover:border-white/[0.1] hover:from-white/[0.025]'
      )}
      style={isSelected ? {
        boxShadow: `0 0 20px ${severity.color}40`
      } : {
        boxShadow: `0 0 0 0 ${severity.color}00`
      }}
    >
      {/* Top row: badges */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <motion.span
          className={cn('rounded-full border px-2 py-1 text-xs font-semibold', severity.chip)}
          animate={severity.label === 'CRITICAL' ? { opacity: [1, 0.7, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {severity.label}
        </motion.span>
        {freshness && (
          <span className={cn('rounded-full border px-2 py-1 text-xs font-semibold', freshness.color)}>
            {freshness.label}
          </span>
        )}
        <span className="text-white/30 text-xs">{formatRegion(event.region)}</span>
        <span className="ml-auto text-white/20 text-xs whitespace-nowrap">
          {getOutletDisplay(event.source, event.source_id)} · {relativeTime(event.occurred_at)}
        </span>
      </div>

      {/* Title */}
      <div className="text-[13px] font-semibold text-white leading-tight">{toTitleCase(event.title)}</div>

      {/* Snippet */}
      <div className="mt-2 line-clamp-2 text-[12px] text-white/40">
        {event.summary_short ?? event.summary_full ?? event.snippet ?? event.description ?? 'No summary available.'}
      </div>
    </motion.button>
  )
}

function EventDetailPanel({ event, onClose, onViewMap }: { event: FeedEvent; onClose: () => void; onViewMap: () => void }) {
  const [related, setRelated] = useState<RelatedResponse['related']>([])
  const severity = getSeverityMeta(event.severity)

  useEffect(() => {
    setRelated([])
    if (!event?.id) return
    fetch(`/api/v1/events/${event.id}/related`)
      .then((response) => response.json() as Promise<RelatedResponse>)
      .then((json) => setRelated(json.related ?? []))
      .catch(() => setRelated([]))
  }, [event?.id])

  const sourceLink = event.source_id ?? undefined

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm p-4 md:p-8"
      >
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring' as const, ...SPRING_SNAPPY, duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto h-full w-full max-w-lg flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0C1220] to-[#070B11]"
        >
          {/* Header */}
          <div className="border-b border-white/[0.06] px-6 py-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <motion.h2
                layoutId={`event-${event.id}`}
                className="text-xl font-bold text-white leading-tight mb-3"
              >
                {toTitleCase(event.title)}
              </motion.h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', severity.chip)}>
                  {severity.label}
                </span>
                <span className="rounded-full border border-white/[0.06] px-2.5 py-1 text-xs text-white/60">
                  {event.event_type ?? 'general'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-white/30 hover:text-white/60 transition-colors hover:bg-white/[0.05]"
            >
              <XIcon_ className="h-5 w-5" />
            </button>
          </div>

          {/* Metadata */}
          <div className="border-b border-white/[0.06] px-6 py-3 text-[12px] text-white/50 space-y-2">
            <div className="flex items-center gap-2">
              <ClockIcon_ className="h-4 w-4 text-white/30" />
              <span>{relativeTime(event.occurred_at)} ({new Date(event.occurred_at ?? Date.now()).toLocaleString()})</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPinIcon_ className="h-4 w-4 text-white/30" />
              <span>{formatRegion(event.region)} {event.country_code && `(${event.country_code})`}</span>
            </div>
            {event.source && (
              <div className="flex items-center gap-2">
                <span className="text-white/30">Source:</span>
                <span>{getOutletDisplay(event.source, event.source_id)}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Description */}
            <div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-2">Summary</div>
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-[13px] leading-6 text-white/70">
                {(event.summary_short ?? event.summary_full ?? event.description ?? event.snippet ?? 'No summary available.').trim()}
              </div>
            </div>

            {/* Entities */}
            {event.entities && Array.isArray(event.entities) && event.entities.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-2">Entities</div>
                <div className="flex flex-wrap gap-2">
                  {event.entities.map((entity, idx) => (
                    <motion.span
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] text-blue-300"
                    >
                      {String(entity)}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}

            {/* Related Events */}
            {related && related.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-[0.15em] text-white/40 font-semibold mb-2">Related Events</div>
                <div className="space-y-2">
                  {related.map((item) => (
                    <div key={item.id} className="rounded-lg border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
                      <div className="text-[12px] font-medium text-white/80">{toTitleCase(item.title)}</div>
                      <div className="mt-1 text-[11px] text-white/30">
                        {formatRegion(item.region)} · {relativeTime(item.occurred_at)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-white/[0.06] px-6 py-4 flex gap-2">
            <button
              onClick={onViewMap}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-blue-500/10 px-4 py-2.5 text-[12px] font-semibold text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <MapPinIcon_ className="h-4 w-4" />
              View on Map
            </button>
            {sourceLink && (
              <a
                href={sourceLink}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-[12px] font-semibold text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <ExternalLinkIcon_ className="h-4 w-4" />
                Source
              </a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export function EventFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [region, setRegion] = useState<string>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newEventCount, setNewEventCount] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastFetchedRef = useRef<Date>(new Date())

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch events
  const fetchEvents = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true)
      const response = await fetch(`/api/v1/events?window=${timeWindow}&limit=200`, { cache: 'no-store' })
      const json = await response.json() as FeedResponse
      const loadedEvents = json.data ?? []

      // Count new events
      if (isRefresh && events.length > 0) {
        const newCount = loadedEvents.filter(e => !events.find(existing => existing.id === e.id)).length
        setNewEventCount(newCount)
      }

      setEvents(loadedEvents)
      lastFetchedRef.current = new Date()
    } finally {
      setLoading(false)
    }
  }, [events, timeWindow])

  // Initial fetch
  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchEvents(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  // Filtered events
  const filteredEvents = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase()
    let result = events.filter((event) => {
      const matchesQuery = !query || `${event.title} ${event.description ?? ''} ${event.region ?? ''} ${event.event_type ?? ''}`.toLowerCase().includes(query)
      const matchesRegion = region === 'all' || event.region === region
      return matchesQuery && matchesCategory(event, category) && matchesSeverity(event, severityFilter) && matchesRegion
    })

    if (sortMode === 'severity') {
      result = [...result].sort((a, b) => (b.severity ?? 1) - (a.severity ?? 1))
    }

    return result
  }, [events, debouncedSearch, category, severityFilter, region, sortMode])

  // Get unique regions
  const regions = useMemo(() => {
    const regionSet = new Set(events.map(e => e.region).filter((r): r is string => !!r))
    return Array.from(regionSet).sort()
  }, [events])

  // Get selected event
  const selectedEvent = useMemo(() => {
    return filteredEvents.find(e => e.id === selectedId)
  }, [filteredEvents, selectedId])

  // Scroll to top handler
  const handleScrollToTop = () => {
    setNewEventCount(0)
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="h-full flex flex-col bg-[#070B11] rounded-xl border border-white/[0.06] overflow-hidden">
      {/* FILTER BAR */}
      <motion.div className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#070B11]/95 backdrop-blur px-4 py-3 space-y-3">
        {/* Live indicator + Search + Sort */}
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400"
          >
            <RadioIcon_ className="h-3.5 w-3.5" />
            LIVE
          </motion.div>

          {/* New events badge */}
          <AnimatePresence>
            {newEventCount > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleScrollToTop}
                className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
              >
                {newEventCount} new
              </motion.button>
            )}
          </AnimatePresence>

          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <SearchIcon_ className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/20" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-8 text-[12px] text-white/70 outline-none placeholder:text-white/20 focus:border-white/[0.12] focus:bg-white/[0.05]"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); searchRef.current?.focus() }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/20 hover:text-white/50"
              >
                <XIcon_ className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <motion.button
            onClick={() => setSortMode(m => m === 'newest' ? 'severity' : 'newest')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors',
              sortMode === 'severity'
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                : 'border-white/[0.06] bg-white/[0.03] text-white/50 hover:bg-white/[0.06]'
            )}
            title="Sort order"
          >
            {sortMode === 'newest' ? 'Newest' : 'Severity'}
          </motion.button>
        </div>

        {/* Time windows row */}
        <div className="flex items-center gap-2 flex-wrap">
          {TIME_WINDOWS.map((value) => (
            <motion.button
              key={value}
              layoutId={`time-${value}`}
              onClick={() => setTimeWindow(value)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                timeWindow === value
                  ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                  : 'border-white/[0.06] text-white/35 hover:text-white/55'
              )}
            >
              {value.toUpperCase()}
            </motion.button>
          ))}
          <div className="ml-auto text-[11px] text-white/30 font-mono">
            {filteredEvents.length === events.length
              ? `${events.length} events`
              : `${filteredEvents.length} of ${events.length}`}
          </div>
        </div>

        {/* Category + Severity row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category dropdown */}
          <motion.div className="relative group">
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/[0.06]">
              <FilterIcon_ className="h-3.5 w-3.5" />
              {CATEGORY_OPTIONS.find(o => o.key === category)?.label ?? 'Category'}
              <ChevronDownIcon_ className="h-3 w-3" />
            </button>
            <div className="absolute left-0 mt-1 hidden group-hover:block bg-[#0C1220] border border-white/[0.06] rounded-lg shadow-lg z-50 min-w-[160px]">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setCategory(option.key)}
                  className={cn(
                    'block w-full text-left px-3 py-2 text-[12px] transition-colors',
                    category === option.key ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/[0.05]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Severity chips */}
          <div className="flex items-center gap-1.5">
            {SEVERITY_OPTIONS.map((option) => {
              const count = events.filter(e => {
                if (option.key === 'all') return true
                return matchesSeverity(e, option.key) && matchesCategory(e, category)
              }).length
              return (
                <motion.button
                  key={option.key}
                  onClick={() => setSeverityFilter(option.key)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                    severityFilter === option.key
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-white/[0.06] text-white/35 hover:text-white/55'
                  )}
                  title={`${option.label}: ${count} events`}
                >
                  {option.label}
                </motion.button>
              )
            })}
          </div>

          {/* Region dropdown */}
          {regions.length > 0 && (
            <motion.div className="relative group ml-auto">
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/[0.06]">
                <MapPinIcon_ className="h-3.5 w-3.5" />
                {region === 'all' ? 'All Regions' : formatRegion(region)}
                <ChevronDownIcon_ className="h-3 w-3" />
              </button>
              <div className="absolute right-0 mt-1 hidden group-hover:block bg-[#0C1220] border border-white/[0.06] rounded-lg shadow-lg z-50 min-w-[180px] max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => setRegion('all')}
                  className={cn(
                    'block w-full text-left px-3 py-2 text-[12px] transition-colors',
                    region === 'all' ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/[0.05]'
                  )}
                >
                  All Regions
                </button>
                {regions.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegion(r)}
                    className={cn(
                      'block w-full text-left px-3 py-2 text-[12px] transition-colors',
                      region === r ? 'bg-blue-500/20 text-blue-300' : 'text-white/60 hover:bg-white/[0.05]'
                    )}
                  >
                    {formatRegion(r)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* TWO-COLUMN LAYOUT */}
      <div className="flex flex-1 min-h-0">
        {/* LEFT: EVENT STREAM (65%) */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-12 text-center text-[12px] text-white/30"
                >
                  Loading intelligence stream…
                </motion.div>
              ) : filteredEvents.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-12 text-center text-[12px] text-white/30"
                >
                  No events match filters
                </motion.div>
              ) : (
                <motion.div
                  key="events"
                  className="space-y-3"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: {
                      transition: {
                        staggerChildren: 0.03,
                      },
                    },
                  }}
                >
                  {filteredEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isSelected={selectedId === event.id}
                      onClick={() => setSelectedId(event.id)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT: DETAIL PANEL OR STATS (35%) */}
        <motion.div
          className="w-[35%] min-w-0 border-l border-white/[0.06] overflow-hidden flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {selectedEvent ? (
              <div key={`detail-${selectedEvent.id}`} className="flex-1 min-h-0 overflow-hidden">
                <EventDetailPanel
                  event={selectedEvent}
                  onClose={() => setSelectedId(null)}
                  onViewMap={() => window.location.href = '/map'}
                />
              </div>
            ) : (
              <div key="stats" className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                <StatsSummary events={filteredEvents} />
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
