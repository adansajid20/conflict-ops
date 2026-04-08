'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type SimilarEvent = { id: string; title: string; region: string | null; severity: number; occurred_at: string | null; similarity: number; summary: string | null }
type SimilarPattern = { id: string; name: string; description: string | null; pattern_type: string | null; historical_date: string | null; similarity: number }

const S = { background: '#070B11', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', muted: '#64748b', accent: '#3b82f6' }
const SEV_COLORS: Record<number, string> = { 4: '#ef4444', 3: '#f97316', 2: '#eab308', 1: '#22c55e' }

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={SPRING_SMOOTH}
      style={{ minHeight: '100vh', background: S.background, padding: '32px', fontFamily: '-apple-system,sans-serif' }}
    >
      <motion.div style={{ marginBottom: 28 }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SMOOTH}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: S.text, margin: 0 }}>Similarity Search</h1>
        <div style={{ fontSize: 13, color: S.muted, marginTop: 8 }}>Vector semantic search across events and historical patterns</div>
      </motion.div>

      {/* Mode toggle */}
      <motion.div style={{ display: 'flex', gap: 8, marginBottom: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, ...SPRING_SMOOTH }}>
        {(['events', 'patterns'] as const).map((m, idx) => (
          <motion.button
            key={m}
            onClick={() => setMode(m)}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12 + idx * 0.05, ...SPRING_SNAPPY }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              padding: '8px 20px',
              borderRadius: 20,
              border: `2px solid ${mode === m ? S.accent : S.border}`,
              background: mode === m ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: mode === m ? S.accent : S.muted,
              fontSize: 13,
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: mode === m ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
          >
            {m}
          </motion.button>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div
        style={{ display: 'flex', gap: 10, marginBottom: 28, maxWidth: 700 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, ...SPRING_SMOOTH }}
      >
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void search()}
          placeholder={mode === 'events' ? 'e.g. military buildup near border crossing' : 'e.g. pre-war mobilisation pattern'}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 10,
            border: `1px solid ${S.border}`,
            background: S.card,
            color: S.text,
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
        <motion.button
          onClick={() => void search()}
          disabled={loading || !query.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            padding: '12px 28px',
            borderRadius: 10,
            background: S.accent,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {loading ? 'Searching…' : 'Search'}
        </motion.button>
      </motion.div>

      {/* Suggested queries */}
      {!searched && (
        <motion.div style={{ marginBottom: 28 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, ...SPRING_SMOOTH }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Try these</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(mode === 'events'
              ? ['military convoy spotted near border', 'civilian casualty airstrike', 'ceasefire agreement signed', 'missile launch warning', 'port blockade commercial shipping']
              : ['internet shutdown before crackdown', 'hybrid warfare state actor', 'escalation ladder nuclear rhetoric', 'Wagner-type PMC deployment', 'diplomatic breakthrough ceasefire']
            ).map((s, idx) => (
              <motion.button
                key={s}
                onClick={() => setQuery(s)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.21 + idx * 0.05, ...SPRING_SNAPPY }}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 16,
                  border: `1px solid ${S.border}`,
                  background: 'transparent',
                  color: S.muted,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Results */}
      {searched && results.length === 0 && (
        <motion.div
          style={{
            textAlign: 'center',
            padding: '48px 0',
            color: S.muted,
            fontSize: 14,
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SMOOTH}
        >
          No matches found. This requires embeddings to be generated — run the pipeline or add an OpenAI API key.
        </motion.div>
      )}

      {mode === 'events' && events.length > 0 && (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING_SMOOTH}>
          {events.map((e, idx) => {
            const simPct = Math.round(e.similarity * 100)
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + idx * 0.04, ...SPRING_SMOOTH }}
                whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
                style={{
                  background: S.card,
                  border: `1px solid ${S.border}`,
                  borderRadius: 12,
                  padding: '16px 20px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_COLORS[e.severity] ?? '#64748b', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: S.text, flex: 1 }}>{e.title}</span>
                  <span
                    style={{
                      fontSize: 12,
                      color: simPct >= 80 ? '#22c55e' : simPct >= 60 ? '#eab308' : S.muted,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {simPct}% match
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: S.muted }}>
                  <span>{e.region?.replace(/_/g, ' ') ?? 'Unknown region'}</span>
                  <span>·</span>
                  <span>{e.occurred_at?.slice(0, 10) ?? '—'}</span>
                </div>
                {e.summary && <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{e.summary.slice(0, 200)}</div>}
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {mode === 'patterns' && patterns.length > 0 && (
        <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING_SMOOTH}>
          {patterns.map((p, idx) => {
            const simPct = Math.round(p.similarity * 100)
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + idx * 0.04, ...SPRING_SMOOTH }}
                whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
                style={{
                  background: S.card,
                  border: `1px solid ${S.border}`,
                  borderRadius: 12,
                  padding: '16px 20px',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 5 }}>{p.name}</div>
                    {p.pattern_type && (
                      <span
                        style={{
                          fontSize: 10,
                          color: S.accent,
                          background: 'rgba(59,130,246,0.1)',
                          padding: '3px 10px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          display: 'inline-block',
                        }}
                      >
                        {p.pattern_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: simPct >= 80 ? '#22c55e' : simPct >= 60 ? '#eab308' : S.muted,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {simPct}% match
                  </span>
                </div>
                {p.historical_date && <div style={{ fontSize: 11, color: S.muted, marginBottom: 8 }}>Historical: {p.historical_date}</div>}
                {p.description && <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{p.description.slice(0, 300)}</div>}
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </motion.div>
  )
}
