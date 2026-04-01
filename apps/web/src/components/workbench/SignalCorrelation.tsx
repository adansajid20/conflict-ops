'use client'

import { useEffect, useState } from 'react'

type CorrelationRow = {
  lead_event_type: string
  follow_event_type: string
  region: string
  count: number
  avg_lag_hours: number
}

export function SignalCorrelation() {
  const [rows, setRows] = useState<CorrelationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/v1/intelligence/correlations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 30 }),
    })
      .then((response) => response.json() as Promise<{ data?: CorrelationRow[] }>)
      .then((json) => setRows(json.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>Scanning for lead indicators…</div>

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      {rows.length === 0 ? (
        <div className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No meaningful correlations found for the selected window.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }}>
              <th className="px-4 py-3 text-left">Lead</th>
              <th className="px-4 py-3 text-left">Follow</th>
              <th className="px-4 py-3 text-left">Region</th>
              <th className="px-4 py-3 text-left">Count</th>
              <th className="px-4 py-3 text-left">Avg lag</th>
              <th className="px-4 py-3 text-left">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const confidence = Math.min(100, Math.round(row.count * 12 + Math.max(0, 24 - row.avg_lag_hours)))
              return (
                <tr key={`${row.region}-${row.lead_event_type}-${row.follow_event_type}-${index}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{row.lead_event_type}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{row.follow_event_type}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{row.region}</td>
                  <td className="px-4 py-3">{row.count}</td>
                  <td className="px-4 py-3">{row.avg_lag_hours}h</td>
                  <td className="px-4 py-3" style={{ color: confidence >= 70 ? 'var(--sev-low)' : 'var(--sev-medium)' }}>{confidence}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
