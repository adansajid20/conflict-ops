'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Globe, Gauge, TrendingDown, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react'
import { getCountryName, getCountryFlag } from '@/lib/countries'

type CountryRisk = {
  country_code: string
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  resilience_score: number
  nodes_at_risk: number
  event_count: number
  top_threats: string[]
  impact_summary: string
  recommended_actions: string[]
}

type ImpactData = {
  global_resilience_score?: number
  nodes_at_risk?: number
  global_risk_summary?: string
  countries?: CountryRisk[]
}

const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }
const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }

const getRiskColor = (level: string): { color: string; bgColor: string; borderColor: string } => {
  switch (level) {
    case 'critical':
      return { color: '#ef4444', bgColor: 'from-red-500/10', borderColor: 'border-red-400/30' }
    case 'high':
      return { color: '#f97316', bgColor: 'from-orange-500/10', borderColor: 'border-orange-400/30' }
    case 'medium':
      return { color: '#eab308', bgColor: 'from-yellow-500/10', borderColor: 'border-yellow-400/30' }
    default:
      return { color: '#22c55e', bgColor: 'from-green-500/10', borderColor: 'border-green-400/30' }
  }
}

function ResilienceGauge({ score }: { score: number }) {
  const normalizedScore = Math.min(100, Math.max(0, score))
  const getGaugeColor = (s: number): string => {
    if (s >= 70) return 'text-green-400'
    if (s >= 50) return 'text-yellow-400'
    if (s >= 30) return 'text-orange-400'
    return 'text-red-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_SMOOTH}
      className="flex flex-col items-center gap-3"
    >
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Outer ring */}
        <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={`${(normalizedScore / 100) * 282.7} 282.7`}
            className={`transition-colors ${getGaugeColor(normalizedScore)}`}
            initial={{ strokeDasharray: '0 282.7' }}
            animate={{ strokeDasharray: `${(normalizedScore / 100) * 282.7} 282.7` }}
            transition={{ duration: 1, ...SPRING_SMOOTH }}
          />
        </svg>

        {/* Center value */}
        <div className="text-center z-10">
          <motion.div
            className={`text-3xl font-bold ${getGaugeColor(normalizedScore)}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {normalizedScore}
          </motion.div>
          <div className="text-xs text-white/50 mt-1">/ 100</div>
        </div>
      </div>
      <p className="text-xs text-white/60 text-center font-medium">Supply Chain Resilience</p>
    </motion.div>
  )
}

export function GeopoliticalImpactAssessment() {
  const [data, setData] = useState<ImpactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/v1/supply-chain/impact', { cache: 'no-store' })
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const json = await res.json()
      const data = (json.data || json) as ImpactData
      setData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch impact assessment')
      console.error('Impact assessment fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 60000) // Refresh every 60s
    return () => clearInterval(interval)
  }, [fetchData])

  const sortedCountries = useMemo(() => {
    return (data?.countries ?? []).sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return riskOrder[a.risk_level] - riskOrder[b.risk_level]
    })
  }, [data?.countries])

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center py-12 text-white/50"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full mr-2"
        />
        <span className="text-sm">Analyzing supply chain impact...</span>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
        className="bg-red-500/10 border border-red-400/20 rounded-xl p-5 text-red-300 text-sm flex items-start gap-3"
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Failed to load impact assessment</div>
          <div className="text-xs mt-1 text-red-300/70">{error}</div>
        </div>
      </motion.div>
    )
  }

  const score = data?.global_resilience_score ?? 0
  const nodesAtRisk = data?.nodes_at_risk ?? 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={SPRING_SMOOTH}
      className="space-y-6"
    >
      {/* Key metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resilience Score Gauge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, ...SPRING_SNAPPY }}
          className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-8 flex justify-center"
        >
          <ResilienceGauge score={score} />
        </motion.div>

        {/* Quick stats */}
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, ...SPRING_SMOOTH }}
            className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-400/20 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-white/60 mb-1">Nodes at Risk</div>
                <div className="text-2xl font-bold text-white">{nodesAtRisk}</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, ...SPRING_SMOOTH }}
            className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-400/20 rounded-xl p-4"
          >
            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-white/60 mb-1">Countries Affected</div>
                <div className="text-2xl font-bold text-white">{sortedCountries.length}</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Global summary */}
        {data?.global_risk_summary && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, ...SPRING_SMOOTH }}
            className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-4 flex flex-col"
          >
            <h3 className="text-sm font-semibold text-white mb-2">Global Risk Assessment</h3>
            <p className="text-xs text-white/60 flex-1">{data.global_risk_summary}</p>
          </motion.div>
        )}
      </div>

      {/* Country risk details */}
      {sortedCountries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ...SPRING_SMOOTH }}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider text-white/70">
            Critical Alerts by Country ({sortedCountries.length})
          </h3>

          {sortedCountries.map((country, idx) => {
            const colors = getRiskColor(country.risk_level)
            const isExpanded = expandedCountry === country.country_code
            const flag = getCountryFlag(country.country_code)
            const countryName = getCountryName(country.country_code)

            return (
              <motion.div
                key={country.country_code}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.31 + idx * 0.03, ...SPRING_SMOOTH }}
                className={`bg-gradient-to-br ${colors.bgColor} to-transparent border ${colors.borderColor} rounded-xl overflow-hidden hover:border-white/[0.1] transition-all`}
              >
                <button
                  onClick={() => setExpandedCountry(isExpanded ? null : country.country_code)}
                  className="w-full p-4 text-left flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-lg">{flag}</span>
                      <span className="font-semibold text-white">{countryName}</span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium capitalize" style={{ color: colors.color, backgroundColor: colors.color + '20' }}>
                        {country.risk_level}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-white/60 mb-2">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {country.nodes_at_risk} node{country.nodes_at_risk !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        {country.event_count} event{country.event_count !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" />
                        Score: {country.resilience_score}
                      </span>
                    </div>

                    {country.impact_summary && (
                      <p className="text-xs text-white/50">{country.impact_summary}</p>
                    )}

                    {/* Top threats preview */}
                    {country.top_threats && country.top_threats.length > 0 && !isExpanded && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {country.top_threats.slice(0, 2).map((threat, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/[0.08] text-white/70">
                            {threat}
                          </span>
                        ))}
                        {country.top_threats.length > 2 && (
                          <span className="text-xs px-2 py-0.5 text-white/50">+{country.top_threats.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-white/40 flex-shrink-0 mt-0.5"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={SPRING_SMOOTH}
                      className="border-t border-white/[0.05] bg-white/[0.02] p-4 space-y-4"
                    >
                      {/* Top threats */}
                      {country.top_threats && country.top_threats.length > 0 && (
                        <div>
                          <h4 className="text-xs text-white/70 font-semibold mb-2">Top Threats</h4>
                          <div className="space-y-1">
                            {country.top_threats.map((threat, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <AlertCircle className="w-3 h-3 text-orange-400 flex-shrink-0 mt-0.5" />
                                <span className="text-white/60">{threat}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended actions */}
                      {country.recommended_actions && country.recommended_actions.length > 0 && (
                        <div className="pt-2 border-t border-white/[0.05]">
                          <h4 className="text-xs text-white/70 font-semibold mb-2">Recommended Actions</h4>
                          <div className="space-y-2">
                            {country.recommended_actions.map((action, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                                <span className="text-white/60">{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary */}
                      {country.impact_summary && (
                        <div className="pt-2 border-t border-white/[0.05]">
                          <h4 className="text-xs text-white/70 font-semibold mb-2">Impact Summary</h4>
                          <p className="text-xs text-white/60">{country.impact_summary}</p>
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/[0.05] text-xs text-white/50">
                        <span className="font-medium">Risk Metrics:</span> Resilience Score {country.resilience_score}/100 · {country.nodes_at_risk} affected node{country.nodes_at_risk !== 1 ? 's' : ''} · {country.event_count} related event{country.event_count !== 1 ? 's' : ''}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Empty state */}
      {sortedCountries.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={SPRING_SMOOTH}
          className="text-center py-12 text-white/50"
        >
          <TrendingDown className="w-12 h-12 mx-auto mb-3 text-white/20" />
          <p className="text-sm">No geopolitical impact detected</p>
          <p className="text-xs mt-1 text-white/30">Your supply chain appears resilient at this time</p>
        </motion.div>
      )}
    </motion.div>
  )
}
