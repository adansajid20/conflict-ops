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
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
        Data Contracts
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Last success</th>
              <th className="px-4 py-3 text-left">Avg interval</th>
              <th className="px-4 py-3 text-left">Failure rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.source} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{row.source}</td>
                <td className="px-4 py-3"><span style={{ color: statusColor(row.status) }}>{row.status.toUpperCase()}</span></td>
                <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{row.last_success_at ? new Date(row.last_success_at).toLocaleString() : 'Never'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{row.avg_fetch_interval_mins ?? '—'} min</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{Math.round(row.failure_rate_7d * 100)}%</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-4" style={{ color: 'var(--text-muted)' }}>No SLA data available.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
