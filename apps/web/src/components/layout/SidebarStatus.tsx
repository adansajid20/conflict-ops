'use client'

import { useHealthStatus, getStatusLevel } from '@/hooks/useHealthStatus'

function timeAgo(iso: string | null) {
  if (!iso) return 'never'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

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

  const ingestAge = health?.lastIngestAt
    ? Math.floor((Date.now() - new Date(health.lastIngestAt).getTime()) / 60000)
    : null

  return (
    <div className="p-3 border-t text-xs space-y-1" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
      {/* System status */}
      <div className="flex items-center gap-2">
        <span className={`status-dot ${statusLevel === 'nominal' ? 'green' : statusLevel === 'degraded' ? 'amber' : 'red'}`} />
        <span className="mono" style={{ color }}>{label}</span>
        {health?.safeMode && (
          <span className="mono px-1 rounded text-xs" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: 'var(--alert-amber)' }}>
            SAFE
          </span>
        )}
      </div>

      {/* Last ingest */}
      <div className="mono" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
        {health === null
          ? 'CHECKING...'
          : `INGEST: ${timeAgo(health.lastIngestAt)}`}
        {ingestAge !== null && ingestAge > 120 && (
          <span style={{ color: 'var(--alert-amber)' }}> ⚠</span>
        )}
      </div>

      {/* Error summary */}
      {health?.errors && health.errors.length > 0 && (
        <div className="mono" style={{ color: '#FF4444', fontSize: 10 }}>
          {(health.errors[0] ?? '').slice(0, 40)}
        </div>
      )}

      {/* Sources count */}
      {health?.enabledSources && (
        <div className="mono" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
          {health.enabledSources.filter(s => s.ok).length}/{health.enabledSources.length} SOURCES LIVE
        </div>
      )}
    </div>
  )
}
