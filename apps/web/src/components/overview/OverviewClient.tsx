'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
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
          <div key={i} className="min-h-[96px] rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-16 rounded bg-white/5" />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="h-64 rounded bg-white/5" />
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="h-40 rounded bg-white/5" />
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
    return <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No significant events in the selected timeframe.</div>
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {events.slice(0, 20).map((event) => {
        const tier = getSignificanceTier(event.significance_score ?? null, event.severity)
        const showBadge = !['Monitoring', 'Low', 'Routine'].includes(event.significance_tier ?? tier.label)
        const description = event.description ?? getBestDescription(event, 220)
        const sourceName = getOutletDisplay(event.outlet_name, event.source_id)
        const regionName = getRegionDisplay(event.region) ?? getLocationDisplay(event)
        const timeText = formatRelativeOccurredTime(event.occurred_at)

        return (
          <button
            key={event.id}
            onClick={() => onSelect(event)}
            className="block w-full px-5 py-4 text-left transition-colors duration-150 hover:bg-white/5"
          >
            <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              {showBadge && <span className={`rounded-full px-2 py-0.5 font-semibold ${tier.bgColor} ${tier.color}`}>{event.significance_tier ?? tier.label}</span>}
              <span>{sourceName}</span>
              <span>·</span>
              <span>{regionName}</span>
              <span className="ml-auto tabular-nums">{timeText}</span>
            </div>
            <p className="line-clamp-2 text-sm font-semibold leading-6" style={{ color: 'var(--text-primary)' }}>
              {decodeHtmlEntities(event.title ?? 'Untitled event')}
            </p>
            {isDescriptionMeaningful({ ...event, description }) && (
              <p className="mt-1 text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                {description}
              </p>
            )}
          </button>
        )
      })}
      <div className="px-5 py-4 text-sm">
        <Link href="/feed" className="font-medium" style={{ color: 'var(--primary)' }}>
          Advanced filters &amp; search →
        </Link>
      </div>
      <div className="px-5 pb-4 text-sm">
        <Link href="/feed" className="font-medium" style={{ color: 'var(--primary)' }}>
          View all events in Intel Feed →
        </Link>
      </div>
    </div>
  )
}

function QuickActions({ data, hasOrg }: { data: OverviewData; hasOrg: boolean }) {
  const downloadReport = useCallback(() => {
    const lines = [
      'ConflictRadar Overview Brief',
      `Generated: ${new Date().toISOString()}`,
      '',
      ...data.topStories.slice(0, 10).flatMap((event, index) => [
        `${index + 1}. ${event.title ?? 'Untitled event'}`,
        `   Region: ${getRegionDisplay(event.region) ?? 'Unknown'}`,
        `   Source: ${getOutletDisplay(event.outlet_name, event.source_id)}`,
        `   Time: ${formatRelativeOccurredTime(event.occurred_at)}`,
        `   Summary: ${(event.description ?? getBestDescription(event, 180) ?? '').trim()}`,
        '',
      ]),
    ].join('\n')

    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `conflictradar-brief-${new Date().toISOString().slice(0, 10)}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }, [data])

  return (
    <div className="rounded-xl border p-4 space-y-1.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Quick Actions</div>
      <Link href="/feed?window=24h" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
        <IconRefresh size={14} /> View Intel Feed (24h)
      </Link>
      <Link href="/tracking" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
        <IconMap size={14} /> Open Live Map
      </Link>
      {hasOrg ? (
        <Link href="/alerts/new" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
          <IconBell size={14} /> Set Up Alert
        </Link>
      ) : (
        <Link href="/alerts/new" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
          <IconBell size={14} /> Set Up Alert
        </Link>
      )}
      <button onClick={downloadReport} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>
        <IconDownload size={14} /> Download Report
      </button>
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
    <section className="overflow-hidden rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Regional Risk Scores</h2>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>0–10</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {top.map(r => (
          <div key={r.region} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                {r.region.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(r.risk_score / 10) * 100}%`, background: RISK_COLOR(r.risk_score) }} />
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="text-[10px]" style={{ color: RISK_COLOR(r.risk_score) }}>{TREND_ICON(r.trend)}</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: RISK_COLOR(r.risk_score), fontFamily: 'JetBrains Mono, monospace' }}>
                {r.risk_score.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ActiveSituationsWidget({ situations }: { situations: SituationSummary[] }) {
  if (!situations.length) return null
  const top = situations.slice(0, 5)
  return (
    <section className="overflow-hidden rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Active Situations</h2>
        <Link href="/situations" className="text-[11px] hover:opacity-70" style={{ color: 'var(--text-muted)' }}>View all →</Link>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {top.map(s => (
          <Link key={s.id} href={`/situations/${s.slug}`}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/5 block">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.event_count.toLocaleString()} events · {s.status}</div>
            </div>
            <div className="shrink-0 text-sm font-bold tabular-nums" style={{ color: RISK_COLOR(s.risk_score), fontFamily: 'JetBrains Mono, monospace' }}>
              {s.risk_score.toFixed(1)}
            </div>
          </Link>
        ))}
      </div>
    </section>
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
    <div className="mx-auto max-w-[1400px] p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>Situation Overview</h1>
            {data && isAdmin && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${freshnessBadge.color}18`, color: freshnessBadge.color, border: `1px solid ${freshnessBadge.color}30` }}>
                {freshnessBadge.label}
              </span>
            )}
          </div>
          {data && (
            <div className="mt-1 flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {isAdmin && <><span>Last update: {safeRelativeTime(data.lastUpdatedAt)}</span><span>·</span></>}
              <span>{headerDate}</span>
            </div>
          )}
        </div>

        <div className="flex rounded-lg p-0.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {WINDOWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setWin(key); setSelectedEvent(null); setLastSeenAt(new Date()); setShowBanner(false) }}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-150"
              style={win === key ? { background: 'var(--primary)', color: '#fff' } : { color: 'var(--text-secondary)' }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && !data && (
        <div className="rounded-xl border px-5 py-10 text-center mb-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <IconActivity size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="mb-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Unable to load data</p>
          <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>Try refresh, or check back shortly.</p>
          <button onClick={() => void fetchOverview(win)} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff' }}>
            <IconRefresh size={13} /> Retry
          </button>
        </div>
      )}

      {loading && !data && !error && <OverviewSkeleton />}

      {data && (
        <>
          {showBanner && newEventCount > 0 && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: '#1d4ed8', background: '#0f172a' }}>
              <span className="text-sm" style={{ color: '#bfdbfe' }}>↑ {newEventCount} new events since your last view</span>
              <button
                onClick={() => { setLastSeenAt(new Date()); setShowBanner(false); setNewEventCount(0) }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{ background: '#1d4ed8', color: '#fff' }}
              >
                Show now
              </button>
            </div>
          )}

          {(data.freshnessStatus === 'Stale' || data.freshnessStatus === 'Offline') && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border px-4 py-3" style={{ borderColor: '#f59e0b30', background: '#f59e0b08' }}>
              <IconClock size={14} style={{ color: '#f59e0b' }} />
              <span className="text-sm" style={{ color: '#f59e0b' }}>Updates are delayed. Core tracking continues. Try refresh.</span>
              <button onClick={() => window.location.reload()} className="ml-auto text-xs underline" style={{ color: '#f59e0b' }}>Refresh</button>
            </div>
          )}

          <div className="mb-4">
            <KpiStrip kpis={data.kpis} lastUpdatedAt={data.lastUpdatedAt} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <section className="overflow-hidden rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Top Stories</h2>
              </div>

              {breakingEvents.length > 0 && (
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)', background: 'rgba(239,68,68,0.04)' }}>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-red-500">BREAKING</div>
                  <div className="space-y-2.5">
                    {breakingEvents.map((event) => (
                      <button
                        key={`breaking-${event.id}`}
                        onClick={() => setSelectedEvent(event)}
                        className="flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                        style={{ borderColor: 'rgba(239,68,68,0.18)', borderLeft: '4px solid #ef4444' }}
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide animate-pulse text-red-500">●LIVE</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold leading-6" style={{ color: 'var(--text-primary)' }}>
                            {decodeHtmlEntities(event.title ?? 'Untitled event')}
                          </div>
                          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {[getRegionDisplay(event.region), formatRelativeOccurredTime(event.occurred_at)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <TopStoriesList events={data.topStories} onSelect={setSelectedEvent} />
            </section>

            <div className="space-y-4">
              <section className="overflow-hidden rounded-lg border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Hot Regions</h2>
                </div>
                <div className="p-3">
                  {data.hotRegions.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Insufficient data to rank regions.</p>
                  ) : (
                    <HotRegionsTable regions={data.hotRegions} />
                  )}
                </div>
              </section>

              <RiskScoreWidget scores={riskScores} />
              <ActiveSituationsWidget situations={activeSituations} />
              <QuickActions data={data} hasOrg={data.hasOrg} />
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
    </div>
  )
}
