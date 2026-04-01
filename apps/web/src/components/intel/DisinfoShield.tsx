'use client'

import { useEffect, useState } from 'react'

type Narrative = {
  id: string
  title: string
  description?: string | null
  velocity_score?: number | null
  is_disinfo?: boolean | null
  disinfo_indicators?: string[] | null
}

function velocityColor(score?: number | null) {
  const value = Number(score ?? 0)
  if (value >= 0.75) return '#EF4444'
  if (value >= 0.4) return '#F59E0B'
  return '#22C55E'
}

export function DisinfoShield() {
  const [items, setItems] = useState<Narrative[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/v1/disinfo', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data?: Narrative[] }>)
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Counter-Disinfo Shield</div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Narrative velocity, flags, and analyst indicators.</div>
      </div>
      <div className="p-4 space-y-3">
        {loading ? <div style={{ color: 'var(--text-muted)' }}>Loading narratives…</div> : null}
        {!loading && items.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No tracked narratives yet.</div> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{item.description ?? 'No narrative brief available.'}</div>
              </div>
              <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase" style={{ background: item.is_disinfo ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: item.is_disinfo ? '#EF4444' : '#22C55E' }}>
                {item.is_disinfo ? 'Flagged' : 'Clean'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="text-xs" style={{ color: velocityColor(item.velocity_score) }}>Velocity: {Number(item.velocity_score ?? 0).toFixed(2)}</span>
              {(item.disinfo_indicators ?? []).slice(0, 4).map((indicator) => (
                <span key={indicator} className="rounded-full px-2 py-1 text-[10px]" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                  {indicator}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
