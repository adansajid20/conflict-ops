'use client'

import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { useCountUp } from '@/hooks/useCountUp'

export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  color,
  sparkData,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  color: string
  sparkData: number[]
}) {
  const ResponsiveContainerAny = ResponsiveContainer as any
  const AreaChartAny = AreaChart as any
  const AreaAny = Area as any
  const numValue = typeof value === 'number' ? value : parseInt(String(value)) || 0
  const isNumeric = typeof value === 'number' || /^\d+$/.test(String(value))
  const animatedCount = useCountUp(numValue, 1000)
  const displayValue = isNumeric ? animatedCount : value
  const gradientId = `spark-${label.replace(/\s/g, '-')}`
  const data = sparkData.map((point, index) => ({ index, value: point }))

  return (
    <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-5 interactive-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/30">{label}</div>
          <div className="mt-2 text-[32px] font-semibold number-shimmer text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{displayValue}</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: `${color}22` }}><Icon size={20} style={{ color }} /></div>
      </div>
      <div style={{ height: 40 }}>
        <ResponsiveContainerAny width="100%" height="100%">
          <AreaChartAny data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                <stop offset="100%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <AreaAny type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} fillOpacity={1} dot={false} />
          </AreaChartAny>
        </ResponsiveContainerAny>
      </div>
    </div>
  )
}
