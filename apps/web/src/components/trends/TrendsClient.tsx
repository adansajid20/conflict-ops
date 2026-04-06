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
    <div className="min-h-screen bg-[#070B11] flex items-center justify-center">
      <div className="text-white/50 text-sm">Loading trends…</div>
    </div>
  )

  if (!data) return null

  const trendColor = TREND_COLOR[data.trend as keyof typeof TREND_COLOR] ?? '#64748b'
  const weekChange = data.last_week > 0 ? Math.round(((data.this_week - data.last_week) / data.last_week) * 100) : 0

  return (
    <div className="min-h-screen bg-[#070B11] px-7 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white m-0">Intelligence Trends</h1>
          <div className="text-sm text-white/50 mt-1">
            {data.total_events.toLocaleString()} events · {' '}
            <span className="font-semibold" style={{ color: trendColor }}>{data.trend.replace('_', '-')}</span>
            {weekChange !== 0 && <span className="ml-2" style={{ color: weekChange > 0 ? '#ef4444' : '#22c55e' }}>{weekChange > 0 ? '▲' : '▼'} {Math.abs(weekChange)}% vs last week</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`px-4 py-1.5 rounded-lg text-sm cursor-pointer transition-all ${days === d ? 'bg-blue-500 text-white border border-blue-500' : 'bg-white/[0.03] text-white/50 border border-white/[0.05] hover:text-white/70'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Events', value: data.total_events.toLocaleString(), color: 'text-white' },
          { label: 'This Week', value: data.this_week.toLocaleString(), color: weekChange > 0 ? 'text-red-400' : 'text-blue-400' },
          { label: 'Active Predictions', value: data.prediction_accuracy.active.toString(), color: 'text-orange-400' },
          { label: 'Prediction Accuracy', value: data.prediction_accuracy.accuracy_pct != null ? `${data.prediction_accuracy.accuracy_pct}%` : 'N/A', color: 'text-purple-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.03] transition-colors">
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-2">{kpi.label}</div>
            <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-4 mb-4">
        {/* Daily volume chart */}
        <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
          <div className="text-sm font-semibold text-white mb-4">Event Volume by Severity</div>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-0.5 h-20" style={{ minWidth: Math.max(data.daily_volume.length * 12, 200) }}>
              {data.daily_volume.map(day => {
                const max = Math.max(...data.daily_volume.map(d => d.total), 1)
                const totalH = Math.round((day.total / max) * 80)
                return (
                  <div key={day.date} title={`${day.date}: ${day.total} events`} className="flex flex-col justify-end w-2.5 cursor-default">
                    {(['critical','high','medium','low'] as const).map(sev => {
                      const h = Math.round((day[sev] / max) * 80)
                      return h > 0 ? <div key={sev} style={{ width: 10, height: h, background: SEV_COLORS[sev], borderRadius: 1 }} /> : null
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            {(['critical','high','medium','low'] as const).map(sev => (
              <div key={sev} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: SEV_COLORS[sev] }} />
                <span className="text-xs text-white/50 capitalize">{sev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prediction accuracy */}
        <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
          <div className="text-sm font-semibold text-white mb-4">Prediction Accuracy (30d)</div>
          {[
            { label: 'Confirmed', count: data.prediction_accuracy.confirmed, color: '#22c55e' },
            { label: 'Active', count: data.prediction_accuracy.active, color: '#f97316' },
            { label: 'Expired', count: data.prediction_accuracy.expired, color: '#475569' },
          ].map(row => {
            const pct = data.prediction_accuracy.total > 0 ? Math.round(row.count / data.prediction_accuracy.total * 100) : 0
            return (
              <div key={row.label} className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: row.color }}>{row.label}</span>
                  <span className="text-xs text-white/50">{row.count} ({pct}%)</span>
                </div>
                <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-1 rounded-full transition-all" style={{ background: row.color, width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          {data.prediction_accuracy.accuracy_pct != null && (
            <div className="mt-4 text-2xl font-bold text-purple-400 text-center">
              {data.prediction_accuracy.accuracy_pct}%
              <div className="text-xs text-white/50 font-normal mt-0.5">accuracy rate</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Top regions */}
        <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
          <div className="text-sm font-semibold text-white mb-4">Top Regions by Event Count</div>
          {data.region_breakdown.slice(0, 10).map((row, i) => {
            const maxTotal = Math.max(...data.region_breakdown.map(r => r.total), 1)
            return (
              <div key={row.region} className="flex items-center gap-2.5 mb-2.5">
                <span className="text-xs text-white/50 w-4 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white">{row.region.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-white/50">{row.total}</span>
                  </div>
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-1 rounded-full transition-all" style={{ background: row.critical > 0 ? SEV_COLORS.critical : SEV_COLORS.high, width: `${Math.round(row.total / maxTotal * 100)}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Category breakdown */}
        <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
          <div className="text-sm font-semibold text-white mb-4">Category Breakdown</div>
          {data.category_breakdown.slice(0, 10).map(row => {
            const maxCount = Math.max(...data.category_breakdown.map(c => c.count), 1)
            const pct = Math.round(row.count / maxCount * 100)
            const catColors: Record<string, string> = { conflict: '#ef4444', military: '#f97316', political: '#eab308', diplomatic: '#3b82f6', humanitarian: '#a78bfa', economic: '#22c55e', maritime: '#06b6d4', cyber: '#ec4899', environmental: '#84cc16', uncategorized: '#475569' }
            const color = catColors[row.category] ?? '#64748b'
            return (
              <div key={row.category} className="flex items-center gap-2.5 mb-2.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-white capitalize">{row.category}</span>
                    <span className="text-xs text-white/50">{row.count}</span>
                  </div>
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div className="h-1 rounded-full transition-all" style={{ background: color, width: `${pct}%` }} />
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
