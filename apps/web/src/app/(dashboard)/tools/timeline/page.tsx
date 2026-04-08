'use client'

import { useState, useCallback } from 'react'
import { Clock, Star, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type TimelineEntry = {
  timestamp: string
  event_id?: string
  title: string
  severity: string
  description?: string
  is_turning_point?: boolean
}
type TurningPoint = { timestamp: string; description: string; significance: string }
type Cluster = { id: string; canonical_title: string; event_count: number; location?: string; country_code?: string }
type TimelineResult = {
  title?: string
  entries?: TimelineEntry[]
  turning_points?: TurningPoint[]
  ai_narrative?: string
  id?: string
  error?: string
}
type ClustersData = { clusters?: Cluster[] }

const severityColor: Record<string, string> = {
  critical: 'bg-red-500 border-red-400',
  high: 'bg-orange-500 border-orange-400',
  medium: 'bg-yellow-500 border-yellow-400',
  low: 'bg-green-500 border-green-400',
}
const severityDot: Record<string, string> = {
  4: 'bg-red-500',
  3: 'bg-orange-500',
  2: 'bg-yellow-500',
  1: 'bg-green-500',
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

export default function TimelinePage() {
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<string>('')
  const [result, setResult] = useState<TimelineResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)

  const loadClusters = useCallback(async () => {
    setLoadingClusters(true)
    try {
      const res = await fetch('/api/v1/situations?limit=30')
      const d = await res.json() as ClustersData
      setClusters(d.clusters ?? [])
    } catch { /* ignore */ }
    setLoadingClusters(false)
  }, [])

  const generate = useCallback(async () => {
    if (!selectedCluster) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/v1/tools/timeline', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cluster_id: selectedCluster }),
      })
      const data = await res.json() as TimelineResult
      setResult(data)
    } catch (e) { setResult({ error: String(e) }) }
    setLoading(false)
  }, [selectedCluster])

  const sev = (entry: TimelineEntry) => {
    const n = Number(entry.severity)
    if (!isNaN(n)) return severityDot[String(n)] ?? 'bg-gray-500'
    return severityColor[entry.severity] ?? 'bg-gray-500'
  }

  return (
    <div className="min-h-screen bg-[#070B11] p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SMOOTH}>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Clock className="w-7 h-7 text-blue-400" /> Event Timeline Reconstruction
        </h1>
        <p className="text-white/60 text-sm mt-2">AI-generated timeline of any developing situation with turning points, escalations, and key actors</p>
      </motion.div>

      {/* Selector */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ...SPRING_SMOOTH }}
        className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 space-y-4 backdrop-blur-sm hover:border-white/[0.1] transition-all"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white text-lg">Select a Situation</h2>
          {clusters.length === 0 && (
            <motion.button
              onClick={() => void loadClusters()}
              disabled={loadingClusters}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {loadingClusters ? 'Loading...' : 'Load situations'}
            </motion.button>
          )}
        </div>
        {clusters.length > 0 && (
          <select
            value={selectedCluster}
            onChange={e => setSelectedCluster(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
          >
            <option value="">-- Choose a situation --</option>
            {clusters.map(c => (
              <option key={c.id} value={c.id}>
                {c.canonical_title} {c.location ? `(${c.location})` : ''} — {c.event_count} events
              </option>
            ))}
          </select>
        )}
        {clusters.length === 0 && (
          <p className="text-sm text-white/50">Click &quot;Load situations&quot; to fetch active situation clusters from the database.</p>
        )}
        <motion.button
          onClick={() => void generate()}
          disabled={loading || !selectedCluster}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          {loading ? 'Reconstructing Timeline...' : 'Generate Timeline'}
        </motion.button>
      </motion.div>

      {/* Result */}
      <AnimatePresence>
        {result?.error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-400/20 backdrop-blur-sm"
          >
            {result.error}
          </motion.div>
        )}
      </AnimatePresence>

      {result && !result.error && (
        <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={SPRING_SMOOTH}>
          {result.title && (
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, ...SPRING_SMOOTH }}
              className="text-2xl font-bold text-white"
            >
              {result.title}
            </motion.h2>
          )}

          {/* AI Narrative */}
          {result.ai_narrative && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, ...SPRING_SMOOTH }}
              className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-400/30 rounded-xl p-6 backdrop-blur-sm hover:border-blue-400/50 transition-all"
            >
              <h3 className="font-semibold mb-3 text-blue-300 flex items-center gap-2">📖 Intelligence Narrative</h3>
              <p className="text-sm text-white/80 leading-relaxed">{result.ai_narrative}</p>
            </motion.div>
          )}

          {/* Turning points summary */}
          {result.turning_points && result.turning_points.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...SPRING_SMOOTH }}
              className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
            >
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2 text-lg">
                <Star className="w-5 h-5 text-yellow-400" /> Turning Points ({result.turning_points.length})
              </h3>
              <div className="space-y-3">
                {result.turning_points.map((tp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.05, ...SPRING_SMOOTH }}
                    className="flex gap-4"
                  >
                    <div className="text-yellow-400 shrink-0 font-mono text-xs pt-0.5 font-bold">
                      {new Date(tp.timestamp).toLocaleDateString()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">{tp.description}</div>
                      {tp.significance && <div className="text-white/50 text-xs mt-1">{tp.significance}</div>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Timeline */}
          {result.entries && result.entries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, ...SPRING_SMOOTH }}
              className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
            >
              <h3 className="font-semibold text-white mb-6 text-lg">Event Timeline ({result.entries.length} events)</h3>
              <div className="relative">
                {/* Vertical line */}
                <motion.div
                  className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-white/[0.1] to-white/[0.05]"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: 0.27, duration: 0.6 }}
                  style={{ originY: 0 }}
                />

                <div className="space-y-1">
                  {result.entries.map((entry, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.28 + i * 0.03, ...SPRING_SMOOTH }}
                    >
                      <motion.button
                        onClick={() => setExpanded(expanded === i ? null : i)}
                        whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
                        className="w-full flex items-start gap-4 text-left hover:bg-white/[0.03] p-3 rounded-lg transition-all"
                      >
                        {/* Dot */}
                        <div className={`relative z-10 w-3 h-3 rounded-full mt-1.5 shrink-0 ml-2.5 ring-2 ring-[#070B11] ring-offset-2 ring-offset-[#070B11] ${sev(entry)} ${entry.is_turning_point ? 'ring-4 ring-yellow-400 ring-offset-yellow-400' : ''}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.is_turning_point && <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                            <span className="text-xs text-white/50 font-mono shrink-0">
                              {new Date(entry.timestamp).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`text-sm mt-1 ${entry.is_turning_point ? 'font-semibold text-white' : 'text-white/80'}`}>
                            {entry.title}
                          </div>
                        </div>

                        <motion.div animate={{ rotate: expanded === i ? 180 : 0 }} transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}>
                          {entry.description && <ChevronDown className="w-4 h-4 text-white/30 shrink-0" />}
                        </motion.div>
                      </motion.button>
                      <AnimatePresence>
                        {expanded === i && entry.description && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={SPRING_SMOOTH}
                            className="ml-10 mb-2 px-3 py-2 text-xs text-white/60 leading-relaxed bg-white/[0.03] rounded-lg border border-white/[0.05] backdrop-blur-sm"
                          >
                            {entry.description}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  )
}
