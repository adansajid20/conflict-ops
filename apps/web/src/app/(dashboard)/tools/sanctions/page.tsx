'use client'

import { useState, useCallback } from 'react'
import { Search, AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActiveSanctionsIntelligence } from '@/components/sanctions/ActiveSanctionsIntelligence'

type Entity = { id: string; entity_name: string; entity_type: string; list_source: string; country: string; program: string }
type Match = { id: string; sanctions_entity_id: string; matched_entity_type: string; matched_entity_id: string; match_confidence: number; match_reason: string; detected_at: string; reviewed: boolean; is_confirmed: boolean; sanctions_entity?: { entity_name: string; entity_type: string; list_source: string; program: string; country: string } }
type Stats = { total_entities: number; total_matches: number; confirmed: number }
type ApiData = { entities?: Entity[]; matches?: Match[]; stats?: Stats; mode?: string }

const sourceColor: Record<string, string> = {
  OFAC_SDN: 'bg-red-400/20 text-red-300 border-red-400/30',
  EU: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  UN: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30',
  UK_OFSI: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

export default function SanctionsPage() {
  const [query, setQuery] = useState('')
  const [data, setData] = useState<ApiData>({})
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const search = useCallback(async (q: string) => {
    setLoading(true)
    setHasSearched(true)
    try {
      const url = q.length >= 2 ? `/api/v1/sanctions?q=${encodeURIComponent(q)}` : '/api/v1/sanctions'
      const res = await fetch(url)
      const d = await res.json() as ApiData
      setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const handleConfirm = async (matchId: string, confirmed: boolean) => {
    await fetch('/api/v1/sanctions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: matchId, is_confirmed: confirmed, reviewed: true }),
    })
    void search(query)
  }

  const confPct = (n: number) => Math.round(n * 100)

  return (
    <div className="min-h-screen bg-[#070B11] p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SMOOTH}>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Shield className="w-7 h-7 text-red-400" /> Sanctions &amp; Watchlist Monitor</h1>
        <p className="text-white/60 text-sm mt-2">Cross-reference entities against OFAC SDN, EU, UN, and UK OFSI sanctions lists</p>
      </motion.div>

      {/* Stats */}
      {data.stats && (
        <motion.div
          className="grid grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, ...SPRING_SMOOTH }}
        >
          {[
            { label: 'Sanctioned Entities', value: data.stats.total_entities, icon: '📋', color: 'from-red-500/10 to-red-500/5' },
            { label: 'Potential Matches', value: data.stats.total_matches, icon: '🔍', color: 'from-orange-500/10 to-orange-500/5' },
            { label: 'Confirmed Matches', value: data.stats.confirmed, icon: '⚠️', color: 'from-red-500/15 to-red-500/5' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + i * 0.05, ...SPRING_SNAPPY }}
              whileHover={{ y: -2 }}
              className={`bg-gradient-to-br ${stat.color} border border-white/[0.06] rounded-xl p-5 text-center backdrop-blur-sm hover:border-white/[0.1] transition-all`}
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-white/50 mt-2 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, ...SPRING_SMOOTH }}
        className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
      >
        <h2 className="font-semibold text-white mb-4 text-lg">Entity Lookup</h2>
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void search(query) }}
              placeholder="Search entity name (e.g., 'Rosneft', 'Igor Sechin')"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-red-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
            />
          </div>
          <motion.button
            onClick={() => void search(query)}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check'}
          </motion.button>
          <motion.button
            onClick={() => { setQuery(''); void search('') }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] rounded-lg text-sm text-white/60 border border-white/[0.1] transition-all"
          >
            View All
          </motion.button>
        </div>
      </motion.div>

      {/* Search results */}
      {data.entities && data.entities.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, ...SPRING_SMOOTH }}>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Sanctions Entities Found ({data.entities.length})</h2>
          <div className="space-y-3">
            {data.entities.map((e, idx) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.21 + idx * 0.04, ...SPRING_SMOOTH }}
                whileHover={{ x: 4 }}
                className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-red-400/20 rounded-xl p-5 flex items-center gap-4 backdrop-blur-sm hover:border-red-400/40 transition-all"
              >
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-white">{e.entity_name}</div>
                  <div className="text-xs text-white/50">{e.entity_type} · {e.country} · Program: {e.program}</div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium border ${sourceColor[e.list_source] ?? 'bg-white/[0.1] text-white/80'}`}>
                  {e.list_source}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {hasSearched && data.entities && data.entities.length === 0 && data.mode === 'search' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SMOOTH}
          className="flex items-center gap-3 p-4 bg-green-500/10 rounded-xl border border-green-400/20 backdrop-blur-sm"
        >
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
          <div>
            <div className="text-green-400 font-medium text-sm">No matches found</div>
            <div className="text-green-300/60 text-xs">&ldquo;{query}&rdquo; is clean across all sanctions lists.</div>
          </div>
        </motion.div>
      )}

      {/* Matches from our data */}
      {data.matches && data.matches.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, ...SPRING_SMOOTH }}
        >
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Detected Matches in ConflictRadar Data</h2>
          <div className="space-y-3">
            {data.matches.map((m, idx) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.26 + idx * 0.04, ...SPRING_SMOOTH }}
                whileHover={{ x: 4 }}
                className={`bg-gradient-to-br from-white/[0.025] to-white/[0.005] border rounded-xl p-5 backdrop-blur-sm hover:border-white/[0.1] transition-all ${m.is_confirmed ? 'border-red-400/30' : 'border-white/[0.06]'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-medium border ${sourceColor[m.sanctions_entity?.list_source ?? ''] ?? 'bg-white/[0.1] text-white/80'}`}>
                        {m.sanctions_entity?.list_source}
                      </span>
                      <span className="font-semibold text-sm text-white">{m.sanctions_entity?.entity_name}</span>
                      {m.is_confirmed && <AlertTriangle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="text-xs text-white/50">
                      Matched against: {m.matched_entity_type} · Reason: {m.match_reason} · Confidence: {confPct(m.match_confidence)}%
                    </div>
                    {m.sanctions_entity?.program && (
                      <div className="text-xs text-orange-400 mt-2 font-medium">Program: {m.sanctions_entity.program}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs text-white/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(m.detected_at).toLocaleDateString()}
                    </div>
                    {!m.reviewed && (
                      <div className="flex gap-1">
                        <motion.button
                          onClick={() => void handleConfirm(m.id, true)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="text-xs px-3 py-1.5 bg-red-500/20 text-red-300 hover:bg-red-500/40 rounded-lg transition-colors font-medium"
                        >
                          Confirm
                        </motion.button>
                        <motion.button
                          onClick={() => void handleConfirm(m.id, false)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="text-xs px-3 py-1.5 bg-white/[0.1] text-white/60 hover:bg-white/[0.15] rounded-lg transition-colors font-medium"
                        >
                          Dismiss
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {!hasSearched && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, ...SPRING_SMOOTH }}
          className="text-center py-16 text-white/50"
        >
          <Shield className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <p className="text-sm">Search for an entity name to check against all sanctions lists,<br />or click &ldquo;View All&rdquo; to see flagged entities in ConflictRadar data.</p>
          <p className="text-xs mt-4 text-white/30">Data updated daily from OFAC SDN, EU Consolidated List, UN Security Council, and UK OFSI</p>
        </motion.div>
      )}

      {/* Active Sanctions Intelligence Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ...SPRING_SMOOTH }}
        className="pt-6 border-t border-white/[0.06]"
      >
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          Active Sanctions Intelligence
        </h2>
        <p className="text-white/60 text-sm mb-5">Recently active sanctioned entities detected in ConflictRadar event stream</p>
        <ActiveSanctionsIntelligence />
      </motion.div>
    </div>
  )
}
