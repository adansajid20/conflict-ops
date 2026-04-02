'use client'

import type { MapFilters } from './ConflictMap'

type MapFilterPanelProps = {
  filters: MapFilters
  onChange: (next: MapFilters) => void
  onClose: () => void
}

const WINDOWS = [
  { label: '24H', value: 24 },
  { label: '72H', value: 72 },
  { label: '7D', value: 168 },
  { label: '30D', value: 720 },
]

const SEVERITIES = [
  { label: 'All severities', value: 'all' },
  { label: 'Critical only', value: '4' },
  { label: 'High + Critical', value: '3' },
  { label: 'Medium +', value: '2' },
]

export function MapFilterPanel({ filters, onChange, onClose }: MapFilterPanelProps) {
  return (
    <div
      className="pointer-events-auto w-[300px] max-w-[calc(100vw-2rem)] rounded-3xl border p-4 backdrop-blur-xl"
      style={{ background: 'rgba(5, 10, 18, 0.9)', borderColor: 'rgba(148,163,184,0.18)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.26em]" style={{ color: 'var(--text-muted)' }}>Map Filters</div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Operational view</div>
        </div>
        <button onClick={onClose} className="rounded-full px-2 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>Time window</div>
          <div className="grid grid-cols-2 gap-2">
            {WINDOWS.map((window) => (
              <button
                key={window.value}
                onClick={() => onChange({ ...filters, hours: window.value })}
                className="rounded-2xl border px-3 py-2 text-left text-xs transition-colors"
                style={{
                  borderColor: filters.hours === window.value ? 'rgba(96,165,250,0.45)' : 'rgba(148,163,184,0.18)',
                  background: filters.hours === window.value ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.02)',
                  color: filters.hours === window.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {window.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>Severity</div>
          <div className="space-y-2">
            {SEVERITIES.map((severity) => (
              <button
                key={severity.value}
                onClick={() => onChange({ ...filters, minSeverity: severity.value === 'all' ? null : Number(severity.value) })}
                className="block w-full rounded-2xl border px-3 py-2 text-left text-xs transition-colors"
                style={{
                  borderColor:
                    (severity.value === 'all' && filters.minSeverity === null) || Number(severity.value) === filters.minSeverity
                      ? 'rgba(251,146,60,0.45)'
                      : 'rgba(148,163,184,0.18)',
                  background:
                    (severity.value === 'all' && filters.minSeverity === null) || Number(severity.value) === filters.minSeverity
                      ? 'rgba(249,115,22,0.14)'
                      : 'rgba(255,255,255,0.02)',
                  color: 'var(--text-secondary)',
                }}
              >
                {severity.label}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="mb-2 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>Search title / region</div>
          <input
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            placeholder="Ukraine, Red Sea, airstrike..."
            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(148,163,184,0.18)', color: 'var(--text-primary)' }}
          />
        </label>

        <button
          onClick={() => onChange({ hours: 168, minSeverity: null, query: '' })}
          className="w-full rounded-2xl border px-3 py-2 text-xs"
          style={{ borderColor: 'rgba(148,163,184,0.18)', color: 'var(--text-secondary)' }}
        >
          Reset filters
        </button>
      </div>
    </div>
  )
}
