'use client'

import { useEffect, useState } from 'react'

type DayVolume = { date: string; critical: number; high: number; medium: number; low: number; total: number }
type RegionRow = { region: string; critical: number; high: number; medium: number; low: number; total: number }
type CategoryRow = { category: string; count: number }
type TrendsData = {
  days: number; total_events: number; trend: string; this_week: number; last_week: number
  daily_volume: DayVolume[]; region_breakdown: RegionRow[]; category_breakdown: CategoryRow[]
  prediction_accuracy: { confirmed: number; denied: number; expired: number; active: number; total: number; accuracy_pct: number | null }
}

const S = { background: '#080c12', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', muted: '#64748b', accent: '#3b82f6' }
const SEV_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
const TREND_COLOR = { escalating: '#ef4444', de_escalating: '#22c55e', stable: '#64748b' }

function SparkBar({ vals, colors }: { vals: number[]; colors: string[] }) {
  const max = Math.max(...vals, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 32 }}>
      {vals.map((v, i) => (
        <div key={i} style={{ width: 3, height: Math.round((v / max) * 32), background: colors[i % colors.length], borderRadius: 1 }} />
      ))}
    </div>
  )
}

export function TrendsClient() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/trends?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d as TrendsData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: S.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: S.muted, fontSize: 14 }}>Loading trends…</div>
    </div>
  )

  if (!data) return null

  const trendColor = TREND_COLOR[data.trend as keyof typeof TREND_COLOR] ?? '#64748b'
  const weekChange = data.last_week > 0 ? Math.round(((data.this_week - data.last_week) / data.last_week) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: S.background, padding: '32px 28px', fontFamily: '-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Intelligence Trends</h1>
          <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>
            {data.total_events.toLocaleString()} events · {' '}
            <span style={{ color: trendColor, fontWeight: 600 }}>{data.trend.replace('_', '-')}</span>
            {weekChange !== 0 && <span style={{ color: weekChange > 0 ? '#ef4444' : '#22c55e', marginLeft: 8 }}>{weekChange > 0 ? '▲' : '▼'} {Math.abs(weekChange)}% vs last week</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${days === d ? S.accent : S.border}`, background: days === d ? 'rgba(59,130,246,0.15)' : 'transparent', color: days === d ? S.accent : S.muted, fontSize: 13, cursor: 'pointer' }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Events', value: data.total_events.toLocaleString(), color: S.text },
          { label: 'This Week', value: data.this_week.toLocaleString(), color: weekChange > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Active Predictions', value: data.prediction_accuracy.active.toString(), color: '#f97316' },
          { label: 'Prediction Accuracy', value: data.prediction_accuracy.accuracy_pct != null ? `${data.prediction_accuracy.accuracy_pct}%` : 'N/A', color: '#a78bfa' },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Daily volume chart */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Event Volume by Severity</div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, minWidth: Math.max(data.daily_volume.length * 12, 200) }}>
              {data.daily_volume.map(day => {
                const max = Math.max(...data.daily_volume.map(d => d.total), 1)
                const totalH = Math.round((day.total / max) * 80)
                return (
                  <div key={day.date} title={`${day.date}: ${day.total} events`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: 10, cursor: 'default' }}>
                    {(['critical','high','medium','low'] as const).map(sev => {
                      const h = Math.round((day[sev] / max) * 80)
                      return h > 0 ? <div key={sev} style={{ width: 10, height: h, background: SEV_COLORS[sev], borderRadius: 1 }} /> : null
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {(['critical','high','medium','low'] as const).map(sev => (
              <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_COLORS[sev] }} />
                <span style={{ fontSize: 11, color: S.muted, textTransform: 'capitalize' }}>{sev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prediction accuracy */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Prediction Accuracy (30d)</div>
          {[
            { label: 'Confirmed', count: data.prediction_accuracy.confirmed, color: '#22c55e' },
            { label: 'Active', count: data.prediction_accuracy.active, color: '#f97316' },
            { label: 'Expired', count: data.prediction_accuracy.expired, color: '#475569' },
          ].map(row => {
            const pct = data.prediction_accuracy.total > 0 ? Math.round(row.count / data.prediction_accuracy.total * 100) : 0
            return (
              <div key={row.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: row.color }}>{row.label}</span>
                  <span style={{ fontSize: 12, color: S.muted }}>{row.count} ({pct}%)</span>
                </div>
                <div style={{ height: 4, background: S.border, borderRadius: 2 }}>
                  <div style={{ height: 4, background: row.color, borderRadius: 2, width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          {data.prediction_accuracy.accuracy_pct != null && (
            <div style={{ marginTop: 16, fontSize: 28, fontWeight: 700, color: '#a78bfa', textAlign: 'center' }}>
              {data.prediction_accuracy.accuracy_pct}%
              <div style={{ fontSize: 11, color: S.muted, fontWeight: 400, marginTop: 2 }}>accuracy rate</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top regions */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Top Regions by Event Count</div>
          {data.region_breakdown.slice(0, 10).map((row, i) => {
            const maxTotal = Math.max(...data.region_breakdown.map(r => r.total), 1)
            return (
              <div key={row.region} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: S.muted, width: 16, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: S.text }}>{row.region.replace(/_/g, ' ')}</span>
                    <span style={{ fontSize: 11, color: S.muted }}>{row.total}</span>
                  </div>
                  <div style={{ height: 3, background: S.border, borderRadius: 2 }}>
                    <div style={{ height: 3, background: row.critical > 0 ? SEV_COLORS.critical : SEV_COLORS.high, borderRadius: 2, width: `${Math.round(row.total / maxTotal * 100)}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Category breakdown */}
        <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 16 }}>Category Breakdown</div>
          {data.category_breakdown.slice(0, 10).map(row => {
            const maxCount = Math.max(...data.category_breakdown.map(c => c.count), 1)
            const pct = Math.round(row.count / maxCount * 100)
            const catColors: Record<string, string> = { conflict: '#ef4444', military: '#f97316', political: '#eab308', diplomatic: '#3b82f6', humanitarian: '#a78bfa', economic: '#22c55e', maritime: '#06b6d4', cyber: '#ec4899', environmental: '#84cc16', uncategorized: '#475569' }
            const color = catColors[row.category] ?? '#64748b'
            return (
              <div key={row.category} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: S.text, textTransform: 'capitalize' }}>{row.category}</span>
                    <span style={{ fontSize: 11, color: S.muted }}>{row.count}</span>
                  </div>
                  <div style={{ height: 3, background: S.border, borderRadius: 2 }}>
                    <div style={{ height: 3, background: color, borderRadius: 2, width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
