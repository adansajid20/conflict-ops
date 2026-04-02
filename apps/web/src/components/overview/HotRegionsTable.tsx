'use client'

import Link from 'next/link'
import type { HotRegion } from './types'

const RISK_COLORS: Record<HotRegion['riskLevel'], string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Elevated: '#f59e0b',
  Moderate: '#eab308',
  Monitored: '#3b82f6',
}

export function HotRegionsTable({ regions }: { regions: HotRegion[] }) {
  const safeRegions = regions.filter((region) => region.slug !== 'global')
  const maxCount = Math.max(...safeRegions.map((region) => region.eventCount), 1)

  if (safeRegions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No regional activity in the last 24h.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-2, rgba(255,255,255,0.03))' }}>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Region
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Risk
              </th>
              <th className="hidden px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider sm:table-cell" style={{ color: 'var(--text-muted)' }}>
                Primary Driver
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Events
              </th>
            </tr>
          </thead>
          <tbody>
            {safeRegions.map((row, i) => {
              const color = RISK_COLORS[row.riskLevel]
              const primaryDriver = row.topDrivers.find((driver) => driver !== 'Intelligence') ?? row.topDrivers[0] ?? '—'
              const width = `${(row.eventCount / maxCount) * 100}%`
              return (
                <tr key={row.slug} style={{ borderBottom: i < safeRegions.length - 1 ? '1px solid var(--border)' : undefined }}>
                  <td colSpan={4} className="p-0">
                    <Link
                      href={`/feed?region=${encodeURIComponent(row.slug)}`}
                      className="grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_90px] items-center gap-3 px-3 py-3 transition-colors duration-150 max-sm:grid-cols-[minmax(0,1fr)_90px]"
                      style={{ borderLeft: `4px solid ${color}` }}
                    >
                      <div className="min-w-0">
                        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{row.region}</div>
                        <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-1.5 rounded-full" style={{ width, background: color }} />
                        </div>
                      </div>
                      <div className="text-xs font-medium max-sm:hidden" style={{ color }}>{row.riskLevel}</div>
                      <div className="text-xs max-sm:hidden" style={{ color: 'var(--text-secondary)' }}>{primaryDriver}</div>
                      <div className="text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>{row.eventCount}</div>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-1 text-right">
        <Link href="/feed" className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
          View all regions →
        </Link>
      </div>
    </div>
  )
}
