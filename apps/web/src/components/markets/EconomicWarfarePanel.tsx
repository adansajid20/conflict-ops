'use client'

import { useEffect, useState } from 'react'

type EconomicRow = {
  iso2: string
  name: string
  trend: 'up' | 'down' | 'flat' | 'unknown'
  activeSanctionsCount: number
  riskTier: 'Low' | 'Medium' | 'High'
  latestGdp: number | null
}

function trendGlyph(trend: EconomicRow['trend']) {
  if (trend === 'up') return '↑'
  if (trend === 'down') return '↓'
  if (trend === 'flat') return '→'
  return '·'
}

export function EconomicWarfarePanel() {
  const [rows, setRows] = useState<EconomicRow[]>([])

  useEffect(() => {
    void fetch('/api/v1/markets/economic', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data?: EconomicRow[] }>)
      .then((json) => setRows(json.data ?? []))
      .catch(() => setRows([]))
  }, [])

  return (
    <div className="rounded-xl border bg-white/[0.015] border-white/[0.05]">
      <div className="border-b px-4 py-3 border-white/[0.05]">
        <div className="text-sm font-semibold text-white">Economic Warfare Monitor</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/30">
              <th className="px-4 py-3 text-left">Country</th>
              <th className="px-4 py-3 text-left">GDP trend</th>
              <th className="px-4 py-3 text-left">Active sanctions</th>
              <th className="px-4 py-3 text-left">Risk tier</th>
              <th className="px-4 py-3 text-left">Latest GDP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.iso2} className="border-t border-white/[0.05]">
                <td className="px-4 py-3 text-white">{row.name}</td>
                <td className="px-4 py-3" style={{ color: row.trend === 'down' ? '#EF4444' : row.trend === 'up' ? '#22C55E' : '#FFFFFF' }}>{trendGlyph(row.trend)} {row.trend}</td>
                <td className="px-4 py-3 text-white">{row.activeSanctionsCount}</td>
                <td className="px-4 py-3" style={{ color: row.riskTier === 'High' ? '#EF4444' : row.riskTier === 'Medium' ? '#F59E0B' : '#22C55E' }}>{row.riskTier}</td>
                <td className="px-4 py-3 text-white/30">{row.latestGdp ? `$${Math.round(row.latestGdp).toLocaleString()}` : '—'}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-4 text-white/30">No economic indicators available.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
