'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import type { HotRegion } from './types'

const RISK_COLORS: Record<HotRegion['riskLevel'], string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Elevated: '#f59e0b',
  Moderate: '#eab308',
  Monitored: '#3b82f6',
}

const RISK_BG_OPACITY: Record<HotRegion['riskLevel'], string> = {
  Critical: 'bg-red-500/15',
  High: 'bg-orange-500/15',
  Elevated: 'bg-amber-500/15',
  Moderate: 'bg-yellow-500/15',
  Monitored: 'bg-blue-500/15',
}

const RISK_TEXT_COLOR: Record<HotRegion['riskLevel'], string> = {
  Critical: 'text-red-500',
  High: 'text-orange-500',
  Elevated: 'text-amber-500',
  Moderate: 'text-yellow-500',
  Monitored: 'text-blue-500',
}

export function HotRegionsTable({ regions }: { regions: HotRegion[] }) {
  const safeRegions = regions.filter((region) => region.slug !== 'global')
  const maxCount = Math.max(...safeRegions.map((region) => region.eventCount), 1)

  if (safeRegions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-white/40">
        No regional activity in the last 24h.
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="rounded-xl border border-white/[0.05] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.04]">
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/20">
                Region
              </th>
              <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/20">
                Risk
              </th>
              <th className="hidden px-3 py-2 text-left text-[10px] uppercase tracking-[0.15em] font-medium text-white/20 sm:table-cell">
                Primary Driver
              </th>
              <th className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.15em] font-medium text-white/20">
                Events
              </th>
            </tr>
          </thead>
          <tbody>
            {safeRegions.map((row, i) => {
              const color = RISK_COLORS[row.riskLevel]
              const bgOpacity = RISK_BG_OPACITY[row.riskLevel]
              const textColor = RISK_TEXT_COLOR[row.riskLevel]
              const primaryDriver = row.topDrivers.find((driver) => driver !== 'Intelligence') ?? row.topDrivers[0] ?? '—'
              const width = `${(row.eventCount / maxCount) * 100}%`
              return (
                <motion.tr
                  key={row.slug}
                  className={i < safeRegions.length - 1 ? 'border-b border-white/[0.04]' : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                >
                  <td colSpan={4} className="p-0">
                    <Link
                      href={`/feed?region=${encodeURIComponent(row.slug)}`}
                      className="grid grid-cols-[minmax(0,1.2fr)_120px_minmax(0,1fr)_90px] items-center gap-3 px-3 py-3 transition-colors duration-150 hover:bg-white/[0.03] max-sm:grid-cols-[minmax(0,1fr)_90px]"
                      style={{ borderLeft: `3px solid ${color}` }}
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-white/80">{row.region}</div>
                        <div className="mt-1 h-1 w-full rounded-full bg-white/[0.04]">
                          <motion.div
                            className="h-1 rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width }}
                            transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                      <div className={`max-sm:hidden rounded-md px-2 py-0.5 text-[10px] font-semibold w-fit ${bgOpacity} ${textColor}`}>
                        {row.riskLevel}
                      </div>
                      <div className="text-[13px] text-white/60 max-sm:hidden">{primaryDriver}</div>
                      <div className="text-right text-[13px] text-white/60 tabular-nums">{row.eventCount}</div>
                    </Link>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-1 text-right">
        <motion.div
          whileHover={{ x: 4 }}
          transition={{ duration: 0.2 }}
        >
          <Link href="/analysis/countries" className="text-[12px] text-white/30 hover:text-white/50 transition-colors duration-150">
            View all regions →
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}
