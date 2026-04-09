'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Globe, TrendingUp, Calendar, ChevronDown, Clock, Zap } from 'lucide-react'
import { getCountryName, getCountryFlag } from '@/lib/countries'

type Anomaly = {
  id: string
  country_code: string
  pattern_type: string
  confidence: number
  metadata: {
    z_score: number
    baseline_mean: number
    current_value: number
    deviation_type: string
  }
  detected_at: string
  region?: string
}

type Stats = {
  total: number
  extreme: number
  countries: number
  latest: string
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

const getSeverityBadge = (zScore: number): { label: string; color: string; bgColor: string } => {
  if (zScore > 4) return { label: 'Extreme', color: '#ef4444', bgColor: 'bg-red-500/20' }
  if (zScore > 3) return { label: 'Significant', color: '#f97316', bgColor: 'bg-orange-500/20' }
  if (zScore > 2) return { label: 'Moderate', color: '#eab308', bgColor: 'bg-yellow-500/20' }
  return { label: 'Minor', color: '#22c55e', bgColor: 'bg-green-500/20' }
}

const getZScoreColor = (zScore: number): string => {
  if (zScore > 4) return 'text-red-400'
  if (zScore > 3) return 'text-orange-400'
  if (zScore > 2) return 'text-yellow-400'
  return 'text-green-400'
}

function PulseIndicator() {
  return (
    <motion.div
      className="flex items-center gap-2"
      animate={{ opacity: [1, 0.5, 1] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="w-2 h-2 rounded-full bg-cyan-400" />
      <span className="text-xs text-cyan-400 font-medium">LIVE</span>
    </motion.div>
  )
}

function AnomalyCard({ anomaly, idx }: { anomaly: Anomaly; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const severity = getSeverityBadge(anomaly.metadata.z_score)
  const countryName = getCountryName(anomaly.country_code)
  const flag = getCountryFlag(anomaly.country_code)
  const relativeTime = getRelativeTime(anomaly.detected_at)
  const zScoreColor = getZScoreColor(anomaly.metadata.z_score)

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.03, ...SPRING_SMOOTH }}
      whileHover={{ x: 4 }}
      className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl backdrop-blur-sm hover:border-white/[0.1] transition-all overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-5 flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
      >
        {/* Left: Country & type */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl">{flag}</span>
            <div>
              <div className="font-semibold text-white">{countryName}</div>
              {anomaly.region && <div className="text-xs text-white/50">{anomaly.region}</div>}
            </div>
          </div>

          {/* Severity badge */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={`text-xs px-3 py-1 rounded-full font-medium border ${severity.bgColor} text-white`} style={{ color: severity.color }}>
              {severity.label}
            </span>
            <span className="text-xs text-white/50">{anomaly.pattern_type}</span>
          </div>

          {/* Z-Score prominently */}
          <div className="mb-3">
            <div className={`text-sm font-mono font-bold ${zScoreColor}`}>
              Z-Score: {anomaly.metadata.z_score.toFixed(2)}
            </div>
          </div>

          {/* Baseline vs Current */}
          <div className="text-xs text-white/60 space-y-1">
            <div>Baseline: {anomaly.metadata.baseline_mean.toFixed(2)} {anomaly.metadata.deviation_type}</div>
            <div>Current: {anomaly.metadata.current_value.toFixed(2)} {anomaly.metadata.deviation_type}</div>
          </div>
        </div>

        {/* Right: Confidence & timestamp */}
        <div className="flex flex-col items-end gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs text-white/50">Confidence</div>
            <div className="text-sm font-bold text-cyan-400">{Math.round(anomaly.confidence * 100)}%</div>
          </div>
          <div className="text-xs text-white/40 flex items-center gap-1 whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {relativeTime}
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/40"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING_SMOOTH}
            className="border-t border-white/[0.05] bg-white/[0.02] p-5 space-y-3"
          >
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-white/50">Pattern Type</span>
                <div className="text-white font-mono mt-1">{anomaly.pattern_type}</div>
              </div>
              <div>
                <span className="text-white/50">Deviation Type</span>
                <div className="text-white font-mono mt-1">{anomaly.metadata.deviation_type}</div>
              </div>
              <div>
                <span className="text-white/50">Detection Time</span>
                <div className="text-white font-mono mt-1">{new Date(anomaly.detected_at).toLocaleString()}</div>
              </div>
              <div>
                <span className="text-white/50">Anomaly ID</span>
                <div className="text-white/60 font-mono mt-1 text-[10px] truncate">{anomaly.id}</div>
              </div>
            </div>
            <div className="pt-2 border-t border-white/[0.05]">
              <p className="text-xs text-white/50">
                A {severity.label.toLowerCase()} statistical anomaly was detected with a z-score of {anomaly.metadata.z_score.toFixed(2)},
                indicating {Math.abs(anomaly.metadata.current_value - anomaly.metadata.baseline_mean).toFixed(2)} units
                deviation from baseline.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diff = now.getTime() - then.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return then.toLocaleDateString()
}

export function AnomalyFeedClient() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [countryFilter, setCountryFilter] = useState<string>('all')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/v1/anomalies', { cache: 'no-store' })
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data = await res.json() as { anomalies?: Anomaly[]; stats?: Stats; data?: Anomaly[] }
      // Support both response shapes for backward compatibility
      setAnomalies(data.anomalies ?? data.data ?? [])
      setStats(data.stats ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch anomalies')
      console.error('Anomaly fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchData])

  // Filter anomalies
  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (severityFilter !== 'all') {
        const severity = getSeverityBadge(a.metadata.z_score).label
        if (severity !== severityFilter) return false
      }
      if (countryFilter !== 'all' && a.country_code !== countryFilter) return false
      return true
    })
  }, [anomalies, severityFilter, countryFilter])

  // Get unique countries for filter
  const countries = useMemo(() => {
    const codes = [...new Set(anomalies.map((a) => a.country_code))]
    return codes.sort().map((code) => ({ code, name: getCountryName(code) }))
  }, [anomalies])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header with live pulse */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="w-6 h-6 text-cyan-400" />
            Anomaly Detection
          </h1>
          <p className="text-white/60 text-sm mt-1">Statistical deviation monitoring with real-time alerts</p>
        </div>
        <PulseIndicator />
      </motion.div>

      {/* Summary Stats */}
      {stats && (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, ...SPRING_SMOOTH }}
        >
          {[
            { label: 'Active Anomalies', value: stats.total, icon: AlertTriangle, color: 'from-cyan-500/10 to-cyan-500/5' },
            { label: 'Extreme (Z > 4)', value: stats.extreme, icon: TrendingUp, color: 'from-red-500/10 to-red-500/5' },
            { label: 'Countries Affected', value: stats.countries, icon: Globe, color: 'from-blue-500/10 to-blue-500/5' },
            { label: 'Latest Detection', value: getRelativeTime(stats.latest), icon: Calendar, color: 'from-purple-500/10 to-purple-500/5' },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.05, ...SPRING_SNAPPY }}
                whileHover={{ y: -2 }}
                className={`bg-gradient-to-br ${stat.color} border border-white/[0.06] rounded-xl p-4 backdrop-blur-sm hover:border-white/[0.1] transition-all`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white/50 mb-1">{stat.label}</div>
                    <div className="text-lg font-bold text-white truncate">{stat.value}</div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Filter Bar */}
      {anomalies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, ...SPRING_SMOOTH }}
          className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm flex flex-wrap gap-4 items-center"
        >
          <div className="flex-1 min-w-64 flex flex-col gap-2">
            <label className="text-xs text-white/60 font-medium">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-all"
            >
              <option value="all">All Levels</option>
              <option value="Extreme">Extreme (Z &gt; 4.0)</option>
              <option value="Significant">Significant (Z &gt; 3.0)</option>
              <option value="Moderate">Moderate (Z &gt; 2.0)</option>
              <option value="Minor">Minor</option>
            </select>
          </div>

          <div className="flex-1 min-w-64 flex flex-col gap-2">
            <label className="text-xs text-white/60 font-medium">Country</label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-all"
            >
              <option value="all">All Countries</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {getCountryFlag(c.code)} {c.name}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-12 text-white/50"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full mr-3"
          />
          <span className="text-sm">Loading anomalies...</span>
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SMOOTH}
          className="bg-red-500/10 border border-red-400/20 rounded-xl p-5 text-red-300 text-sm flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Failed to load anomalies</div>
            <div className="text-xs mt-1 text-red-300/70">{error}</div>
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {!loading && !error && anomalies.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={SPRING_SMOOTH}
          className="text-center py-16 text-white/50"
        >
          <Zap className="w-16 h-16 mx-auto mb-4 text-white/20" />
          <p className="text-sm">No anomalies detected at this time</p>
          <p className="text-xs mt-2 text-white/30">The anomaly detection engine monitors for statistical deviations<br />in geopolitical events and will alert you when found.</p>
        </motion.div>
      )}

      {/* Anomalies list */}
      {!loading && !error && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, ...SPRING_SMOOTH }}
          className="space-y-3"
        >
          <div className="text-xs text-white/50 font-semibold uppercase tracking-wider">
            {filtered.length} Anomaly{filtered.length !== 1 ? 'ies' : ''} Found
          </div>
          {filtered.map((anomaly, idx) => (
            <AnomalyCard key={anomaly.id} anomaly={anomaly} idx={idx} />
          ))}
        </motion.div>
      )}

      {/* No results with filters */}
      {!loading && !error && anomalies.length > 0 && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={SPRING_SMOOTH}
          className="text-center py-12 text-white/50"
        >
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-white/20" />
          <p className="text-sm">No anomalies match your filters</p>
          <p className="text-xs mt-1 text-white/30">Try adjusting your severity or country filters</p>
        </motion.div>
      )}
    </div>
  )
}
