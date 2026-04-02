'use client'

import type { ReactNode } from 'react'

type WindowValue = '24h' | '72h' | '7d' | '30d'
type SeverityValue = 'all' | 'critical' | 'high' | 'medium'

type MapFilterPanelProps = {
  window: WindowValue
  severity: SeverityValue
  activeLayers: Set<string>
  onWindowChange: (value: WindowValue) => void
  onSeverityChange: (value: SeverityValue) => void
  onLayerToggle: (layer: string) => void
  onReset: () => void
}

const WINDOWS: Array<{ label: string; value: WindowValue }> = [
  { label: '24H', value: '24h' },
  { label: '72H', value: '72h' },
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
]

const SEVERITIES: Array<{ label: string; value: SeverityValue }> = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High+', value: 'high' },
  { label: 'Medium+', value: 'medium' },
]

const LIVE_LAYERS = [
  { key: 'seismic', label: 'Seismic', icon: '💥' },
  { key: 'flights', label: 'Flights', icon: '✈️' },
  { key: 'nuclear', label: 'Nuclear', icon: '☢️' },
  { key: 'outages', label: 'Outages', icon: '🌐' },
  { key: 'vessels', label: 'Vessels', icon: '🚢' },
  { key: 'fires', label: 'Fires', icon: '🔥' },
] as const

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-slate-500">{children}</div>
}

export function MapFilterPanel({
  window,
  severity,
  activeLayers,
  onWindowChange,
  onSeverityChange,
  onLayerToggle,
  onReset,
}: MapFilterPanelProps) {
  return (
    <div className="pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] rounded-3xl border border-white/10 bg-[#0d1117]/90 p-4 backdrop-blur-sm">
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Map Filters</div>
        <div className="text-sm font-semibold text-slate-100">Operational view</div>
      </div>

      <div className="space-y-4">
        <section>
          <SectionLabel>Time window</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {WINDOWS.map((item) => {
              const active = window === item.value
              return (
                <button
                  key={item.value}
                  onClick={() => onWindowChange(item.value)}
                  className={`rounded-2xl border px-2 py-2 text-xs font-medium transition-colors ${active ? 'border-blue-500/60 bg-blue-600 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <SectionLabel>Severity</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {SEVERITIES.map((item) => {
              const active = severity === item.value
              return (
                <button
                  key={item.value}
                  onClick={() => onSeverityChange(item.value)}
                  className={`rounded-2xl border px-3 py-2 text-xs font-medium transition-colors ${active ? 'border-blue-500/60 bg-blue-600 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <SectionLabel>Live layers</SectionLabel>
          <div className="space-y-2">
            {LIVE_LAYERS.map((layer) => {
              const active = activeLayers.has(layer.key)
              return (
                <button
                  key={layer.key}
                  onClick={() => onLayerToggle(layer.key)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
                >
                  <span className="flex items-center gap-2 text-sm text-slate-200">
                    <span>{layer.icon}</span>
                    <span>{layer.label}</span>
                  </span>
                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full p-1 transition-colors ${active ? 'bg-blue-600' : 'bg-slate-700'}`}
                    aria-hidden="true"
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`}
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <button
          onClick={onReset}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
