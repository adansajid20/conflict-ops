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
  market_url: string
}

type MarketsData = {
  metaculus: MetaculusQ[]
  polymarket: PolyEvent[]
  fetched_at: string
}

function ProbBar({ prob }: { prob: number }) {
  const pct = Math.round(prob * 100)
  const color = pct >= 70 ? '#EF4444' : pct >= 40 ? '#F59E0B' : '#10B981'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded" style={{ backgroundColor: 'var(--border)' }}>
        <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs mono font-bold" style={{ color }}>{pct}%</span>
    </div>
  )
}

export function MarketsPanel() {
  const [data, setData] = useState<MarketsData | null>(null)
  const [tab, setTab] = useState<'metaculus' | 'polymarket'>('metaculus')
  const [loading, setLoading] = useState(true)

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/markets')
      const json = await res.json() as { data?: MarketsData }
      if (json.data) setData(json.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetch_() }, [fetch_])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <h2 className="text-sm font-bold mono tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>
          PREDICTION MARKETS
        </h2>
        <div className="flex gap-1">
          {(['metaculus', 'polymarket'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-3 py-1 text-xs mono rounded"
              style={{
                backgroundColor: tab === t ? 'var(--primary)' : 'var(--bg-surface)',
                color: tab === t ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>LOADING...</p>
        ) : tab === 'metaculus' ? (
          !data?.metaculus.length ? (
            <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>NO DATA — METACULUS API LIVE</p>
          ) : data.metaculus.map(q => (
            <div key={q.id} className="p-3 rounded border mb-2 text-xs" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <a href={q.page_url} target="_blank" rel="noopener noreferrer"
                className="font-bold hover:underline leading-tight block mb-2"
                style={{ color: 'var(--text-primary)' }}>
                {q.title}
              </a>
              {q.community_prediction != null ? (
                <ProbBar prob={q.community_prediction} />
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>No community prediction yet</span>
              )}
              <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                Closes {new Date(q.close_time).toLocaleDateString()} · Metaculus
              </div>
            </div>
          ))
        ) : (
          !data?.polymarket.length ? (
            <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>NO GEOPOLITICAL MARKETS FOUND</p>
          ) : data.polymarket.map(e => (
            <div key={e.id} className="p-3 rounded border mb-2 text-xs" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <a href={e.market_url} target="_blank" rel="noopener noreferrer"
                className="font-bold hover:underline leading-tight block mb-2"
                style={{ color: 'var(--text-primary)' }}>
                {e.title}
              </a>
              {e.outcomes.slice(0, 2).map((o, i) => (
                <div key={i} className="mb-1">
                  <div className="flex justify-between mb-1">
                    <span style={{ color: 'var(--text-muted)' }}>{o.title || `Outcome ${i + 1}`}</span>
                  </div>
                  <ProbBar prob={o.price} />
                </div>
              ))}
              <div className="mt-1" style={{ color: 'var(--text-muted)' }}>
                Vol 24h: ${e.volume_24hr.toLocaleString()} · Polymarket
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
