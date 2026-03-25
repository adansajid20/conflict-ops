'use client'

import { useHealthStatus } from '@/hooks/useHealthStatus'

export function FreshnessBanner() {
  const { health, statusLevel } = useHealthStatus(120_000)

  if (!health) return null // loading

  const lastIngestAt = health.ingest?.last_success_at ?? health.lastIngestAt ?? null
  const ingestAgeMs = lastIngestAt
    ? Date.now() - new Date(lastIngestAt).getTime()
    : Infinity

  const stale = ingestAgeMs > 2 * 3600 * 1000 // 2h threshold
  const outage = statusLevel === 'outage'
  const degraded = statusLevel === 'degraded'

  if (outage) {
    return (
      <div className="px-4 py-2 text-xs mono font-bold flex items-center gap-2"
        style={{ backgroundColor: 'rgba(255,68,68,0.1)', borderBottom: '1px solid rgba(255,68,68,0.3)', color: '#FF4444' }}>
        ⚠ DATABASE UNAVAILABLE — Some data may not load. Retry in a moment.
      </div>
    )
  }

  if (degraded) {
    return (
      <div className="px-4 py-2 text-xs mono flex items-center gap-2"
        style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', color: 'var(--alert-amber)' }}>
        ⚠ SYSTEM DEGRADED — {health.degraded_reasons?.[0] ?? health.errors?.[0] ?? 'Some services may be slow'}
        {(health.safe_mode ?? health.safeMode) && <span style={{ marginLeft: 8 }}>· SAFE MODE ACTIVE — heavy jobs paused</span>}
      </div>
    )
  }

  if (stale) {
    const hours = Math.floor(ingestAgeMs / 3600000)
    return (
      <div className="px-4 py-2 text-xs mono flex items-center gap-2"
        style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.15)', color: 'var(--alert-amber)' }}>
        ⌛ DATA MAY BE STALE — Last ingest was {hours}h ago. Ingest runs every 15 minutes.
      </div>
    )
  }

  return null
}
