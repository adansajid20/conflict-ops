'use client'

import { useRouter } from 'next/navigation'

export interface HotRegion {
  region: string
  riskLevel: 'Critical' | 'High' | 'Moderate' | 'Monitored'
  eventCount: number
  topDrivers: string[]
  topCountries: string[]
}

const RISK_COLORS: Record<HotRegion['riskLevel'], string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Moderate: '#f59e0b',
  Monitored: '#3b82f6',
}

export function HotRegionsTable({ regions }: { regions: HotRegion[] }) {
  const router = useRouter()

  if (regions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No regional activity in the last 24h.
      </div>
    )
  }

  return (
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
              Drivers
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Events
            </th>
          </tr>
        </thead>
        <tbody>
          {regions.map((row, i) => {
            const color = RISK_COLORS[row.riskLevel]
            return (
              <tr
                key={row.region}
                onClick={() => router.push(`/feed?region=${encodeURIComponent(row.region)}`)}
                className="cursor-pointer transition-colors duration-150"
                style={{
                  borderBottom: i < regions.length - 1 ? '1px solid var(--border)' : undefined,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
              >
                <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {row.region}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-xs font-medium" style={{ color }}>{row.riskLevel}</span>
                  </span>
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell" style={{ color: 'var(--text-secondary)' }}>
                  <span className="text-xs">{row.topDrivers.slice(0, 2).join(', ')}</span>
                </td>
                <td className="px-3 py-2.5 text-right" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                  {row.eventCount}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
