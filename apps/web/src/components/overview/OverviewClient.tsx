'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Download, Map, Bell, RefreshCw, Activity } from 'lucide-react'
import { safeRelativeTime } from '@/lib/utils/time'
import { KpiStrip } from './KpiStrip'
import { HotRegionsTable } from './HotRegionsTable'
import { EventDetailPanel } from './EventDetailPanel'
import { getBestDescription, getLocationDisplay, getSignificanceTier, getRegionDisplay, getOutletDisplay } from '@/lib/event-presentation'
import type { OverviewData, OverviewEvent } from './types'

const IconClock = Clock as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconDownload = Download as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconMap = Map as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconBell = Bell as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconRefresh = RefreshCw as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconActivity = Activity as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function formatRelativeOccurredTime(occurredAt: string | null | undefined): string {
  if (!occurredAt) return '—'
  const diffMs = Date.now() - new Date(occurredAt).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

function getFreshnessBadge(lastUpdatedAt: string | null) {
  if (!lastUpdatedAt) return { label: 'Stale', color: '#ef4444' }
  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 60000))
  if (ageMin < 15) return { label: 'Live', color: '#10b981' }
  if (ageMin < 60) return { label: 'Delayed', color: '#f59e0b' }
  return { label: 'Stale', color: '#ef4444' }
}

function isDescriptionMeaningful(event: OverviewEvent): boolean {
  const title = (event.title ?? '').trim()
  const description = (event.description ?? getBestDescription(event, 220) ?? '').trim()
  if (description.length < 30) return false
  if (title.slice(0, 80).toLowerCase() === description.slice(0, 80).toLowerCase()) return false
  return true
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="min-h-[96px] rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
            <div className="h-full bg-white/[0.04] rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-16 rounded bg-white/[0.04] animate-pulse" />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
            <div className="h-64 rounded bg-white/[0.04] animate-pulse" />
          </div>
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
            <div className="h-40 rounded bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

const WINDOWS = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
] as const

type Window = typeof WINDOWS[number]['key']

function TopStoriesList({ events, onSelect }: { events: OverviewEvent[]; onSelect: (event: OverviewEvent) => void }) {
  if (events.length === 0) {
    return <div className="px-5 py-10 text-center text-sm text-white/30">No significant events in the selected timeframe.</div>
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {events.slice(0, 20).map((event, idx) => {
        const tier = getSignificanceTier(event.significance_score ?? null, event.severity)
        const showBadge = !['Monitoring', 'Low', 'Routine'].includes(event.significance_tier ?? tier.label)
        const description = event.description ?? getBestDescription(event, 220)
        const sourceName = getOutletDisplay(event.outlet_name, event.source_id)
        const regionName = getRegionDisplay(event.region) ?? getLocationDisplay(event)
        const timeText = formatRelativeOccurredTime(event.occurred_at)

        return (
          <motion.button
            key={event.id}
            onClick={() => onSelect(event)}
            className="block w-full px-5 py-4 text-left transition-colors duration-150 hover:bg-white/[0.03]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24, delay: idx * 0.04 }}
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] text-white/25">
              {showBadge && <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${tier.bgColor} ${tier.color}`}>{event.significance_tier ?? tier.label}</span>}
              <span>{sourceName}</span>
              <span>·</span>
              <span>{regionName}</span>
              <span className="ml-auto tabular-nums">{timeText}</span>
            </div>
            <p className="line-clamp-2 text-[14px] font-medium leading-6 text-white/85">
              {decodeHtmlEntities(event.title ?? 'Untitled event')}
            </p>
            {isDescriptionMeaningful({ ...event, description }) && (
              <p className="mt-1 text-[12px] line-clamp-2 text-white/30">
                {description}
              </p>
            )}
          </motion.button>
        )
      })}
      <div className="px-5 py-4">
        <Link href="/feed" className="text-[13px] font-medium text-blue-400/70 hover:text-blue-400">
          Advanced filters &amp; search →
        </Link>
      </div>
      <div className="px-5 pb-4">
        <Link href="/feed" className="text-[13px] font-medium text-blue-400/70 hover:text-blue-400">
          View all events in Intel Feed →
        </Link>
      </div>
    </div>
  )
}

function QuickActions({ data, hasOrg }: { data: OverviewData; hasOrg: boolean }) {
  const downloadReport = useCallback(() => {
    const date = new Date().toISOString().slice(0, 10)
    const time = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
    const divider = '─'.repeat(60)

    const regionSummary = data.hotRegions.slice(0, 8).map((r) =>
      `  ${r.region.padEnd(22)} ${r.riskLevel.padEnd(12)} ${String(r.eventCount).padStart(4)} events   ${r.topDrivers.slice(0, 2).join(', ')}`
    ).join('\n')

    const topStories = data.topStories.slice(0, 15).map((event, i) => {
      const severity = event.severity != null && event.severity >= 4 ? 'CRITICAL' : event.severity != null && event.severity >= 3 ? 'HIGH' : 'MEDIUM'
      return [
        `  ${i + 1}. [${severity}] ${event.title ?? 'Untitled event'}`,
        `     Region: ${getRegionDisplay(event.region) ?? 'Unknown'} · Source: ${getOutletDisplay(event.outlet_name, event.source_id)} · ${formatRelativeOccurredTime(event.occurred_at)}`,
        `     ${(event.description ?? getBestDescription(event, 200) ?? 'No summary available.').trim()}`,
      ].join('\n')
    }).join('\n\n')

    const situations = (data as OverviewData & { situations?: Array<{ name: string; severity: number; event_count: number }> }).situations
    const situationBlock = situations && situations.length > 0
      ? situations.slice(0, 5).map((s) => `  ${s.name.padEnd(30)} Risk: ${s.severity}   ${s.event_count} events`).join('\n')
      : '  No active situations tracked.'

    const lines = [
      `╔${'═'.repeat(58)}╗`,
      `║   CONFLICTRADAR — SITUATION OVERVIEW BRIEF${' '.repeat(13)}║`,
      `╚${'═'.repeat(58)}╝`,
      '',
      `  Generated: ${time}`,
      `  Window:    ${data.window ?? '24h'} · Events: ${data.kpis.eventsWindow} · Breaking: ${data.kpis.breaking2h} · Hot Regions: ${data.kpis.hotRegionCount}`,
      '',
      divider,
      '  REGIONAL THREAT ASSESSMENT',
      divider,
      '',
      `  ${'Region'.padEnd(22)} ${'Risk'.padEnd(12)} ${'Count'.padStart(5)}   Primary Drivers`,
      `  ${'—'.repeat(22)} ${'—'.repeat(12)} ${'—'.repeat(5)}   ${'—'.repeat(20)}`,
      regionSummary,
      '',
      divider,
      '  TOP STORIES',
      divider,
      '',
      topStories,
      '',
      divider,
      '  ACTIVE SITUATIONS',
      divider,
      '',
      situationBlock,
      '',
      divider,
      '',
      '  This brief was auto-generated by ConflictRadar.',
      `  For live intelligence, visit https://conflictradar.co/overview`,
      '',
    ].join('\n')

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `conflictradar-brief-${date}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [data])

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] overflow-hidden p-4 space-y-1.5">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-white/20">Quick Actions</div>
      <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
        <Link href="/feed?window=24h" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-white/[0.03] text-white/40 hover:text-white/60">
          <IconRefresh size={14} className="text-white/25" /> View Intel Feed (24h)
        </Link>
      </motion.div>
      <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
        <Link href="/map" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-white/[0.03] text-white/40 hover:text-white/60">
          <IconMap size={14} className="text-white/25" /> Open Live Map
        </Link>
      </motion.div>
      <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
        <Link href="/alerts" className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-white/[0.03] text-white/40 hover:text-white/60">
          <IconBell size={14} className="text-white/25" /> Set Up Alert
        </Link>
      </motion.div>
      <motion.button
        onClick={downloadReport}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-white/[0.03] text-white/40 hover:text-white/60"
        whileHover={{ x: 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <IconDownload size={14} className="text-white/25" /> Download Situation Brief
      </motion.button>
    </div>
  )
}

interface RegionRisk { region: string; risk_score: number; trend: string; trend_delta: number }
interface SituationSummary { id: string; name: string; slug: string; severity: string; risk_score: number; event_count: number; status: string }

const RISK_COLOR = (s: number) => s >= 8 ? '#ef4444' : s >= 6 ? '#f97316' : s >= 4 ? '#eab308' : '#22c55e'
const TREND_ICON = (t: string) => t === 'escalating' ? '↑' : t === 'de-escalating' ? '↓' : '→'

function RiskScoreWidget({ scores }: { scores: RegionRisk[] }) {
  if (!scores.length) return null
  const top = [...scores].sort((a, b) => b.risk_score - a.risk_score).slice(0, 6)
  return (
    <motion.section
      className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
        <h2 className="text-[13px] font-semibold text-white/80">Regional Risk Scores</h2>
        <span className="text-[10px] uppercase tracking-[0.15em] text-white/20">0–10</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {top.map((r, idx) => (
          <motion.div
            key={r.region}
            className="flex items-center gap-3 px-4 py-2.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
          >
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-white/60">
                {r.region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div className="mt-1 h-1 w-full rounded-full overflow-hidden bg-white/[0.04]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: RISK_COLOR(r.risk_score) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.risk_score / 10) * 100}%` }}
                  transition={{ duration: 0.8, delay: idx * 0.08, ease: 'easeOut' }}
                />
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="text-[10px]" style={{ color: RISK_COLOR(r.risk_score) }}>{TREND_ICON(r.trend)}</span>
              <motion.span
                className="text-[14px] font-bold tabular-nums"
                style={{ color: RISK_COLOR(r.risk_score) }}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.08 }}
              >
                {r.risk_score.toFixed(1)}
              </motion.span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function ActiveSituationsWidget({ situations }: { situations: SituationSummary[] }) {
  if (!situations.length) return null
  const top = situations.slice(0, 5)
  return (
    <motion.section
      className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
        <h2 className="text-[13px] font-semibold text-white/80">Active Situations</h2>
        <Link href="/situations" className="text-[10px] uppercase tracking-[0.15em] text-white/20 hover:text-white/40">View all →</Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {top.map((s, idx) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
          >
            <Link href={`/situations/${s.slug}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03] block">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate text-white/70">{s.name}</div>
                <div className="text-[10px] mt-0.5 text-white/25">{s.event_count.toLocaleString()} events · {s.status}</div>
              </div>
              <motion.div
                className="shrink-0 text-[14px] font-bold tabular-nums"
                style={{ color: RISK_COLOR(s.risk_score) }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: idx * 0.08 }}
              >
                {s.risk_score.toFixed(1)}
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

export function OverviewClient() {
  const [win, setWin] = useState<Window>('24h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<OverviewData | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<OverviewEvent | null>(null)
  const [lastSeenAt, setLastSeenAt] = useState<Date>(() => new Date())
  const [newEventCount, setNewEventCount] = useState(0)
  const [showBanner, setShowBanner] = useState(false)
  const [riskScores, setRiskScores] = useState<RegionRisk[]>([])
  const [activeSituations, setActiveSituations] = useState<SituationSummary[]>([])
  const cache = useRef<Partial<Record<Window, OverviewData>>>({})

  const fetchOverview = useCallback(async (window: Window) => {
    const cached = cache.current[window]
    if (cached) {
      setData(cached)
      setLoading(false)
      setError(false)
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
      if (!cache.current[window]) {
        setError(true)
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchOverview(win) }, [win, fetchOverview])

  useEffect(() => {
    fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {})
    const triggerInterval = setInterval(() => { fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {}) }, 3 * 60 * 1000)
    return () => clearInterval(triggerInterval)
  }, [])

  useEffect(() => {
    const refreshInterval = setInterval(() => { void fetchOverview(win) }, 60_000)
    return () => clearInterval(refreshInterval)
  }, [win, fetchOverview])

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible') void fetchOverview(win) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [win, fetchOverview])

  // Fetch risk scores + situations once on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/v1/region-risk').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/v1/situations').then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([risk, sits]) => {
      setRiskScores(risk.data ?? [])
      setActiveSituations(sits.data ?? [])
    })
  }, [])

  useEffect(() => {
    if (!data) return
    const baseline = lastSeenAt.getTime()
    const count = data.topStories.filter((event) => {
      const ts = event.occurred_at ? new Date(event.occurred_at).getTime() : 0
      return ts > baseline
    }).length
    setNewEventCount(count)
    setShowBanner(count > 0)
    if (count > 0) {
      const timer = window.setTimeout(() => setShowBanner(false), 10_000)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [data, lastSeenAt])

  const breakingEvents = useMemo(() => {
    if (!data) return []
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    const BREAKING_TYPES = new Set(['conflict', 'armed_conflict', 'airstrike', 'military', 'political', 'terrorism', 'coup'])
    return data.topStories.filter((event) => {
      const ts = event.occurred_at ? new Date(event.occurred_at).getTime() : 0
      if (ts < twoHoursAgo) return false
      if ((event.severity ?? 0) < 3) return false
      if (!event.event_type || !BREAKING_TYPES.has(event.event_type)) return false
      return true
    }).slice(0, 3)
  }, [data])

  const headerDate = useMemo(() => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), [])
  const freshnessBadge = getFreshnessBadge(data?.lastUpdatedAt ?? null)
  const isAdmin = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('admin') === '1' ||
    process.env['NEXT_PUBLIC_ADMIN_MODE'] === 'true'
  )

  return (
    <motion.div
      className="mx-auto max-w-[1400px] p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white">Situation Overview</h1>
            {data && isAdmin && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${freshnessBadge.color}18`, color: freshnessBadge.color, border: `1px solid ${freshnessBadge.color}30` }}>
                {freshnessBadge.label}
              </span>
            )}
          </div>
          {data && (
            <div className="mt-1 flex items-center gap-2 text-[12px] text-white/30">
              {isAdmin && <><span>Last update: {safeRelativeTime(data.lastUpdatedAt)}</span><span>·</span></>}
              <span>{headerDate}</span>
            </div>
          )}
        </div>

        <div className="flex rounded-lg p-0.5 bg-white/[0.04] border border-white/[0.06]">
          {WINDOWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setWin(key); setSelectedEvent(null); setLastSeenAt(new Date()); setShowBanner(false) }}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={win === key ? { background: '#3b82f6', color: '#fff' } : { color: 'text-white/40 hover:text-white/60' }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && !data && (
        <div className="rounded-xl border border-white/[0.05] px-5 py-10 text-center mb-4 bg-white/[0.015]">
          <IconActivity size={32} className="mx-auto mb-3 text-white/30" />
          <p className="mb-1 text-sm font-medium text-white">Unable to load data</p>
          <p className="mb-4 text-xs text-white/30">Try refresh, or check back shortly.</p>
          <button onClick={() => void fetchOverview(win)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 text-white">
            <IconRefresh size={13} /> Retry
          </button>
        </div>
      )}

      {loading && !data && !error && <OverviewSkeleton />}

      {data && (
        <>
          {showBanner && newEventCount > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-blue-500/15 px-4 py-3 bg-blue-500/[0.06]">
              <span className="text-sm text-blue-400">↑ {newEventCount} new events since your last view</span>
              <button
                onClick={() => { setLastSeenAt(new Date()); setShowBanner(false); setNewEventCount(0) }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium bg-blue-500 text-white"
              >
                Show now
              </button>
            </div>
          )}

          {(data.freshnessStatus === 'Stale' || data.freshnessStatus === 'Offline') && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/15 px-4 py-3 bg-amber-500/[0.04]">
              <IconClock size={14} className="text-amber-500" />
              <span className="text-sm text-amber-500">Updates are delayed. Core tracking continues. Try refresh.</span>
              <button onClick={() => window.location.reload()} className="ml-auto text-xs underline text-amber-500">Refresh</button>
            </div>
          )}

          <div className="mb-4">
            <KpiStrip kpis={data.kpis} lastUpdatedAt={data.lastUpdatedAt} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <section className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]">
              <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
                <h2 className="text-[13px] font-semibold text-white/80">Top Stories</h2>
              </div>

              {breakingEvents.length > 0 && (
                <div className="border-b border-white/[0.04] px-5 py-4 bg-red-500/[0.03]">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-400">BREAKING</div>
                  <div className="space-y-2.5">
                    {breakingEvents.map((event) => (
                      <motion.button
                        key={`breaking-${event.id}`}
                        onClick={() => setSelectedEvent(event)}
                        className="flex w-full items-start gap-3 rounded-lg border border-red-500/15 border-l-[3px] border-l-red-500 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                        animate={{ boxShadow: ['0 0 0 0 rgba(239,68,68,0)', '0 0 15px 2px rgba(239,68,68,0.15)', '0 0 0 0 rgba(239,68,68,0)'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] animate-pulse text-red-400">●LIVE</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-medium leading-6 text-white/85">
                            {decodeHtmlEntities(event.title ?? 'Untitled event')}
                          </div>
                          <div className="mt-1 text-[11px] text-white/25">
                            {[getRegionDisplay(event.region), formatRelativeOccurredTime(event.occurred_at)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              <TopStoriesList events={data.topStories} onSelect={setSelectedEvent} />
            </section>

            <div className="space-y-4">
              <motion.section
                className="overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.015]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0 }}
              >
                <div className="border-b border-white/[0.04] px-5 py-4">
                  <h2 className="text-[13px] font-semibold text-white/80">Hot Regions</h2>
                </div>
                <div className="p-3">
                  {data.hotRegions.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-white/30">Insufficient data to rank regions.</p>
                  ) : (
                    <HotRegionsTable regions={data.hotRegions} />
                  )}
                </div>
              </motion.section>

              <RiskScoreWidget scores={riskScores} />
              <ActiveSituationsWidget situations={activeSituations} />
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <QuickActions data={data} hasOrg={data.hasOrg} />
              </motion.div>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {selectedEvent && (
          <EventDetailPanel
            key={selectedEvent.id}
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onSelect={setSelectedEvent}
            hasOrg={data?.hasOrg ?? false}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
