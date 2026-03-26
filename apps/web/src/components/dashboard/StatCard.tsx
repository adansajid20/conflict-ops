'use client'

import { Area, AreaChart, ResponsiveContainer } from 'recharts'

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  color,
  sparkData,
}: {
  label: string
  value: string | number
  icon: any
  color: string
  sparkData: number[]
}) {
  const ResponsiveContainerAny = ResponsiveContainer as any
  const AreaChartAny = AreaChart as any
  const AreaAny = Area as any
  const data = sparkData.map((point, index) => ({ index, value: point }))

  return (
    <div className="rounded-lg border p-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>{label}</div>
          <div className="mt-2 text-[32px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: `${color}22` }}><Icon size={20} style={{ color }} /></div>
      </div>
      <div style={{ height: 40 }}>
        <ResponsiveContainerAny width="100%" height="100%">
          <AreaChartAny data={data}>
            <defs>
              <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <AreaAny type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#spark-${label})`} fillOpacity={1} isAnimationActive={false} />
          </AreaChartAny>
        </ResponsiveContainerAny>
      </div>
    </div>
  )
}
