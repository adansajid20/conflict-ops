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

  if (loading) return <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-6 text-white/50">Scanning for lead indicators…</div>

  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
      {rows.length === 0 ? (
        <div className="p-6 text-sm text-white/30">No meaningful correlations found for the selected window.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/30">
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
                <tr key={`${row.region}-${row.lead_event_type}-${row.follow_event_type}-${index}`} className="border-t border-white/[0.05]">
                  <td className="px-4 py-3 text-white">{row.lead_event_type}</td>
                  <td className="px-4 py-3 text-white">{row.follow_event_type}</td>
                  <td className="px-4 py-3 text-white/50">{row.region}</td>
                  <td className="px-4 py-3 text-white">{row.count}</td>
                  <td className="px-4 py-3 text-white">{row.avg_lag_hours}h</td>
                  <td className="px-4 py-3" style={{ color: confidence >= 70 ? '#22c55e' : '#f97316' }}>{confidence}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
