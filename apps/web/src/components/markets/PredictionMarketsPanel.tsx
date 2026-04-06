'use client'

import { useEffect, useState } from 'react'

type Row = { id?: string; external_id?: string; title: string; platform: string; probability?: number | null; resolution_date?: string | null; linked_region?: string | null }
export function PredictionMarketsPanel() {
  const [rows, setRows] = useState<Row[]>([])
  useEffect(() => { void fetch('/api/v1/markets/predictions', { cache: 'no-store' }).then((r) => r.json()).then((json: { data?: Row[] }) => setRows(json.data ?? [])) }, [])
  return <div className="rounded-xl border overflow-hidden bg-white/[0.015] border-white/[0.05]"><table className="w-full text-sm"><thead><tr className="text-white/30"><th className="px-4 py-3 text-left">Question</th><th className="px-4 py-3 text-left">Platform</th><th className="px-4 py-3 text-left">Probability</th><th className="px-4 py-3 text-left">Resolution</th><th className="px-4 py-3 text-left">Region</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id ?? row.external_id ?? row.title} className="border-t border-white/[0.05]"><td className="px-4 py-3 text-white">{row.title}</td><td className="px-4 py-3 text-white/50">{row.platform}</td><td className="px-4 py-3 text-white">{Math.round((row.probability ?? 0) * 100)}%</td><td className="px-4 py-3 text-white/50">{row.resolution_date ? new Date(row.resolution_date).toLocaleDateString() : '—'}</td><td className="px-4 py-3 text-white/50">{row.linked_region ?? '—'}</td></tr>)}</tbody></table>{rows.length === 0 ? <div className="p-4 text-sm text-white/30">No prediction market records yet. Run ingest or seed the table.</div> : null}</div>
}
