'use client'

import { useHealthStatus } from '@/hooks/useHealthStatus'

export function FreshnessBanner() {
  const { health } = useHealthStatus(120_000) // poll every 2min

  if (!health) return null

  const lastIngestAt = health.ingest?.last_success_at ?? health.lastIngestAt ?? null
  const ingestAgeMs = lastIngestAt
    ? Date.now() - new Date(lastIngestAt).getTime()
    : Infinity

  const ingestAgeMin = ingestAgeMs / 60000

  // Fresh (< 30 min): hide banner entirely
  if (ingestAgeMin < 30) return null

  // Database unavailable
  if (!isFinite(ingestAgeMs) && !lastIngestAt) return null

  const handleRefresh = () => window.location.reload()

  // Slightly delayed (30 min – 2h): soft message, no alarm
  if (ingestAgeMin < 120) {
    const minutes = Math.floor(ingestAgeMin)
    return (
      <div
        className="px-4 py-2 text-xs mono flex items-center gap-3"
        style={{
          backgroundColor: 'rgba(245,158,11,0.06)',
          borderBottom: '1px solid rgba(245,158,11,0.15)',
          color: 'var(--alert-amber)',
        }}
      >
        <span>Last updated {minutes}m ago</span>
        <button
          onClick={handleRefresh}
          className="rounded px-2 py-0.5 text-[10px] font-semibold border hover:opacity-80 transition-opacity"
          style={{ borderColor: 'rgba(245,158,11,0.4)', color: 'var(--alert-amber)' }}
        >
          Refresh
        </button>
      </div>
    )
  }

  // Paused (> 2h): alarm
  const hours = Math.floor(ingestAgeMin / 60)
  return (
    <div
      className="px-4 py-2 text-xs mono flex items-center gap-3"
      style={{
        backgroundColor: 'rgba(239,68,68,0.06)',
        borderBottom: '1px solid rgba(239,68,68,0.2)',
        color: '#F87171',
      }}
    >
      <span>⚠ Updates paused · last update {hours}h ago</span>
      <button
        onClick={handleRefresh}
        className="rounded px-2 py-0.5 text-[10px] font-semibold border hover:opacity-80 transition-opacity"
        style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#F87171' }}
      >
        Refresh
      </button>
    </div>
  )
}
