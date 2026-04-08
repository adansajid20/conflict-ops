'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Shield, AlertTriangle, TrendingUp, MapPin, Zap } from 'lucide-react'

type Country = {
  id: string; country_code: string; country_name: string; risk_score: number
  political_stability: number; internal_security: number; external_threats: number
  economic_risk: number; infrastructure_risk: number; civil_liberties: number
  conflict_intensity: string; active_predictions: number; active_correlations: number
  event_count_7d: number; travel_advisory: string; ai_summary: string; last_updated: string
}

type ApiData = { countries?: Country[] }

const advisoryColors: Record<string, { bg: string; border: string; text: string }> = {
  safe: { bg: '#22c55e', border: '#22c55e', text: '#86efac' },
  caution: { bg: '#eab308', border: '#eab308', text: '#fde047' },
  reconsider: { bg: '#f97316', border: '#f97316', text: '#fed7aa' },
  do_not_travel: { bg: '#ef4444', border: '#ef4444', text: '#fca5a5' },
}

const riskColor = (score: number) => {
  if (score >= 8) return { color: '#ef4444', label: 'Critical' }
  if (score >= 6) return { color: '#f97316', label: 'High' }
  if (score >= 4) return { color: '#eab308', label: 'Medium' }
  return { color: '#22c55e', label: 'Low' }
}

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }

const RiskBar = ({ value, label }: { value: number; label?: string }) => {
  const color = value >= 7 ? '#ef4444' : value >= 5 ? '#f97316' : value >= 3 ? '#eab308' : '#22c55e'
  return (
    <div className="space-y-1">
      {label && <div className="text-xs text-white/50">{label}</div>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            whileInView={{ width: `${Math.min(value * 10, 100)}%` }}
            transition={{ duration: 1, delay: 0.1, type: 'spring' as const, ...SPRING_SNAPPY }}
          />
        </div>
        <span className="text-xs w-8 text-right font-mono text-white/50">{value?.toFixed(1)}</span>
      </div>
    </div>
  )
}

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
    <div className="min-h-screen bg-[#070B11] flex">
      {/* List sidebar */}
      <motion.div
        className="w-96 border-r flex flex-col"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-3 text-white">
            <MapPin className="w-6 h-6 text-blue-400" />
            Risk Profiles
          </h1>
          <motion.div
            className="relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search countries…"
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 text-white placeholder:text-white/30 transition-colors"
            />
          </motion.div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <motion.div className="p-6 text-center text-white/40 text-sm">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Loading profiles…
              </motion.div>
            </motion.div>
          )}
          {!loading && countries.length === 0 && (
            <motion.div
              className="p-6 text-center text-white/40 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              No country profiles available.
            </motion.div>
          )}
          <motion.div
            className="space-y-2 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
          >
            <AnimatePresence>
              {countries.map((c, i) => {
                const riskData = riskColor(c.risk_score)
                const advisoryData = advisoryColors[c.travel_advisory] ?? advisoryColors['safe'] ?? { bg: '#22c55e', border: '#22c55e', text: '#22c55e' }
                const isSelected = selected?.country_code === c.country_code

                return (
                  <motion.button
                    key={c.country_code}
                    onClick={() => setSelected(c)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    whileHover={{ x: 4 }}
                    className="w-full text-left p-4 rounded-lg transition-all border"
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%)'
                        : 'rgba(255,255,255,0.01)',
                      borderColor: isSelected ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-semibold text-sm text-white">{c.country_name}</span>
                      <motion.span
                        className="text-xl font-bold font-mono"
                        style={{ color: riskData.color }}
                        animate={{ scale: isSelected ? 1.1 : 1 }}
                      >
                        {c.risk_score?.toFixed(1)}
                      </motion.span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <motion.span
                        className="text-[10px] px-2 py-1 rounded-full font-semibold uppercase tracking-wider"
                        style={{
                          background: advisoryData.bg + '15',
                          borderColor: advisoryData.border,
                          color: advisoryData.text,
                          border: `1px solid ${advisoryData.border}30`,
                        }}
                      >
                        {c.travel_advisory?.replace('_', ' ')}
                      </motion.span>
                      <span className="text-xs text-white/40">{c.event_count_7d} events</span>
                      {c.active_predictions > 0 && (
                        <span className="text-xs text-yellow-400 font-semibold">{c.active_predictions} pred</span>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </motion.div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {!selected ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center flex-col gap-4"
            >
              <Shield className="w-16 h-16 text-white/10" />
              <p className="text-white/40 text-sm">Select a country to view details</p>
            </motion.div>
          ) : (
            <motion.div
              key={selected.country_code}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-10 max-w-4xl space-y-8"
            >
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-bold text-white mb-4">{selected.country_name}</h2>
                    <div className="flex items-center gap-4">
                      <motion.div
                        className="text-5xl font-bold font-mono"
                        style={{ color: riskColor(selected.risk_score).color }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
                      >
                        {selected.risk_score?.toFixed(1)}
                      </motion.div>
                      <div className="text-white/50">/10 Risk Score</div>
                    </div>
                  </div>
                  <motion.div
                    className="text-right space-y-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <Zap className="w-4 h-4" />
                      Conflict: <span className="text-white font-semibold capitalize">{selected.conflict_intensity}</span>
                    </div>
                    <div className="text-sm text-white/60">{selected.event_count_7d} events (7d)</div>
                    <div className="text-sm text-white/60">{selected.active_predictions} predictions active</div>
                  </motion.div>
                </div>

                {/* Advisory badge */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  {Object.entries(advisoryColors).find(([k]) => k === selected.travel_advisory) && (
                    <div
                      className="inline-block text-sm font-bold uppercase px-4 py-2 rounded-lg border tracking-wider"
                      style={{
                        background: (advisoryColors[selected.travel_advisory]?.bg ?? '#22c55e') + '15',
                        borderColor: advisoryColors[selected.travel_advisory]?.border ?? '#22c55e',
                        color: advisoryColors[selected.travel_advisory]?.text ?? '#22c55e',
                      }}
                    >
                      {selected.travel_advisory?.replace(/_/g, ' ')}
                    </div>
                  )}
                </motion.div>
              </motion.div>

              {/* Risk breakdown */}
              <motion.div
                className="rounded-2xl border overflow-hidden p-8"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <h3 className="font-bold text-lg mb-6 flex items-center gap-3 text-white">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  Risk Breakdown
                </h3>
                <div className="grid grid-cols-2 gap-8">
                  {[
                    { label: 'Political Stability', key: 'political_stability', invert: true },
                    { label: 'Internal Security', key: 'internal_security', invert: true },
                    { label: 'External Threats', key: 'external_threats', invert: false },
                    { label: 'Economic Risk', key: 'economic_risk', invert: false },
                    { label: 'Infrastructure', key: 'infrastructure_risk', invert: false },
                    { label: 'Civil Liberties', key: 'civil_liberties', invert: true },
                  ].map((r, i) => (
                    <motion.div
                      key={r.key}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                    >
                      <RiskBar
                        value={r.invert ? 10 - (selected[r.key as keyof Country] as number ?? 5) : (selected[r.key as keyof Country] as number ?? 5)}
                        label={r.label}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* AI Summary */}
              {selected.ai_summary && (
                <motion.div
                  className="rounded-2xl border overflow-hidden p-8"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
                    borderColor: 'rgba(59,130,246,0.2)',
                  }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-3 text-white">
                    <AlertTriangle className="w-5 h-5 text-blue-400" />
                    Intelligence Assessment
                  </h3>
                  <p className="text-sm text-white/80 leading-relaxed mb-3">{selected.ai_summary}</p>
                  <p className="text-xs text-white/40">Updated {new Date(selected.last_updated).toLocaleDateString()}</p>
                </motion.div>
              )}

              {/* Stats grid */}
              <motion.div
                className="grid grid-cols-3 gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, staggerChildren: 0.1 }}
              >
                {[
                  { label: 'Events (7d)', value: selected.event_count_7d, icon: '📊' },
                  { label: 'Active Predictions', value: selected.active_predictions, icon: '🔮' },
                  { label: 'Correlations', value: selected.active_correlations, icon: '🔗' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.08, type: 'spring' as const, ...SPRING_SNAPPY }}
                    className="rounded-xl border overflow-hidden p-6 text-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
                      borderColor: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    <div className="text-3xl font-bold text-blue-400 mb-2">{s.value}</div>
                    <div className="text-xs text-white/50 uppercase tracking-wide">{s.label}</div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
