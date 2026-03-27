'use client'

import { useHealthStatus } from '@/hooks/useHealthStatus'

export function FreshnessBanner() {
  const { health, statusLevel } = useHealthStatus(300_000) // poll every 5min

  if (!health) return null

  const lastIngestAt = health.ingest?.last_success_at ?? health.lastIngestAt ?? null
  const ingestAgeMs = lastIngestAt
    ? Date.now() - new Date(lastIngestAt).getTime()
    : Infinity

  const ingestAgeMin = ingestAgeMs / 60000
  const events24h = health.events?.inserted_24h ?? health.eventCount ?? 0

  // Compute freshness level
  let level: 'live' | 'delayed' | 'stale' | 'outage'
  if (statusLevel === 'outage') {
    level = 'outage'
  } else if (ingestAgeMin < 15 && events24h > 50) {
    level = 'live'
  } else if (ingestAgeMin < 120) {
    level = 'delayed'
  } else {
    level = 'stale'
  }

  // Don't show banner for LIVE — keep the header clean
  if (level === 'live') return null

  if (level === 'outage') {
    return (
      <div className="px-4 py-2 text-xs mono font-bold flex items-center gap-2"
        style={{ backgroundColor: 'rgba(255,68,68,0.1)', borderBottom: '1px solid rgba(255,68,68,0.3)', color: '#FF4444' }}>
        🔴 DATABASE UNAVAILABLE — Some data may not load. Retry in a moment.
      </div>
    )
  }

  if (level === 'delayed') {
    const minutes = Math.floor(ingestAgeMin)
    return (
      <div className="px-4 py-2 text-xs mono flex items-center gap-2"
        style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', color: 'var(--alert-amber)' }}>
        🟡 <strong>DELAYED</strong> — Last ingest {minutes}m ago · Data may be {minutes}+ minutes behind
        {(health.safe_mode ?? health.safeMode) && <span style={{ marginLeft: 8 }}>· SAFE MODE: heavy jobs paused</span>}
      </div>
    )
  }

  // stale
  const hours = Math.floor(ingestAgeMin / 60)
  return (
    <div className="px-4 py-2 text-xs mono flex items-center gap-2"
      style={{ backgroundColor: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
      🔴 <strong>STALE</strong> — Last ingest {hours}h ago · Ingest pipeline may be down ·{' '}
      <a href="/admin" className="underline opacity-80">Check Admin</a>
    </div>
  )
}
