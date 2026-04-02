'use client'

export function MapLegend() {
  const items = [
    { label: 'Critical', color: '#ef4444' },
    { label: 'High', color: '#f97316' },
    { label: 'Medium', color: '#eab308' },
    { label: 'Low', color: '#6b7280' },
  ]

  return (
    <div
      className="pointer-events-auto rounded-2xl border px-3 py-2 backdrop-blur-md"
      style={{ background: 'rgba(5, 10, 18, 0.78)', borderColor: 'rgba(148,163,184,0.18)' }}
    >
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: 'var(--text-muted)' }}>
        Severity
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
