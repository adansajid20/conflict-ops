'use client'

import { useEffect, useState } from 'react'
import type { SourceSLA } from '@/lib/data-contracts/monitor'

function statusColor(status: SourceSLA['status']) {
  if (status === 'green') return '#22C55E'
  if (status === 'amber') return '#F59E0B'
  return '#EF4444'
}

export function DataContractsPanel() {
  const [rows, setRows] = useState<SourceSLA[]>([])

  useEffect(() => {
    void fetch('/api/v1/admin/data-contracts', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data?: SourceSLA[] }>)
      .then((json) => setRows(json.data ?? []))
      .catch(() => setRows([]))
  }, [])

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
      <div className="border-b border-white/[0.05] px-4 py-3 text-sm font-semibold text-white">
        Data Contracts
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/30">
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Last success</th>
              <th className="px-4 py-3 text-left">Avg interval</th>
              <th className="px-4 py-3 text-left">Failure rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source} className="border-t border-white/[0.05]">
                <td className="px-4 py-3 text-white">{row.source}</td>
                <td className="px-4 py-3"><span style={{ color: statusColor(row.status) }}>{row.status.toUpperCase()}</span></td>
                <td className="px-4 py-3 text-white/30">{row.last_success_at ? new Date(row.last_success_at).toLocaleString() : 'Never'}</td>
                <td className="px-4 py-3 text-white">{row.avg_fetch_interval_mins ?? '—'} min</td>
                <td className="px-4 py-3 text-white">{Math.round(row.failure_rate_7d * 100)}%</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-4 text-white/30">No SLA data available.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
