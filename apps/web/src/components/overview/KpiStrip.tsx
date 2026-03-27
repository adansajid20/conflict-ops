'use client'

import Link from 'next/link'

interface KpiCardProps {
  value: number
  label: string
  href: string
  color?: string
}

function KpiCard({ value, label, href, color }: KpiCardProps) {
  return (
    <Link
      href={href}
      className="rounded-xl border p-4 flex flex-col gap-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ fontFamily: 'JetBrains Mono, monospace', color: color ?? 'var(--text-primary)' }}
      >
        {value.toLocaleString()}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </Link>
  )
}

interface KpiStripProps {
  eventCount24h: number
  eventCount7d: number
  hotRegionCount: number
  criticalHighCount: number
  activeAlertsCount: number
  hasOrg: boolean
}

export function KpiStrip({
  eventCount24h,
  eventCount7d,
  hotRegionCount,
  criticalHighCount,
  activeAlertsCount,
  hasOrg,
}: KpiStripProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      <div className="min-w-[130px] flex-1">
        <KpiCard
          value={eventCount24h}
          label="Events 24h"
          href="/feed?window=24h"
        />
      </div>
      <div className="min-w-[130px] flex-1">
        <KpiCard
          value={eventCount7d}
          label="Events 7d"
          href="/feed?window=7d"
          color="#38BDF8"
        />
      </div>
      <div className="min-w-[130px] flex-1">
        <KpiCard
          value={hotRegionCount}
          label="Hot Regions"
          href="/feed?window=24h"
          color="#f97316"
        />
      </div>
      <div className="min-w-[130px] flex-1">
        <KpiCard
          value={criticalHighCount}
          label="Critical / High"
          href="/feed?window=24h&severity=3"
          color="#ef4444"
        />
      </div>
      {hasOrg && (
        <div className="min-w-[130px] flex-1">
          <KpiCard
            value={activeAlertsCount}
            label="Active Alerts"
            href="/alerts"
            color="#8b5cf6"
          />
        </div>
      )}
    </div>
  )
}
