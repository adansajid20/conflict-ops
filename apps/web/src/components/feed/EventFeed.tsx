'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ConflictEvent } from '@conflict-ops/shared'

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
    <div className="border-l-2 p-3 mb-2 rounded-r animate-pulse"
      style={{ borderLeftColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="h-3 rounded mb-2" style={{ backgroundColor: 'var(--border)', width: '60%' }} />
      <div className="h-4 rounded mb-2" style={{ backgroundColor: 'var(--border)', width: '90%' }} />
      <div className="h-3 rounded" style={{ backgroundColor: 'var(--border)', width: '40%' }} />
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
      className="border-l-2 p-3 mb-2 rounded-r cursor-pointer transition-colors hover:bg-white/5"
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
        </div>
      </div>
    </div>
  )
}

const WINDOWS = ['1h', '6h', '24h', '7d', '30d'] as const
type Window = typeof WINDOWS[number]

function windowToHours(w: Window): number {
  if (w === '1h') return 1
  if (w === '6h') return 6
  if (w === '24h') return 24
  if (w === '7d') return 168
  return 720
}

export function EventFeed() {
  const [events, setEvents] = useState<ConflictEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [window, setWindow] = useState<Window>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('feed_window') as Window) ?? '24h'
    }
    return '24h'
  })
  const abortRef = useRef<AbortController | null>(null)

  const fetchEvents = useCallback(async (w: Window, isRetry = false) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    if (!isRetry) setLoading(true)

    try {
      const hours = windowToHours(w)
      const since = new Date(Date.now() - hours * 3600000).toISOString()
      const res = await fetch(`/api/v1/events?limit=100&since=${since}`, {
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        // Safely parse even if HTML returned
        const text = await res.text()
        let msg = `HTTP ${res.status}`
        try { msg = (JSON.parse(text) as { error?: string }).error ?? msg } catch { /* text is HTML */ }
        setError(msg)
        return
      }

      const json = await res.json() as { success: boolean; data?: ConflictEvent[]; error?: string }
      if (!json.success) { setError(json.error ?? 'Failed'); return }
      setEvents(json.data ?? [])
      setError(null)
      setRetryCount(0)
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return
      setError('Network error — retrying...')
      // Exponential backoff retry (max 3)
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(r => r + 1)
          void fetchEvents(w, true)
        }, Math.pow(2, retryCount) * 2000)
      }
    } finally {
      setLoading(false)
    }
  }, [retryCount])

  useEffect(() => {
    void fetchEvents(window)
    const interval = setInterval(() => void fetchEvents(window), 60_000)
    return () => { clearInterval(interval); abortRef.current?.abort() }
  }, [window, fetchEvents])

  const handleWindowChange = (w: Window) => {
    setWindow(w)
    localStorage.setItem('feed_window', w)
    setLoading(true)
    // Update URL without navigation
    const url = new URL(globalThis.location.href)
    url.searchParams.set('window', w)
    globalThis.history.replaceState({}, '', url.toString())
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-1">
          {WINDOWS.map(w => (
            <button key={w} onClick={() => handleWindowChange(w)}
              className="px-2 py-1 rounded text-xs mono transition-colors"
              style={{
                backgroundColor: window === w ? 'var(--primary)' : 'transparent',
                color: window === w ? '#000' : 'var(--text-muted)',
              }}>
              {w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs mono" style={{ color: 'var(--alert-amber)' }}>⚠ {error}</span>
          )}
          <div className="flex items-center gap-1 text-xs mono" style={{ color: 'var(--alert-green)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--alert-green)' }} />
            LIVE
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div>{Array.from({ length: 8 }).map((_, i) => <EventSkeleton key={i} />)}</div>
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
              <button onClick={() => handleWindowChange('7d')}
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
            </div>
            {events.map(event => <EventCard key={event.id} event={event} />)}
          </>
        )}
      </div>
    </div>
  )
}
