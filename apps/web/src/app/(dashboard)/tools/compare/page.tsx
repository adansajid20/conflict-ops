'use client'

import { useState, useCallback } from 'react'
import { GitCompare, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type RegionStats = {
  region: string
  risk_score?: number
  event_count?: number
  critical?: number
  high?: number
  medium?: number
  low?: number
  predictions?: number
  escalation_trajectory?: string
  top_actors?: string[]
  top_categories?: string[]
}
type CompareResult = {
  region_a?: RegionStats
  region_b?: RegionStats
  ai_analysis?: string
  deteriorating_faster?: string
  verdict?: string
  error?: string
}

const REGIONS = [
  'Ukraine', 'Russia', 'Israel', 'Gaza', 'Iran', 'Yemen', 'Syria', 'Iraq',
  'Lebanon', 'Sudan', 'Myanmar', 'China', 'Taiwan', 'North Korea', 'Pakistan',
  'Afghanistan', 'Libya', 'Ethiopia', 'Mali', 'Somalia', 'Niger', 'Haiti',
]

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

function StatRow({ label, a, b, higherIsBad = true }: { label: string; a?: number | string; b?: number | string; higherIsBad?: boolean }) {
  const aNum = typeof a === 'number' ? a : parseFloat(String(a ?? '0'))
  const bNum = typeof b === 'number' ? b : parseFloat(String(b ?? '0'))
  const aWorse = higherIsBad ? aNum > bNum : aNum < bNum
  const bWorse = higherIsBad ? bNum > aNum : bNum < aNum
  return (
    <motion.div
      className="flex items-center py-3 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors"
      whileHover={{ x: 4 }}
    >
      <div className="w-1/3 text-xs text-white/50 font-medium">{label}</div>
      <div className={`w-1/3 text-center text-sm font-semibold ${aWorse ? 'text-red-400' : 'text-green-400'}`}>
        {typeof a === 'number' ? a.toFixed(1) : (a ?? '—')}
        {aWorse && <TrendingUp className="inline w-3 h-3 ml-1" />}
        {bWorse && a !== b && <TrendingDown className="inline w-3 h-3 ml-1" />}
      </div>
      <div className={`w-1/3 text-center text-sm font-semibold ${bWorse ? 'text-red-400' : 'text-green-400'}`}>
        {typeof b === 'number' ? b.toFixed(1) : (b ?? '—')}
        {bWorse && <TrendingUp className="inline w-3 h-3 ml-1" />}
        {aWorse && a !== b && <TrendingDown className="inline w-3 h-3 ml-1" />}
      </div>
    </motion.div>
  )
}

export default function ComparePage() {
  const [regionA, setRegionA] = useState('Ukraine')
  const [regionB, setRegionB] = useState('Sudan')
  const [result, setResult] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(false)

  const compare = useCallback(async () => {
    if (!regionA || !regionB || regionA === regionB) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/v1/tools/compare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'region_vs_region', region_a: regionA, region_b: regionB }),
      })
      const data = await res.json() as CompareResult
      setResult(data)
    } catch (e) { setResult({ error: String(e) }) }
    setLoading(false)
  }, [regionA, regionB])

  return (
    <div className="min-h-screen bg-[#070B11] p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SMOOTH}>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <GitCompare className="w-7 h-7 text-blue-400" /> Comparative Analysis
        </h1>
        <p className="text-white/60 text-sm mt-2">Side-by-side comparison of risk, events, predictions, and trajectory</p>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ...SPRING_SMOOTH }}
        className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
      >
        <div className="grid grid-cols-3 gap-4 items-end mb-5">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, ...SPRING_SMOOTH }}>
            <label className="text-xs text-white/80 mb-2 block font-medium">Region A</label>
            <select
              value={regionA}
              onChange={e => setRegionA(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </motion.div>
          <motion.div className="text-center text-white/50 font-bold text-lg pb-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, ...SPRING_SNAPPY }}>
            vs
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, ...SPRING_SMOOTH }}>
            <label className="text-xs text-white/80 mb-2 block font-medium">Region B</label>
            <select
              value={regionB}
              onChange={e => setRegionB(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </motion.div>
        </div>
        <motion.button
          onClick={() => void compare()}
          disabled={loading || regionA === regionB}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Compare Regions'}
        </motion.button>
      </motion.div>

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
          {/* Verdict banner */}
          {result.deteriorating_faster && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, ...SPRING_SMOOTH }}
              className="p-5 bg-gradient-to-br from-orange-500/15 to-orange-500/5 border border-orange-400/30 rounded-xl backdrop-blur-sm hover:border-orange-400/50 transition-all"
            >
              <div className="text-sm font-semibold text-orange-300 mb-2">
                ⚡ {result.deteriorating_faster} is deteriorating faster
              </div>
              {result.verdict && <p className="text-xs text-white/50">{result.verdict}</p>}
            </motion.div>
          )}

          {/* Stats table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, ...SPRING_SMOOTH }}
            className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl overflow-hidden backdrop-blur-sm hover:border-white/[0.1] transition-all"
          >
            <div className="flex items-center bg-white/[0.08] px-6 py-4 border-b border-white/[0.06]">
              <div className="w-1/3 text-xs text-white/50 uppercase tracking-wider font-semibold">Metric</div>
              <div className="w-1/3 text-center text-sm font-bold text-blue-400">{result.region_a?.region}</div>
              <div className="w-1/3 text-center text-sm font-bold text-blue-400">{result.region_b?.region}</div>
            </div>
            <div className="px-6 divide-y divide-white/[0.05]">
              <StatRow label="Risk Score" a={result.region_a?.risk_score} b={result.region_b?.risk_score} />
              <StatRow label="Events (30d)" a={result.region_a?.event_count} b={result.region_b?.event_count} />
              <StatRow label="Critical Events" a={result.region_a?.critical} b={result.region_b?.critical} />
              <StatRow label="High Events" a={result.region_a?.high} b={result.region_b?.high} />
              <StatRow label="Active Predictions" a={result.region_a?.predictions} b={result.region_b?.predictions} />
              <StatRow
                label="Trajectory"
                a={result.region_a?.escalation_trajectory ?? '—'}
                b={result.region_b?.escalation_trajectory ?? '—'}
                higherIsBad={false}
              />
            </div>
          </motion.div>

          {/* Top actors */}
          <motion.div
            className="grid grid-cols-2 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, ...SPRING_SMOOTH }}
          >
            {([result.region_a, result.region_b] as RegionStats[]).map((r, i) => r?.top_actors && (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.22 + i * 0.05, ...SPRING_SNAPPY }}
                whileHover={{ y: -2 }}
                className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm hover:border-white/[0.1] transition-all"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 text-blue-400">{r.region} — Top Actors</h3>
                <div className="flex flex-wrap gap-2">
                  {r.top_actors.map((a: string) => (
                    <motion.span
                      key={a}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-xs px-3 py-1 bg-white/[0.08] rounded-full text-white/80 font-medium border border-white/[0.1] backdrop-blur-sm"
                    >
                      {a}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* AI Analysis */}
          {result.ai_analysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, ...SPRING_SMOOTH }}
              className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-400/30 rounded-xl p-6 backdrop-blur-sm hover:border-blue-400/50 transition-all"
            >
              <h3 className="font-semibold mb-3 text-blue-300 flex items-center gap-2">📊 Intelligence Assessment</h3>
              <p className="text-sm text-white/80 leading-relaxed">{result.ai_analysis}</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  )
}
