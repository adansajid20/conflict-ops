'use client'

type MapLegendProps = {
  activeLayers: Set<string>
}

const SEVERITY_ITEMS = [
  { label: 'Critical', color: '#ef4444' },
  { label: 'High', color: '#f97316' },
  { label: 'Medium', color: '#eab308' },
  { label: 'Low', color: '#6b7280' },
]

const LIVE_LAYER_ITEMS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'seismic', label: 'Seismic', icon: '💥' },
  { key: 'flights', label: 'Flights', icon: '✈️' },
  { key: 'nuclear', label: 'Nuclear', icon: '☢️' },
  { key: 'outages', label: 'Outages', icon: '🌐' },
  { key: 'vessels', label: 'Vessels', icon: '🚢' },
  { key: 'fires', label: 'Fires', icon: '🔥' },
]

export function MapLegend({ activeLayers }: MapLegendProps) {
  const liveItems = LIVE_LAYER_ITEMS.filter((item) => activeLayers.has(item.key))

  return (
    <div className="pointer-events-auto w-[220px] rounded-2xl border border-white/10 bg-[#0d1117]/85 px-3 py-3 backdrop-blur-sm">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Severity</div>
      <div className="space-y-1.5">
        {SEVERITY_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-300">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {liveItems.length > 0 && (
        <>
          <div className="my-3 h-px bg-white/10" />
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Active live layers</div>
          <div className="space-y-1.5">
            {liveItems.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-xs text-slate-300">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
