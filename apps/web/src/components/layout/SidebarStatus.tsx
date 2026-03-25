'use client'

import { useHealthStatus, getStatusLevel } from '@/hooks/useHealthStatus'
import { safeTimeAgo } from '@/types/intel-item'

export function SidebarStatus() {
  const { health, statusLevel } = useHealthStatus(60_000)

  const color = statusLevel === 'nominal' ? 'var(--alert-green)'
    : statusLevel === 'degraded' ? 'var(--alert-amber)'
    : statusLevel === 'outage' ? '#FF4444'
    : 'var(--text-disabled)'

  const label = statusLevel === 'nominal' ? 'NOMINAL'
    : statusLevel === 'degraded' ? 'DEGRADED'
    : statusLevel === 'outage' ? 'OUTAGE'
    : 'CHECKING'

  // Live sources: use new envelope if available, fall back to legacy
  const sources = health?.sources?.detail ?? health?.enabledSources ?? []
  const liveCount = sources.filter(s => s.ok).length
  const totalCount = sources.length || 5

  // Last ingest: new envelope preferred
  const lastIngestAt = health?.ingest?.last_success_at ?? health?.lastIngestAt ?? null
  const ingestAge = lastIngestAt ? Math.floor((Date.now() - new Date(lastIngestAt).getTime()) / 60000) : null

  // Event count
  const eventCount = health?.events?.total ?? health?.eventCount ?? null

  return (
    <div className="p-3 border-t text-xs space-y-1.5 shrink-0"
      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
      {/* System status */}
      <div className="flex items-center gap-2">
        <span className={`status-dot ${statusLevel === 'nominal' ? 'green' : statusLevel === 'degraded' ? 'amber' : 'red'}`} />
        <span className="mono font-bold" style={{ color }}>
          {/* Only show LIVE if health actually says ok=true */}
          {statusLevel === 'loading' ? 'CHECKING...' : label}
        </span>
        {health?.safe_mode && (
          <span className="mono px-1 rounded text-xs"
            style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: 'var(--alert-amber)', fontSize: 9 }}>
            SAFE
          </span>
        )}
      </div>

      {/* Sources */}
      <div className="mono" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
        {health === null ? 'SOURCES: ...' : `FEEDS: ${liveCount}/${totalCount}`}
      </div>

      {/* Events */}
      {eventCount !== null && (
        <div className="mono" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
          EVENTS: {eventCount.toLocaleString()}
        </div>
      )}

      {/* Last ingest */}
      <div className="mono flex items-center gap-1" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
        INGEST: {health === null ? '...' : safeTimeAgo(lastIngestAt)}
        {ingestAge !== null && ingestAge > 120 && (
          <span style={{ color: 'var(--alert-amber)' }}>⚠</span>
        )}
      </div>

      {/* Degraded reason */}
      {statusLevel === 'degraded' && health?.degraded_reasons?.[0] && (
        <div className="mono" style={{ color: 'var(--alert-amber)', fontSize: 9 }}>
          {health.degraded_reasons[0].slice(0, 45)}
        </div>
      )}
    </div>
  )
}
