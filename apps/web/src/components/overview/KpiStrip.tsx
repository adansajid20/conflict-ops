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
    return { label: 'Active', detail: 'Monitoring active', color: 'bg-green-400' }
  }

  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(lastUpdatedAt).getTime()) / 60000))

  if (ageMin < 15) return { label: 'Live', detail: 'Updated just now', color: 'bg-green-400' }
  if (ageMin < 60) return { label: 'Live', detail: `Updated ${ageMin}m ago`, color: 'bg-green-400' }
  return { label: 'Active', detail: `Updated ${Math.floor(ageMin / 60)}h ago`, color: 'bg-green-400' }
}

function Dot({ colorClass, pulse = false }: { colorClass: string; pulse?: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colorClass} ${pulse ? 'animate-pulse' : ''}`} />
}

function StatCard({
  href,
  label,
  value,
  accentClass,
  meta,
}: {
  href: string
  label: string
  value: string | number
  accentClass?: string
  meta?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.08] hover:-translate-y-0.5"
    >
      <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className={`text-2xl font-bold ${accentClass ?? 'text-white'}`}>
          {value}
        </div>
        {meta}
      </div>
    </Link>
  )
}

export function KpiStrip({ kpis, lastUpdatedAt }: KpiStripProps) {
  const liveMeta = getLiveMeta(lastUpdatedAt)
  const activeConflictColorClass =
    kpis.activeConflictZones > 5 ? 'text-red-400' : kpis.activeConflictZones > 2 ? 'text-orange-400' : undefined

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard
        href="/feed?window=24h"
        label="Active Conflicts"
        value={kpis.activeConflictZones}
        accentClass={activeConflictColorClass}
      />
      <StatCard
        href="/feed?window=24h"
        label="Breaking"
        value={kpis.breaking2h}
        accentClass={kpis.breaking2h > 0 ? 'text-red-400' : undefined}
        meta={kpis.breaking2h > 0 ? <Dot colorClass="bg-red-400" pulse /> : undefined}
      />
      <StatCard href="/feed?window=24h" label="Events Today" value={kpis.eventsWindow} />
      <StatCard href="/feed?window=24h" label="Hot Regions" value={kpis.hotRegionCount} accentClass="text-orange-400" />
      <StatCard href="/feed?window=24h" label="Most Active" value={kpis.mostActiveRegion ?? '—'} accentClass="text-sky-400" />
      <StatCard
        href="/feed?window=24h"
        label="Live"
        value={liveMeta.label}
        accentClass="text-green-400"
        meta={<Dot colorClass="bg-green-400" pulse={liveMeta.label === 'Live'} />}
      />
    </div>
  )
}
