'use client'

type MapStatsBarProps = {
  total: number
  critical: number
  high: number
  medium: number
  low: number
}

const BREAKDOWN = [
  { label: 'CRIT', key: 'critical', color: '#ef4444' },
  { label: 'HIGH', key: 'high', color: '#f97316' },
  { label: 'MED', key: 'medium', color: '#eab308' },
  { label: 'LOW', key: 'low', color: '#94a3b8' },
] as const

export function MapStatsBar({ total, critical, high, medium, low }: MapStatsBarProps) {
  const counts = { critical, high, medium, low }

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1117]/85 px-3 py-2 backdrop-blur-sm">
      <div className="rounded-xl bg-white/5 px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Tracked</div>
        <div className="text-sm font-semibold text-slate-100">{total}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {BREAKDOWN.map((item) => (
          <div key={item.key} className="rounded-xl bg-white/5 px-3 py-2 text-xs">
            <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: item.color }}>
              {item.label}
            </div>
            <div className="text-sm font-semibold text-slate-100">{counts[item.key]}</div>
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-emerald-300">
        <span className="live-dot" />
        <span className="font-medium uppercase tracking-[0.2em]">Live</span>
      </div>
    </div>
  )
}
