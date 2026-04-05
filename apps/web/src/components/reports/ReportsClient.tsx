'use client'

import { useEffect, useState } from 'react'

type Report = { id: string; report_type: string; title: string; summary: string | null; region: string | null; created_at: string }

const S = { background: '#080c12', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', muted: '#64748b', accent: '#3b82f6' }
const TYPE_COLORS: Record<string, string> = { daily_briefing: '#3b82f6', weekly_summary: '#a78bfa', region_deep_dive: '#22c55e', incident_report: '#ef4444', flash_report: '#f97316', prediction_report: '#eab308', custom: '#64748b' }

export function ReportsClient() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genRegion, setGenRegion] = useState('')

  useEffect(() => {
    fetch('/api/v1/reports?limit=30')
      .then(r => r.json())
      .then(d => { setReports((d as { reports: Report[] }).reports ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const generateReport = async () => {
    if (!genRegion.trim()) return
    setGenerating(true)
    try {
      const res = await fetch('/api/v1/reports/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report_type: 'region_deep_dive', region: genRegion }),
      })
      const data = await res.json() as { report?: Report }
      if (data.report) setReports(prev => [data.report as Report, ...prev])
    } catch { /* ok */ }
    setGenerating(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.muted, fontSize: 14 }}>Loading reports…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.background, padding: '32px 28px', fontFamily: '-apple-system,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Intelligence Reports</h1>
          <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>{reports.length} reports available</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={genRegion}
            onChange={e => setGenRegion(e.target.value)}
            placeholder="Region (e.g. Ukraine)"
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: 13, width: 180 }}
          />
          <button
            onClick={generateReport}
            disabled={generating || !genRegion.trim()}
            style={{ padding: '8px 18px', borderRadius: 8, background: S.accent, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : '+ Generate'}
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: S.muted, fontSize: 14 }}>
          No reports yet. Generate one above or wait for the daily briefing at 06:00 UTC.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.map(r => {
            const color = TYPE_COLORS[r.report_type] ?? '#64748b'
            return (
              <div key={r.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '20', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                    {r.report_type.replace(/_/g, ' ')}
                  </span>
                  {r.region && <span style={{ fontSize: 11, color: S.muted }}>{r.region}</span>}
                  <span style={{ fontSize: 11, color: S.muted, marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 6 }}>{r.title}</div>
                {r.summary && <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{r.summary.slice(0, 200)}…</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
