'use client'

import { useState, useCallback } from 'react'
import { Search, AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react'

type Entity = { id: string; entity_name: string; entity_type: string; list_source: string; country: string; program: string }
type Match = { id: string; sanctions_entity_id: string; matched_entity_type: string; matched_entity_id: string; match_confidence: number; match_reason: string; detected_at: string; reviewed: boolean; is_confirmed: boolean; sanctions_entity?: { entity_name: string; entity_type: string; list_source: string; program: string; country: string } }
type Stats = { total_entities: number; total_matches: number; confirmed: number }
type ApiData = { entities?: Entity[]; matches?: Match[]; stats?: Stats; mode?: string }

const sourceColor: Record<string, string> = {
  OFAC_SDN: 'bg-red-400/20 text-red-300',
  EU: 'bg-blue-400/20 text-blue-300',
  UN: 'bg-cyan-400/20 text-cyan-300',
  UK_OFSI: 'bg-purple-400/20 text-purple-300',
}

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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Shield className="w-6 h-6 text-red-400" /> Sanctions &amp; Watchlist Monitor</h1>
        <p className="text-white/80 text-sm mt-1">Cross-reference entities against OFAC SDN, EU, UN, and UK OFSI sanctions lists</p>
      </div>

      {/* Stats */}
      {data.stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Sanctioned Entities', value: data.stats.total_entities, icon: '📋' },
            { label: 'Potential Matches', value: data.stats.total_matches, icon: '🔍' },
            { label: 'Confirmed Matches', value: data.stats.confirmed, icon: '⚠️' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 text-center hover:bg-white/[0.03] transition-colors">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-white/50">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
        <h2 className="font-semibold text-white mb-3">Entity Lookup</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void search(query) }}
              placeholder="Search entity name (e.g., &apos;Rosneft&apos;, &apos;Igor Sechin&apos;)"
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-red-400"
            />
          </div>
          <button
            onClick={() => void search(query)}
            disabled={loading}
            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check'}
          </button>
          <button
            onClick={() => { setQuery(''); void search('') }}
            className="px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm text-white/60 border border-white/[0.08] transition-colors"
          >
            View All Matches
          </button>
        </div>
      </div>

      {/* Search results */}
      {data.entities && data.entities.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Sanctions Entities Found ({data.entities.length})</h2>
          <div className="space-y-2">
            {data.entities.map(e => (
              <div key={e.id} className="bg-white/[0.015] border border-red-400/20 rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-white">{e.entity_name}</div>
                  <div className="text-xs text-white/50">{e.entity_type} · {e.country} · Program: {e.program}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${sourceColor[e.list_source] ?? 'bg-white/[0.1] text-white/80'}`}>{e.list_source}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasSearched && data.entities && data.entities.length === 0 && data.mode === 'search' && (
        <div className="flex items-center gap-2 text-green-400 p-4 bg-green-500/10 rounded-xl border border-green-400/20">
          <CheckCircle className="w-5 h-5" /> No matches found for &ldquo;{query}&rdquo; in any sanctions list.
        </div>
      )}

      {/* Matches from our data */}
      {data.matches && data.matches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Detected Matches in ConflictRadar Data</h2>
          <div className="space-y-3">
            {data.matches.map(m => (
              <div key={m.id} className={`bg-white/[0.015] border rounded-xl p-4 hover:bg-white/[0.03] transition-colors ${m.is_confirmed ? 'border-red-400/20' : 'border-white/[0.05]'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sourceColor[m.sanctions_entity?.list_source ?? ''] ?? 'bg-white/[0.1] text-white/80'}`}>
                        {m.sanctions_entity?.list_source}
                      </span>
                      <span className="font-semibold text-sm text-white">{m.sanctions_entity?.entity_name}</span>
                      {m.is_confirmed && <AlertTriangle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="text-xs text-white/50">
                      Matched against: {m.matched_entity_type} · Reason: {m.match_reason} · Confidence: {confPct(m.match_confidence)}%
                    </div>
                    {m.sanctions_entity?.program && (
                      <div className="text-xs text-orange-400 mt-1">Program: {m.sanctions_entity.program}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-xs text-white/30 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{new Date(m.detected_at).toLocaleDateString()}
                    </div>
                    {!m.reviewed && (
                      <div className="flex gap-1">
                        <button onClick={() => void handleConfirm(m.id, true)} className="text-xs px-2 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/40 rounded transition-colors">Confirm</button>
                        <button onClick={() => void handleConfirm(m.id, false)} className="text-xs px-2 py-1 bg-white/[0.1] text-white/60 hover:bg-white/[0.15] rounded transition-colors">Dismiss</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasSearched && !loading && (
        <div className="text-center py-12 text-white/50">
          <Shield className="w-12 h-12 mx-auto mb-3 text-white/20" />
          <p className="text-sm">Search for an entity name to check against all sanctions lists,<br />or click &ldquo;View All Matches&rdquo; to see flagged entities in ConflictRadar data.</p>
          <p className="text-xs mt-3 text-white/30">Data updated daily from OFAC SDN, EU Consolidated List, UN Security Council, and UK OFSI</p>
        </div>
      )}
    </div>
  )
}
