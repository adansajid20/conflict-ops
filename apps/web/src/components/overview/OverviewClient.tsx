'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
import type { OverviewData, OverviewEvent } from './types'

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

function TopStoriesList({
  events,
  onSelect,
}: {
  events: OverviewEvent[]
  onSelect: (e: OverviewEvent) => void
}) {
  if (events.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No events in this window. Try switching to 7d or 30d.
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {events.slice(0, 10).map((event) => {
        const sev = SEVERITY_CONFIG[(event.severity as 1|2|3|4) ?? 1] ?? SEVERITY_CONFIG[1]
        const status = STATUS_CONFIG[event.status ?? 'pending'] ?? STATUS_CONFIG['pending']!
        const rel = safeRelativeTime(event.occurred_at)

        return (
          <button
            key={event.id}
            onClick={() => onSelect(event)}
            className="w-full text-left px-5 py-3.5 transition-colors duration-150 block"
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
                style={{ background: sev.bg, color: sev.color }}
              >
                {sev.label}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', color: status.color }}
              >
                {status.label}
              </span>
              {event.country_code && (
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {event.country_code}
                </span>
              )}
              {event.region && (
                <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                  {event.region}
                </span>
              )}
              <span
                className="text-[11px] flex-shrink-0 ml-auto tabular-nums"
                style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}
              >
                {rel}
              </span>
            </div>
            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {event.title ?? 'Untitled event'}
            </p>
          </button>
        )
      })}
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
          disabled
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm"
          style={{ color: 'var(--text-muted)', cursor: 'not-allowed' }}
        >
          <IconBell size={14} /> Create Alert
          <span className="ml-auto text-xs">(Workspace required)</span>
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

  // Trigger ingest every 3 minutes while page is open (rate-limited server-side)
  useEffect(() => {
    // Immediate trigger on load (passive — server-side rate limited)
    fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {})

    const triggerInterval = setInterval(() => {
      fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {})
    }, 3 * 60 * 1000)

    return () => clearInterval(triggerInterval)
  }, [])

  // Auto-refresh overview data every 3 minutes (silent, uses SWR cache)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      void fetchOverview(win)
    }, 3 * 60 * 1000)

    return () => clearInterval(refreshInterval)
  }, [win, fetchOverview])

  const handleWindowChange = (w: Window) => {
    if (w === win) return
    setWin(w)
    setSelectedEvent(null)
  }

  // ─── header meta ───────────────────────────────────────────────────────────

  const freshnessColor = data ? FRESHNESS_COLORS[data.freshnessColor] : 'var(--text-muted)'
  const coverageColor = data ? COVERAGE_COLORS[data.coverageLevel] : 'var(--text-muted)'

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
              <span style={{ color: coverageColor }}>Coverage: {data.coverageLevel}</span>
              {data.coverageTooltip && (
                <span title={data.coverageTooltip} className="cursor-help">
                  <IconInfo size={11} style={{ color: 'var(--text-muted)' }} />
                </span>
              )}
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
              <TopStoriesList
                events={data.topStories}
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
                      No regional activity in this window. Try switching to 7d or 30d.
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
