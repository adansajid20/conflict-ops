'use client'

import { useEffect, useState, useCallback } from 'react'

type MetaculusQ = {
  id: number
  title: string
  community_prediction: number | null
  close_time: string
  page_url: string
}

type PolyEvent = {
  id: string
  title: string
  outcomes: Array<{ title: string; price: number }>
  volume_24hr: number
  end_date: string
  market_url: string
}

type MarketsData = {
  metaculus: MetaculusQ[]
  polymarket: PolyEvent[]
  fetched_at: string
}

function ProbBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 70 ? 'var(--alert-red)' : pct >= 40 ? 'var(--alert-amber)' : 'var(--alert-green)'
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 rounded" style={{ backgroundColor: 'var(--border)' }}>
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs mono font-bold w-9 text-right" style={{ color }}>{pct}%</span>
    </div>
  )
}

export function MarketsPanel() {
  const [data, setData] = useState<MarketsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'metaculus' | 'polymarket'>('metaculus')

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/markets')
      const json = await res.json() as { success: boolean; data?: MarketsData }
      if (json.success && json.data) setData(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetch_()
    const t = setInterval(() => void fetch_(), 14_400_000) // 4h
    return () => clearInterval(t)
  }, [fetch_])

  return (
    <div className="rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
          PREDICTION MARKETS
        </h3>
        <div className="flex gap-2">
          {(['metaculus','polymarket'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="text-xs mono px-2 py-0.5 rounded border"
              style={{ borderColor: tab===t?'var(--primary)':'var(--border)', color: tab===t?'var(--primary)':'var(--text-muted)' }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="text-xs mono text-center py-6" style={{ color: 'var(--text-muted)' }}>LOADING MARKETS...</div>
        ) : tab === 'metaculus' ? (
          !data?.metaculus.length ? (
            <div className="text-xs mono text-center py-6" style={{ color: 'var(--text-muted)' }}>NO MARKETS LOADED</div>
          ) : data.metaculus.map(q => (
            <div key={q.id} className="mb-3 pb-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <a href={q.page_url} target="_blank" rel="noopener noreferrer"
                className="text-xs mono leading-snug hover:underline"
                style={{ color: 'var(--text-primary)' }}>
                {q.title}
              </a>
              {q.community_prediction != null && <ProbBar value={q.community_prediction} />}
              <div className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>
                Closes: {new Date(q.close_time).toLocaleDateString()} · via Metaculus
              </div>
            </div>
          ))
        ) : (
          !data?.polymarket.length ? (
            <div className="text-xs mono text-center py-6" style={{ color: 'var(--text-muted)' }}>NO MARKETS LOADED</div>
          ) : data.polymarket.map(e => (
            <div key={e.id} className="mb-3 pb-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <a href={e.market_url} target="_blank" rel="noopener noreferrer"
                className="text-xs mono leading-snug hover:underline"
                style={{ color: 'var(--text-primary)' }}>
                {e.title}
              </a>
              {e.outcomes.slice(0,2).map(o => (
                <div key={o.title} className="mt-1">
                  <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{o.title}</div>
                  <ProbBar value={o.price} />
                </div>
              ))}
              <div className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>
                24h vol: ${e.volume_24hr.toLocaleString(undefined, {maximumFractionDigits:0})} · via Polymarket
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
