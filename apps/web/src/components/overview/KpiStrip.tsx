'use client'

import Link from 'next/link'

interface KpiStripProps {
  kpis: {
    eventsWindow: number
    hotRegionCount: number
    breaking2h: number
    activeConflictZones: number
    mostActiveRegion: string | null
  }
  lastUpdatedAt: string | null
}

function getLiveMeta(lastUpdatedAt: string | null) {
  if (!lastUpdatedAt) {
    return { label: 'Delayed', detail: 'No recent data', color: '#ef4444' }
  }

  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 60000))

  if (ageMin < 5) return { label: 'Live', detail: 'Updated just now', color: '#10b981' }
  if (ageMin < 30) return { label: `${ageMin}m ago`, detail: `Updated ${ageMin}m ago`, color: '#f59e0b' }
  return { label: 'Delayed', detail: `Updated ${ageMin}m ago`, color: '#ef4444' }
}

function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${pulse ? 'animate-pulse' : ''}`} style={{ background: color }} />
}

function StatCard({ href, label, value, accent, meta }: { href: string; label: string; value: string | number; accent?: string; meta?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div
          className="text-2xl font-bold tabular-nums"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: accent ?? 'var(--text-primary)' }}
        >
          {value}
        </div>
        {meta}
      </div>
    </Link>
  )
}

export function KpiStrip({ kpis, lastUpdatedAt }: KpiStripProps) {
  const liveMeta = getLiveMeta(lastUpdatedAt)
  const activeConflictColor = kpis.activeConflictZones > 5 ? '#ef4444' : kpis.activeConflictZones > 2 ? '#f97316' : undefined

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <StatCard
        href="/feed?window=24h"
        label="Active Conflicts"
        value={kpis.activeConflictZones}
        accent={activeConflictColor}
      />
      <StatCard
        href="/feed?window=24h"
        label="Breaking"
        value={kpis.breaking2h}
        accent={kpis.breaking2h > 0 ? '#ef4444' : undefined}
        meta={kpis.breaking2h > 0 ? <Dot color="#ef4444" pulse /> : undefined}
      />
      <StatCard href="/feed?window=24h" label="Events Today" value={kpis.eventsWindow} />
      <StatCard href="/feed?window=24h" label="Hot Regions" value={kpis.hotRegionCount} accent="#f97316" />
      <StatCard href="/feed?window=24h" label="Most Active" value={kpis.mostActiveRegion ?? '—'} accent="#38bdf8" />
      <StatCard
        href="/feed?window=24h"
        label="Live"
        value={liveMeta.label}
        accent={liveMeta.color}
        meta={<Dot color={liveMeta.color} pulse={liveMeta.label === 'Live'} />}
      />
    </div>
  )
}
