'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import {
  Clock, Newspaper, Map, Bell, RefreshCw, Info, Activity,
} from 'lucide-react'

// Cast lucide icons to avoid React 18 JSX type mismatch in this project's tsconfig
const IconClock      = Clock as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconNewspaper  = Newspaper as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconMap        = Map as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBell       = Bell as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconRefresh    = RefreshCw as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconInfo       = Info as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconActivity   = Activity as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
import { safeRelativeTime } from '@/lib/utils/time'
import { KpiStrip } from './KpiStrip'
import { HotRegionsTable } from './HotRegionsTable'
import { EventDetailPanel } from './EventDetailPanel'
import {
  getEffectiveType,
  getBestDescription,
  getLocationDisplay,
  getSignificanceTier,
  isBreaking,
  UI_CATEGORY_TYPES,
  computeSeverityCounts,
  sanitizeSourceDisplay,
} from '@/lib/event-presentation'
import type { OverviewData, OverviewEvent } from './types'

// ─── event type priority (lower = more important) ────────────────────────────

const EVENT_TYPE_PRIORITY: Record<string, number> = {
  armed_conflict:      1,
  airstrike:           1,
  terrorism:           1,
  political_crisis:    2,
  coup:                2,
  diplomacy:           2,
  humanitarian_crisis: 3,
  civil_unrest:        3,
  natural_disaster:    4,
  news:                5,
}

// ─── HTML entity decoder ──────────────────────────────────────────────────────

function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

// ─── title formatter ──────────────────────────────────────────────────────────

function formatEventTitle(title: string, source: string | null, maxLen = 80): string {
  if (!title) return 'Untitled event'

  // Decode HTML entities first (e.g. &#8217; → ')
  const decoded = decodeHtmlEntities(title)

  if (source === 'noaa') {
    // Extract alert type (text before "issued" or "in effect")
    const type = decoded.split(/\s+issued|\s+in effect/i)[0]?.trim() ?? decoded
    // Extract NWS location from "by NWS [Location] [STATE]"
    const locMatch = decoded.match(/by\s+NWS\s+(.+?)(?:\s*$)/i)
    const loc = locMatch?.[1] ? ` · ${locMatch[1].trim()}` : ''
    const short = type.length > 60 ? type.slice(0, 57) + '…' : type + loc
    return short.length > maxLen ? short.slice(0, maxLen - 1) + '…' : short
  }

  return decoded.length > maxLen ? decoded.slice(0, maxLen - 1) + '…' : decoded
}

// ─── severity / status configs ────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  4: { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  3: { label: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  2: { label: 'Medium',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  1: { label: 'Low',      color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
} as const

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  confirmed:  { label: 'Confirmed',  color: '#10b981' },
  developing: { label: 'Developing', color: '#f59e0b' },
  disputed:   { label: 'Disputed',   color: '#8b5cf6' },
  corrected:  { label: 'Corrected',  color: '#6b7280' },
  pending:    { label: 'Developing', color: '#f59e0b' },
}

// ─── UI category helpers (shared from event-presentation) ────────────────────

// UI category display list
// Uses shared UI_CATEGORY_TYPES from event-presentation for consistent filtering

const CATEGORY_LIST = [
  { key: 'Conflict',   emoji: '⚔️' },
  { key: 'Airstrikes', emoji: '💥' },
  { key: 'Political',  emoji: '🏛️' },
  { key: 'Disasters',  emoji: '🌊' },
  { key: 'News',       emoji: '📰' },
]

const SEVERITY_PILLS = [
  { value: null,  label: 'All',      emoji: null,  activeClass: 'bg-white/10 border-white/30 text-white' },
  { value: 4,     label: 'Critical', emoji: '🔴',  activeClass: 'bg-red-500/20 border-red-500 text-red-400' },
  { value: 3,     label: 'High',     emoji: '🟠',  activeClass: 'bg-orange-500/20 border-orange-500 text-orange-400' },
  { value: 2,     label: 'Medium',   emoji: '🟡',  activeClass: 'bg-yellow-500/20 border-yellow-500 text-yellow-400' },
  { value: 1,     label: 'Low',      emoji: '⚫',  activeClass: 'bg-gray-500/20 border-gray-500 text-gray-400' },
] as const

// ─── filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  allEvents,
  severityFilter,
  setSeverityFilter,
  categoryFilter,
  setCategoryFilter,
  filteredCount,
  totalCount,
  severityCounts,
}: {
  allEvents: OverviewEvent[]
  severityFilter: number | null
  setSeverityFilter: (v: number | null) => void
  categoryFilter: string | null
  setCategoryFilter: (v: string | null) => void
  filteredCount: number
  totalCount: number
  severityCounts?: { critical: number; high: number; medium: number; low: number }
}) {
  const isFiltered = severityFilter !== null || categoryFilter !== null

  // Count events per severity (out of full set)
  const sevCounts = useMemo(() => {
    if (severityCounts) {
      return { 4: severityCounts.critical, 3: severityCounts.high, 2: severityCounts.medium, 1: severityCounts.low }
    }
    const counts = computeSeverityCounts(allEvents)
    return { 4: counts.critical, 3: counts.high, 2: counts.medium, 1: counts.low }
  }, [allEvents, severityCounts])

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    CATEGORY_LIST.forEach(c => {
      counts[c.key] = allEvents.filter(e => UI_CATEGORY_TYPES[c.key]?.includes(getEffectiveType(e.event_type))).length
    })
    return counts
  }, [allEvents])

  return (
    <div
      className="sticky top-0 z-10 border-b px-5 py-3 space-y-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      {/* Row 1 — Severity */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest mr-1" style={{ color: 'var(--text-muted)' }}>
          Severity
        </span>
        {SEVERITY_PILLS.map(pill => {
          const isActive = severityFilter === pill.value
          const count = pill.value !== null ? sevCounts[pill.value] ?? 0 : totalCount
          return (
            <button
              key={String(pill.value)}
              onClick={() => setSeverityFilter(pill.value)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                isActive
                  ? pill.activeClass
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500',
              ].join(' ')}
            >
              {pill.emoji ? `${pill.emoji} ` : ''}{pill.label}
              <span className="ml-1 opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Row 2 — Category */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest mr-1" style={{ color: 'var(--text-muted)' }}>
          Category
        </span>
        <button
          onClick={() => setCategoryFilter(null)}
          className={[
            'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
            categoryFilter === null
              ? 'bg-white/10 border-white/30 text-white'
              : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500',
          ].join(' ')}
        >
          All <span className="ml-1 opacity-60">({totalCount})</span>
        </button>
        {CATEGORY_LIST.map(cat => {
          const isActive = categoryFilter === cat.key
          const count = catCounts[cat.key] ?? 0
          return (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(isActive ? null : cat.key)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                isActive
                  ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                  : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500',
              ].join(' ')}
            >
              {cat.emoji} {cat.key} <span className="ml-1 opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Count + clear */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>
          Showing{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{filteredCount}</span>
          {' '}of{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalCount}</span>
          {' '}events
        </span>
        {isFiltered && (
          <button
            onClick={() => { setSeverityFilter(null); setCategoryFilter(null) }}
            className="underline hover:no-underline"
            style={{ color: 'var(--primary)' }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

const FRESHNESS_COLORS = {
  green:  '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red:    '#ef4444',
}

const COVERAGE_COLORS = {
  High:   '#10b981',
  Medium: '#f59e0b',
  Low:    '#ef4444',
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'rgba(255,255,255,0.07)', ...style }}
    />
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="flex gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex-1 min-w-[120px] rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        {/* Left skeleton */}
        <div className="rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="ml-auto h-4 w-10" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Right skeleton */}
        <div className="space-y-4">
          <div className="rounded-lg border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 px-2 py-2">
                  <Skeleton className="h-4 w-24 flex-1" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <Skeleton className="h-3 w-24 mb-3" />
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── window switcher ─────────────────────────────────────────────────────────

const WINDOWS = [
  { key: '24h', label: '24h' },
  { key: '7d',  label: '7d' },
  { key: '30d', label: '30d' },
] as const

type Window = typeof WINDOWS[number]['key']

// ─── top stories list ─────────────────────────────────────────────────────────

const NOAA_LIMIT = 3

function TopStoriesList({
  events,
  onSelect,
}: {
  events: OverviewEvent[]
  onSelect: (e: OverviewEvent) => void
}) {
  const [noaaExpanded, setNoaaExpanded] = useState(false)

  if (events.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No significant events in the selected timeframe.
      </div>
    )
  }

  // API already returns freshness-ranked stories; preserve that order here.
  const rankedEvents = [...events]

  // Separate NOAA from non-NOAA
  const nonNoaa = rankedEvents.filter((e) => e.source !== 'noaa')
  const noaaAll = rankedEvents.filter((e) => e.source === 'noaa')
  const noaaToShow = noaaExpanded ? noaaAll : noaaAll.slice(0, NOAA_LIMIT)
  const hiddenNoaaCount = noaaAll.length - NOAA_LIMIT

  // Combined list: non-NOAA first (up to 10), then NOAA
  const displayEvents = [...nonNoaa.slice(0, 10 - Math.min(noaaToShow.length, NOAA_LIMIT)), ...noaaToShow]

  const renderRow = (event: OverviewEvent) => {
    const sev = SEVERITY_CONFIG[(event.severity as 1|2|3|4) ?? 1] ?? SEVERITY_CONFIG[1]
    const status = STATUS_CONFIG[event.status ?? 'pending'] ?? STATUS_CONFIG['pending']!
    const rel = safeRelativeTime(event.ingested_at ?? event.occurred_at)
    const displayTitle = formatEventTitle(event.title ?? '', event.source)
    const sourceName = event.source ? sanitizeSourceDisplay(event.source) : ''
    const locationText = getLocationDisplay(event)
    const subtitle = getBestDescription(event, 120)
    const breaking = isBreaking(event)
    const corroboration = event.corroboration_count ?? 0
    const tier = getSignificanceTier((event as OverviewEvent & { significance_score?: number | null }).significance_score)

    return (
      <button
        key={event.id}
        onClick={() => onSelect(event)}
        className="w-full text-left px-5 py-3.5 transition-colors duration-150 block"
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
      >
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {breaking && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              Breaking
            </span>
          )}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${tier.bgColor} ${tier.color}`}>{tier.label}</span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', color: status.color }}
          >
            {status.label}
          </span>
          {corroboration > 1 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>📡 {corroboration} sources</span>
          )}
          <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
            {[sourceName, locationText !== 'Location unknown' ? locationText : null].filter(Boolean).join(' · ')}
          </span>
          <span
            className="text-[11px] flex-shrink-0 ml-auto tabular-nums"
            style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}
          >
            {rel}
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {displayTitle}
        </p>
        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      </button>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {displayEvents.map(renderRow)}

      {/* NOAA "show more" toggle */}
      {!noaaExpanded && hiddenNoaaCount > 0 && (
        <button
          onClick={() => setNoaaExpanded(true)}
          className="w-full text-left px-5 py-3 text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
        >
          + {hiddenNoaaCount} more weather alert{hiddenNoaaCount > 1 ? 's' : ''} from NOAA — click to expand
        </button>
      )}
      {noaaExpanded && hiddenNoaaCount > 0 && (
        <button
          onClick={() => setNoaaExpanded(false)}
          className="w-full text-left px-5 py-3 text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
        >
          ↑ Show fewer weather alerts
        </button>
      )}
    </div>
  )
}

// ─── quick actions ────────────────────────────────────────────────────────────

function QuickActions({ hasOrg }: { hasOrg: boolean }) {
  return (
    <div
      className="rounded-xl border p-4 space-y-1.5"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Quick Actions
      </div>
      <Link
        href="/feed?window=24h"
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '' }}
      >
        <IconNewspaper size={14} /> View Intel Feed (24h)
      </Link>
      <Link
        href="/tracking"
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '' }}
      >
        <IconMap size={14} /> Open Live Map
      </Link>
      {hasOrg ? (
        <Link
          href="/alerts/new"
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '' }}
        >
          <IconBell size={14} /> Create Alert
        </Link>
      ) : (
        <button
          title="Create a workspace to enable alerts"
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm"
          style={{
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
            cursor: 'default',
            opacity: 0.5,
          }}
        >
          🔒 <span>Create Alert</span>
          <span className="ml-auto text-xs" style={{ color: 'var(--text-disabled)' }}>Coming soon</span>
        </button>
      )}
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
      >
        <IconRefresh size={14} /> Refresh Data
      </button>
    </div>
  )
}

// ─── main client ──────────────────────────────────────────────────────────────

export function OverviewClient() {
  const [win, setWin] = useState<Window>('24h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<OverviewData | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<OverviewEvent | null>(null)
  const [severityFilter, setSeverityFilter] = useState<number | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // stale-while-revalidate cache: keyed by window
  const cache = useRef<Partial<Record<Window, OverviewData>>>({})

  const fetchOverview = useCallback(async (window: Window) => {
    // Show cached data immediately if available
    const cached = cache.current[window]
    if (cached) {
      setData(cached)
      setLoading(false)
      setError(false)
      // Still re-fetch in background (no skeleton, data already shown)
    } else {
      setLoading(true)
      setError(false)
      setData(null)
    }

    try {
      const res = await fetch(`/api/v1/overview?window=${window}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as OverviewData
      cache.current[window] = json
      setData(json)
      setError(false)
    } catch {
      // Only show error state if we have nothing to display
      if (!cache.current[window]) {
        setError(true)
        setData(null)
      }
      // If we have cached data, leave it shown — silent background failure
    } finally {
      setLoading(false)
    }
  }, [])

  // Trigger fetch immediately on mount or window change
  useEffect(() => {
    void fetchOverview(win)
  }, [win, fetchOverview])

  // Auto-refresh: ingest is server-side scheduled; no client-side ingest trigger

  // Trigger ingest every 3 minutes while page is open (rate-limited server-side)
  useEffect(() => {
    // Immediate trigger on load (passive — server-side rate limited)
    fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {})

    const triggerInterval = setInterval(() => {
      fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {})
    }, 3 * 60 * 1000)

    return () => clearInterval(triggerInterval)
  }, [])

  // Auto-refresh overview data every 60 seconds (silent, uses SWR cache)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      void fetchOverview(win)
    }, 60_000)

    return () => clearInterval(refreshInterval)
  }, [win, fetchOverview])

  // Also refresh when page becomes visible again (user switches tabs and returns)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchOverview(win)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [win, fetchOverview])

  // Reset filters when window changes so stale counts don't persist
  const handleWindowChange = (w: Window) => {
    if (w === win) return
    setWin(w)
    setSelectedEvent(null)
    setSeverityFilter(null)
    setCategoryFilter(null)
  }

  // Client-side filtered top stories
  const breakingStories = useMemo(() => {
    if (!data) return []

    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    return data.topStories
      .filter((event) => {
        const ts = event.ingested_at ? new Date(event.ingested_at).getTime() : 0
        return ts >= twoHoursAgo && (event.severity === 4 || event.severity === 3)
      })
      .slice(0, 3)
  }, [data])

  const filteredStories = useMemo(() => {
    if (!data) return []
    let result = data.topStories
    if (severityFilter !== null) {
      result = result.filter(e => (e.severity ?? 0) === severityFilter)
    }
    if (categoryFilter !== null) {
      const types = UI_CATEGORY_TYPES[categoryFilter] ?? []
      result = result.filter(e => types.includes(getEffectiveType(e.event_type)))
    }
    // Diversity cap: max 5 events per source domain to prevent GDELT flooding
    // Preserves ingested_at DESC order — just skips excess from same source
    const sourceCounts: Record<string, number> = {}
    const diverse: typeof result = []
    for (const e of result) {
      const src = e.source ?? 'unknown'
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
      if (sourceCounts[src] <= 5) diverse.push(e)
      if (diverse.length >= 20) break
    }
    return diverse
  }, [data, severityFilter, categoryFilter])

  // ─── header meta ───────────────────────────────────────────────────────────

  const freshnessColor = data ? FRESHNESS_COLORS[data.freshnessColor] : 'var(--text-muted)'
  const coverageColor = data ? COVERAGE_COLORS[data.coverageLevel] : 'var(--text-muted)'
  const displayCount = data ? Math.min(20, data.topStories.length) : 0
  const countText = !data ? '' : displayCount === data.topStories.length ? `Showing ${data.topStories.length} events` : `Showing top ${displayCount} of ${data.topStories.length} events`

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      {/* Page header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Situation Overview
            </h1>
            {data && (
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: `${freshnessColor}18`,
                  color: freshnessColor,
                  border: `1px solid ${freshnessColor}30`,
                }}
              >
                {data.freshnessStatus}
              </span>
            )}
          </div>
          {data && (
            <div className="mt-1 flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              <span>Last update: {data.freshnessDescription}</span>
              <span>·</span>
              <span style={{ color: coverageColor }}>Global monitoring across all major conflict zones</span>
              <span>·</span>
              <span>{countText}</span>
            </div>
          )}
        </div>

        {/* Window switcher */}
        <div
          className="flex rounded-lg p-0.5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {WINDOWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleWindowChange(key)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150"
              style={
                win === key
                  ? { background: 'var(--primary)', color: '#fff' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Error state */}
      {error && !data && (
        <div
          className="rounded-xl border px-5 py-10 text-center mb-4"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
        >
          <IconActivity size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Unable to load data
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Try refresh, or check back shortly.
          </p>
          <button
            onClick={() => void fetchOverview(win)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            <IconRefresh size={13} /> Retry
          </button>
        </div>
      )}

      {/* Skeleton on initial load (no cached data) */}
      {loading && !data && !error && <OverviewSkeleton />}

      {/* Main content — shown when we have data (possibly stale while re-fetching) */}
      {data && (
        <>
          {/* Stale/offline banner */}
          {(data.freshnessStatus === 'Stale' || data.freshnessStatus === 'Offline') && (
            <div
              className="rounded-xl border px-4 py-3 flex items-center gap-2 mb-4"
              style={{ borderColor: '#f59e0b30', background: '#f59e0b08' }}
            >
              <IconClock size={14} style={{ color: '#f59e0b' }} />
              <span className="text-sm" style={{ color: '#f59e0b' }}>
                Updates are delayed. Core tracking continues. Try refresh.
              </span>
              <button
                onClick={() => window.location.reload()}
                className="ml-auto text-xs underline"
                style={{ color: '#f59e0b' }}
              >
                Refresh
              </button>
            </div>
          )}

          {/* KPI strip */}
          <div className="mb-4">
            <KpiStrip
              eventCount24h={data.kpis.eventsWindow}
              eventCount7d={data.kpis.events7d}
              hotRegionCount={data.kpis.hotRegionCount}
              criticalHighCount={data.kpis.criticalHighCount}
              activeAlertsCount={data.kpis.activeAlertsCount}
              hasOrg={data.hasOrg}
            />
          </div>

          {/* Background re-fetch indicator (subtle) */}
          {loading && (
            <div className="mb-3 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <IconRefresh size={11} className="animate-spin" />
              Refreshing…
            </div>
          )}

          {/* Main grid */}
          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            {/* Left: Top Stories */}
            <section
              className="rounded-lg border overflow-hidden"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
            >
              <div className="border-b px-5 py-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Top Stories
                </h2>
                <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {win} window
                </span>
              </div>
              {breakingStories.length > 0 && (
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)', background: 'rgba(239,68,68,0.04)' }}>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-red-500">
                    BREAKING
                  </div>
                  <div className="space-y-2.5">
                    {breakingStories.map((event) => {
                      const locationText = getLocationDisplay(event)
                      const sourceName = event.source ? sanitizeSourceDisplay(event.source) : ''
                      return (
                        <button
                          key={`breaking-${event.id}`}
                          onClick={() => setSelectedEvent(event)}
                          className="flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                          style={{ borderColor: 'rgba(239,68,68,0.18)' }}
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide animate-pulse text-red-500">●LIVE</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {formatEventTitle(event.title ?? '', event.source, 100)}
                            </div>
                            <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                              {[sourceName, locationText !== 'Location unknown' ? locationText : null, safeRelativeTime(event.ingested_at ?? event.occurred_at)].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <FilterBar
                allEvents={data.topStories}
                severityFilter={severityFilter}
                setSeverityFilter={setSeverityFilter}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                filteredCount={filteredStories.length}
                totalCount={data.topStories.length}
                severityCounts={data.severityCounts}
              />
              <TopStoriesList
                events={filteredStories}
                onSelect={setSelectedEvent}
              />
            </section>

            {/* Right column */}
            <div className="space-y-4">
              {/* Hot Regions */}
              <section
                className="rounded-lg border overflow-hidden"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              >
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Hot Regions
                  </h2>
                </div>
                <div className="p-3">
                  {data.hotRegions.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      Insufficient data to rank regions.
                    </p>
                  ) : (
                    <HotRegionsTable regions={data.hotRegions} />
                  )}
                </div>
              </section>

              {/* Quick Actions */}
              <QuickActions hasOrg={data.hasOrg} />
            </div>
          </div>
        </>
      )}

      {/* Event Detail Panel */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetailPanel
            key={selectedEvent.id}
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            hasOrg={data?.hasOrg ?? false}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
