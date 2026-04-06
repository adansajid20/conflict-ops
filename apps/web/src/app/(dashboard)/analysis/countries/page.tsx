'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Shield, AlertTriangle, TrendingUp, MapPin } from 'lucide-react'

type Country = {
  id: string; country_code: string; country_name: string; risk_score: number
  political_stability: number; internal_security: number; external_threats: number
  economic_risk: number; infrastructure_risk: number; civil_liberties: number
  conflict_intensity: string; active_predictions: number; active_correlations: number
  event_count_7d: number; travel_advisory: string; ai_summary: string; last_updated: string
}

type ApiData = { countries?: Country[] }

const advisoryColor: Record<string, string> = {
  safe: 'bg-green-400/20 text-green-300 border-green-400/30',
  caution: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  reconsider: 'bg-orange-400/20 text-orange-300 border-orange-400/30',
  do_not_travel: 'bg-red-400/20 text-red-300 border-red-400/30',
}

const riskColor = (score: number) => {
  if (score >= 8) return 'text-red-400'
  if (score >= 6) return 'text-orange-400'
  if (score >= 4) return 'text-yellow-400'
  return 'text-green-400'
}

const RiskBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${value >= 7 ? 'bg-red-400' : value >= 5 ? 'bg-orange-400' : value >= 3 ? 'bg-yellow-400' : 'bg-green-400'}`}
        style={{ width: `${Math.min(value * 10, 100)}%` }}
      />
    </div>
    <span className="text-xs w-6 text-right text-gray-400">{value?.toFixed(1)}</span>
  </div>
)

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Country | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      const res = await fetch(`/api/v1/countries?${params}`)
      const d = await res.json() as ApiData
      setCountries(d.countries ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSearch = (q: string) => {
    setSearch(q)
    void load(q)
  }

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-96 border-r border-white/[0.05] flex flex-col bg-white/[0.015]">
        <div className="p-4 border-b border-white/[0.05]">
          <h1 className="text-lg font-bold mb-3 flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-400" /> Country Risk Profiles</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search countries..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder:text-white/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-4 text-center text-white/50 text-sm">Loading profiles...</div>}
          {!loading && countries.length === 0 && (
            <div className="p-4 text-center text-white/50 text-sm">
              No country profiles yet. Run the update-country-profiles cron to generate them.
            </div>
          )}
          {countries.map(c => (
            <button
              key={c.country_code}
              onClick={() => setSelected(c)}
              className={`w-full text-left p-4 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors ${selected?.country_code === c.country_code ? 'bg-white/[0.05] border-l-2 border-l-blue-500' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-white">{c.country_name}</span>
                <span className={`text-lg font-bold ${riskColor(c.risk_score)}`}>{c.risk_score?.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${advisoryColor[c.travel_advisory] ?? ''}`}>
                  {c.travel_advisory?.replace('_', ' ')}
                </span>
                <span className="text-xs text-white/50">{c.event_count_7d} events / 7d</span>
                {c.active_predictions > 0 && (
                  <span className="text-xs text-yellow-400">{c.active_predictions} pred</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-white/50">
            <Shield className="w-12 h-12 mb-3 text-white/20" />
            <p>Select a country to view its full risk profile</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white">{selected.country_name}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-4xl font-bold ${riskColor(selected.risk_score)}`}>{selected.risk_score?.toFixed(1)}</span>
                  <span className="text-white/50">/10 Risk Score</span>
                  <span className={`px-3 py-1 rounded-full border text-sm ${advisoryColor[selected.travel_advisory] ?? ''}`}>
                    {selected.travel_advisory?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-white/50">
                <div className="flex items-center gap-1 text-xs">Conflict: <span className="capitalize font-medium text-white/80">{selected.conflict_intensity}</span></div>
                <div>{selected.event_count_7d} events (7d)</div>
                <div>{selected.active_predictions} predictions</div>
              </div>
            </div>

            {/* Risk breakdown */}
            <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-white"><TrendingUp className="w-4 h-4 text-orange-400" /> Risk Breakdown</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Political Stability', key: 'political_stability', invert: true },
                  { label: 'Internal Security', key: 'internal_security', invert: true },
                  { label: 'External Threats', key: 'external_threats', invert: true },
                  { label: 'Economic Risk', key: 'economic_risk', invert: false },
                  { label: 'Infrastructure Risk', key: 'infrastructure_risk', invert: false },
                  { label: 'Civil Liberties', key: 'civil_liberties', invert: true },
                ].map(r => (
                  <div key={r.key}>
                    <div className="flex justify-between text-xs text-white/50 mb-1">
                      <span>{r.label}</span>
                    </div>
                    <RiskBar value={r.invert ? 10 - (selected[r.key as keyof Country] as number ?? 5) : (selected[r.key as keyof Country] as number ?? 5)} />
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summary */}
            {selected.ai_summary && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-white">
                  <AlertTriangle className="w-4 h-4 text-blue-400" /> Intelligence Assessment
                </h3>
                <p className="text-sm text-white/80 leading-relaxed">{selected.ai_summary}</p>
                <p className="text-xs text-white/30 mt-3">Updated: {new Date(selected.last_updated).toLocaleString()}</p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Events (7d)', value: selected.event_count_7d },
                { label: 'Active Predictions', value: selected.active_predictions },
                { label: 'Correlations', value: selected.active_correlations },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 text-center hover:bg-white/[0.03]">
                  <div className="text-2xl font-bold text-blue-400">{s.value}</div>
                  <div className="text-xs text-white/50 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
