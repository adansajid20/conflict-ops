'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ConflictEvent } from '@conflict-ops/shared'
import { useTimeWindow, TIME_WINDOWS, type TimeWindow } from '@/hooks/useTimeWindow'

const SEVERITY_COLORS: Record<number, string> = {
  1: '#888888', 2: '#3B82F6', 3: '#F59E0B', 4: '#EF4444', 5: '#FF0000',
}
const SEVERITY_LABELS: Record<number, string> = {
  1: 'INFO', 2: 'LOW', 3: 'MEDIUM', 4: 'HIGH', 5: 'CRITICAL',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function EventSkeleton() {
  return (
    <div className="border-l-2 p-3 mb-2 rounded-r"
      style={{ borderLeftColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="skeleton h-3 rounded mb-2" style={{ width: '60%' }} />
      <div className="skeleton h-4 rounded mb-2" style={{ width: '90%' }} />
      <div className="skeleton h-3 rounded" style={{ width: '40%' }} />
    </div>
  )
}

function EventCard({ event }: { event: ConflictEvent }) {
  const severity = event.severity ?? 2
  const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[2]
  const label = SEVERITY_LABELS[severity] ?? 'LOW'
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="border-l-2 p-3 mb-2 rounded-r cursor-pointer transition-colors hover:bg-white/5 feed-item-enter"
      style={{ backgroundColor: 'var(--bg-surface)', borderLeftColor: color }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs mono font-bold shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
          style={{ color, backgroundColor: `${color}22` }}>
          {label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
            {event.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs mono" style={{ color: 'var(--text-muted)' }}>
            {event.countryCode && <span>{event.countryCode}</span>}
            {event.region && <span>· {event.region}</span>}
            <span>· {event.source?.toUpperCase()}</span>
            <span>· {timeAgo(event.occurredAt)}</span>
          </div>
          {expanded && event.description && (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {event.description}
            </p>
          )}
          {expanded && (
            <div className="mt-1 text-xs mono" style={{ color: 'var(--text-disabled)' }}>
              {event.eventType && <span>TYPE: {event.eventType.toUpperCase()} · </span>}
              INGESTED: {timeAgo(event.ingestedAt ?? event.occurredAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function EventFeed() {
  const { window, setWindow, sinceISO } = useTimeWindow('24h')
  const [events, setEvents] = useState<ConflictEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [apiStatus, setApiStatus] = useState<'live' | 'degraded' | 'error'>('live')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const seqRef = useRef(0)

  const fetchEvents = useCallback(async (w: TimeWindow) => {
    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const seq = ++seqRef.current

    setLoading(true)

    try {
      const since = new Date(Date.now() - windowToMs(w)).toISOString()
      const res = await fetch(`/api/v1/events?limit=100&since=${since}`, {
        signal: abortRef.current.signal,
      })

      // Only update state if this is still the latest request
      if (seq !== seqRef.current) return

      if (!res.ok) {
        const text = await res.text()
        let msg = `HTTP ${res.status}`
        try { msg = (JSON.parse(text) as { error?: string }).error ?? msg } catch { /* HTML response */ }
        setApiStatus('error')
        setErrorMsg(msg)
        return
      }

      const json = await res.json() as { success: boolean; data?: ConflictEvent[]; error?: string }
      if (!json.success) {
        setApiStatus('degraded')
        setErrorMsg(json.error ?? 'Request failed')
        return
      }

      setEvents(json.data ?? [])
      setApiStatus('live')
      setErrorMsg(null)
      setLastFetchedAt(new Date())
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return
      if (seq !== seqRef.current) return
      setApiStatus('degraded')
      setErrorMsg('Network error — check connection')
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEvents(window)
    const id = setInterval(() => void fetchEvents(window), 60_000)
    return () => { clearInterval(id); abortRef.current?.abort() }
  }, [window, fetchEvents])

  const statusColor = apiStatus === 'live' ? 'var(--alert-green)' : apiStatus === 'degraded' ? 'var(--alert-amber)' : '#FF4444'
  const statusLabel = apiStatus === 'live' ? 'LIVE' : apiStatus === 'degraded' ? 'DEGRADED' : 'ERROR'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-1">
          {TIME_WINDOWS.map(w => (
            <button key={w} onClick={() => setWindow(w)}
              className="px-2 py-1 rounded text-xs mono transition-colors"
              style={{
                backgroundColor: window === w ? 'var(--primary)' : 'transparent',
                color: window === w ? '#000' : 'var(--text-muted)',
              }}>
              {w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {errorMsg && (
            <span className="text-xs mono" style={{ color: 'var(--alert-amber)' }}>
              ⚠ {errorMsg.slice(0, 60)}
            </span>
          )}
          {lastFetchedAt && (
            <span className="text-xs mono" style={{ color: 'var(--text-disabled)' }}>
              {timeAgo(lastFetchedAt.toISOString())}
            </span>
          )}
          <div className="flex items-center gap-1 text-xs mono" style={{ color: statusColor }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
            {statusLabel}
          </div>
          {apiStatus !== 'live' && (
            <button onClick={() => void fetchEvents(window)}
              className="text-xs mono px-2 py-0.5 rounded border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              RETRY
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div>{Array.from({ length: 8 }).map((_, i) => <EventSkeleton key={i} />)}</div>
        ) : apiStatus === 'error' ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-4">⚠</div>
            <p className="mono text-sm mb-2" style={{ color: '#FF4444' }}>INTEL FEED UNAVAILABLE</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {errorMsg ?? 'Unknown error occurred'}
            </p>
            <button onClick={() => void fetchEvents(window)}
              className="px-6 py-2 rounded text-xs mono font-bold"
              style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
              RETRY
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-4">📡</div>
            <p className="mono text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              No events in the {window} window
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Intel ingest runs every 15 minutes. Try expanding the time window.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setWindow('7d')}
                className="px-4 py-2 rounded text-xs mono"
                style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
                View 7d window
              </button>
              <button onClick={() => void fetchEvents(window)}
                className="px-4 py-2 rounded text-xs mono border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
                {events.length} EVENTS — {window.toUpperCase()} WINDOW
              </span>
              {lastFetchedAt && (
                <span className="text-xs mono" style={{ color: 'var(--text-disabled)' }}>
                  Updated {timeAgo(lastFetchedAt.toISOString())}
                </span>
              )}
            </div>
            {events.map(event => <EventCard key={event.id} event={event} />)}
          </>
        )}
      </div>
    </div>
  )
}

// Helper (duplicated from hook to avoid circular import in this file)
function windowToMs(w: TimeWindow): number {
  const map: Record<TimeWindow, number> = {
    '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000,
  }
  return map[w]
}
