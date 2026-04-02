'use client'

type MapStatsBarProps = {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

export function MapStatsBar({ total, critical, high, medium, low }: MapStatsBarProps) {
  const stats = [
    { label: 'Tracked', value: total, color: 'var(--text-primary)' },
    { label: 'Critical', value: critical, color: '#ef4444' },
    { label: 'High', value: high, color: '#f97316' },
    { label: 'Medium', value: medium, color: '#eab308' },
    { label: 'Low', value: low, color: '#94a3b8' },
  ]

  return (
    <div
      className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 backdrop-blur-md"
      style={{ background: 'rgba(5, 10, 18, 0.8)', borderColor: 'rgba(148,163,184,0.18)' }}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
          <div className="text-sm font-semibold" style={{ color: stat.color }}>{stat.value}</div>
        </div>
      ))}
    </div>
  )
}
