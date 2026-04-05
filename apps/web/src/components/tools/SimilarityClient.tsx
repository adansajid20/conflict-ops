'use client'

import { useState } from 'react'

type SimilarEvent = { id: string; title: string; region: string | null; severity: number; occurred_at: string | null; similarity: number; summary: string | null }
type SimilarPattern = { id: string; name: string; description: string | null; pattern_type: string | null; historical_date: string | null; similarity: number }

const S = { background: '#080c12', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', muted: '#64748b', accent: '#3b82f6' }
const SEV_COLORS: Record<number, string> = { 4: '#ef4444', 3: '#f97316', 2: '#eab308', 1: '#22c55e' }

export function SimilarityClient() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<SimilarEvent[]>([])
  const [patterns, setPatterns] = useState<SimilarPattern[]>([])
  const [searched, setSearched] = useState(false)
  const [mode, setMode] = useState<'events' | 'patterns'>('events')

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(false)
    try {
      const res = await fetch('/api/v1/similarity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, mode, limit: 10, threshold: 0.3 }),
      })
      const data = await res.json() as { events?: SimilarEvent[]; patterns?: SimilarPattern[]; error?: string }
      setEvents(data.events ?? [])
      setPatterns(data.patterns ?? [])
      setSearched(true)
    } catch { /* ok */ }
    setLoading(false)
  }

  const results = mode === 'events' ? events : patterns

  return (
    <div style={{ minHeight: '100vh', background: S.background, padding: '28px', fontFamily: '-apple-system,sans-serif' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: 0 }}>Similarity Search</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 4 }}>Vector semantic search across events and historical patterns</div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['events', 'patterns'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ padding: '6px 18px', borderRadius: 20, border: `1px solid ${mode === m ? S.accent : S.border}`, background: mode === m ? 'rgba(59,130,246,0.15)' : 'transparent', color: mode === m ? S.accent : S.muted, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
            {m}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, maxWidth: 700 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void search()}
          placeholder={mode === 'events' ? 'e.g. military buildup near border crossing' : 'e.g. pre-war mobilisation pattern'}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: S.text, fontSize: 14 }}
        />
        <button
          onClick={() => void search()}
          disabled={loading || !query.trim()}
          style={{ padding: '10px 24px', borderRadius: 10, background: S.accent, color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Suggested queries */}
      {!searched && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Try these</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(mode === 'events'
              ? ['military convoy spotted near border', 'civilian casualty airstrike', 'ceasefire agreement signed', 'missile launch warning', 'port blockade commercial shipping']
              : ['internet shutdown before crackdown', 'hybrid warfare state actor', 'escalation ladder nuclear rhetoric', 'Wagner-type PMC deployment', 'diplomatic breakthrough ceasefire']
            ).map(s => (
              <button key={s} onClick={() => setQuery(s)} style={{ padding: '5px 12px', borderRadius: 16, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, fontSize: 12, cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: S.muted, fontSize: 14 }}>
          No matches found. This requires embeddings to be generated — run the pipeline or add an OpenAI API key.
        </div>
      )}

      {mode === 'events' && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.map(e => {
            const simPct = Math.round(e.similarity * 100)
            return (
              <div key={e.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_COLORS[e.severity] ?? '#64748b', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.text, flex: 1 }}>{e.title}</span>
                  <span style={{ fontSize: 12, color: simPct >= 80 ? '#22c55e' : simPct >= 60 ? '#eab308' : S.muted, fontWeight: 600, flexShrink: 0 }}>
                    {simPct}% match
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: S.muted }}>
                  <span>{e.region?.replace(/_/g, ' ') ?? 'Unknown region'}</span>
                  <span>·</span>
                  <span>{e.occurred_at?.slice(0, 10) ?? '—'}</span>
                </div>
                {e.summary && <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{e.summary.slice(0, 200)}</div>}
              </div>
            )
          })}
        </div>
      )}

      {mode === 'patterns' && patterns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {patterns.map(p => {
            const simPct = Math.round(p.similarity * 100)
            return (
              <div key={p.id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 3 }}>{p.name}</div>
                    {p.pattern_type && <span style={{ fontSize: 10, color: S.accent, background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>{p.pattern_type.replace(/_/g, ' ')}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: simPct >= 80 ? '#22c55e' : simPct >= 60 ? '#eab308' : S.muted, fontWeight: 600, flexShrink: 0 }}>
                    {simPct}% match
                  </span>
                </div>
                {p.historical_date && <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>Historical: {p.historical_date}</div>}
                {p.description && <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{p.description.slice(0, 300)}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
