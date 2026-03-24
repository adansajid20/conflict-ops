'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ConflictEvent } from '@conflict-ops/shared'

const SEVERITY_COLORS: Record<number, string> = {
  1: '#10B981',
  2: '#3B82F6',
  3: '#F59E0B',
  4: '#EF4444',
  5: '#FF0000',
}

const SEVERITY_LABELS: Record<number, string> = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'ELEVATED',
  4: 'HIGH',
  5: 'CRITICAL',
}

function EventCard({ event }: { event: ConflictEvent }) {
  const severity = event.severity ?? 1
  const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS[1]
  const label = SEVERITY_LABELS[severity] ?? 'LOW'

  const time = new Date(event.occurredAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })

  return (
    <div
      className="feed-item-enter border-l-2 p-3 mb-2 rounded-r cursor-pointer transition-colors hover:bg-white/5"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderLeftColor: color,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-xs mono tracking-wider mb-1"
            style={{ color }}
          >
            [{label}] {event.countryCode ?? '??'} — {event.eventType.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div
            className="text-sm font-medium leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {event.title}
          </div>
          {event.description && (
            <div
              className="text-xs mt-1 line-clamp-2"
              style={{ color: 'var(--text-muted)' }}
            >
              {event.description}
            </div>
          )}
        </div>
        <div
          className="text-xs mono shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          {time}Z
        </div>
      </div>

      {/* Provenance split */}
      {(event.provenanceRaw !== null || event.provenanceInferred !== null) && (
        <div className="mt-2 pt-2 border-t flex gap-4 text-xs mono" style={{ borderColor: 'var(--border)' }}>
          {event.provenanceRaw && (
            <div style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--primary)' }}>SOURCE: </span>
              {String((event.provenanceRaw as Record<string, unknown>)['attribution'] ?? event.source)}
            </div>
          )}
          {event.provenanceInferred && (
            <div style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent-blue)' }}>INFERRED BY: </span>
              {String((event.provenanceInferred as Record<string, unknown>)['extracted_by'] ?? 'model')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function EventFeed() {
  const [events, setEvents] = useState<ConflictEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/events?limit=50')
      const json = await res.json() as { success: boolean; data?: ConflictEvent[]; error?: string }

      if (!json.success) {
        setError(json.error ?? 'Failed to load events')
        return
      }

      setEvents(json.data ?? [])
      setError(null)
    } catch {
      setError('Network error — retrying...')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEvents()
    // Poll every 60 seconds
    const interval = setInterval(() => { void fetchEvents() }, 60_000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  if (loading) {
    return (
      <div className="p-4 text-xs mono" style={{ color: 'var(--text-muted)' }}>
        <span className="loading-text">LOADING INTELLIGENCE FEED</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-xs mono" style={{ color: 'var(--alert-amber)' }}>
        ⚠ {error}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          NO INTELLIGENCE SIGNALS DETECTED — FEEDS INITIALIZING
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs mono tracking-wider" style={{ color: 'var(--text-muted)' }}>
            INTEL FEED — {events.length} EVENTS
          </div>
          <div className="flex items-center gap-1 text-xs mono" style={{ color: 'var(--alert-green)' }}>
            <span className="status-dot green" style={{ width: '6px', height: '6px', flexShrink: 0 }} />
            LIVE
          </div>
        </div>

        {events.map(event => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  )
}
