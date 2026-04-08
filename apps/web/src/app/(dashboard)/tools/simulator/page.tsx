'use client'

import { useState, useCallback } from 'react'
import { Zap, Loader2, ChevronDown, ChevronUp, TrendingUp, Globe, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@clerk/nextjs'

type CascadeStep = { step: number; timeframe: string; event: string; probability: number; actors_involved: string[] }
type CommodityImpact = Record<string, { change_pct: number; direction: string; reason: string }>
type Historical = { title: string; similarity: number; description: string }
type SimResult = {
  cascade_chain?: CascadeStep[]
  affected_regions?: string[]
  commodity_impacts?: CommodityImpact
  affected_actors?: string[]
  probability?: number
  time_horizon?: string
  historical_parallels?: Historical[]
  recommendations?: string[]
  ai_analysis?: string
  id?: string
}

const TEMPLATES = [
  'Iran closes Strait of Hormuz',
  'Taiwan Strait blockade — Chinese naval exercise',
  'Red Sea shipping lanes shut down completely',
  'NATO Article 5 triggered in Baltic region',
  'North Korea conducts nuclear weapons test',
  'Russia cuts natural gas supply to Europe entirely',
]

export default function SimulatorPage() {
  const { user } = useUser()
  const [trigger, setTrigger] = useState('')
  const [region, setRegion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimResult | null>(null)
  const [error, setError] = useState('')
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const run = useCallback(async () => {
    if (!trigger.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/v1/tools/simulator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger, region, user_id: user?.id ?? 'anonymous' }),
      })
      const data = await res.json() as SimResult & { error?: string }
      if (data.error) { setError(data.error); return }
      setResult(data)
    } catch (e) { setError(String(e)) }
    setLoading(false)
  }, [trigger, region, user])

  const probColor = (p: number) => p >= 0.7 ? 'text-red-400' : p >= 0.5 ? 'text-orange-400' : p >= 0.3 ? 'text-yellow-400' : 'text-green-400'
  const commodityDir = (d: string) => d === 'up' ? '▲' : d === 'down' ? '▼' : '→'

  const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
  const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

  return (
    <div className="min-h-screen bg-[#070B11] p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SMOOTH}>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Zap className="w-7 h-7 text-blue-400" /> Scenario Simulator</h1>
        <p className="text-white/60 text-sm mt-2">Model cascading effects of any geopolitical trigger event</p>
      </motion.div>

      {/* Templates */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, ...SPRING_SMOOTH }}>
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-3 font-semibold">Quick scenarios</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t, i) => (
            <motion.button
              key={t}
              onClick={() => setTrigger(t)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, ...SPRING_SNAPPY }}
              whileHover={{ y: -2 }}
              className="text-xs px-4 py-2 bg-gradient-to-br from-white/[0.08] to-white/[0.03] hover:from-white/[0.12] hover:to-white/[0.06] border border-white/[0.08] rounded-full transition-all text-white/70 hover:text-white/90 font-medium backdrop-blur-sm"
            >
              {t}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, ...SPRING_SMOOTH }}
        className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 space-y-4 backdrop-blur-sm hover:border-white/[0.1] transition-all"
      >
        <div>
          <label className="text-sm text-white/80 mb-2 block font-medium">Trigger Event</label>
          <textarea
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            placeholder="Describe the trigger event (e.g., 'Iran closes Strait of Hormuz after US sanctions')"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] resize-none transition-all backdrop-blur-sm"
            rows={3}
          />
        </div>
        <div>
          <label className="text-sm text-white/80 mb-2 block font-medium">Primary Region (optional)</label>
          <input
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="e.g., Iran, Middle East, Red Sea"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
          />
        </div>
        <motion.button
          onClick={() => void run()}
          disabled={loading || !trigger.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? 'Simulating...' : 'Run Simulation'}
        </motion.button>
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 backdrop-blur-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING_SMOOTH}
          >
            {/* Overview */}
            <motion.div className="grid grid-cols-3 gap-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, ...SPRING_SMOOTH }}>
              {[
                { label: 'Scenario Probability', value: `${Math.round((result.probability ?? 0) * 100)}%`, color: probColor(result.probability ?? 0), icon: '📊' },
                { label: 'Time Horizon', value: result.time_horizon, color: 'text-blue-400', icon: '⏱️' },
                { label: 'Cascade Steps', value: result.cascade_chain?.length ?? 0, color: 'text-orange-400', icon: '⛓️' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.12 + i * 0.05, ...SPRING_SNAPPY }}
                  whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.15)' }}
                  className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-5 text-center hover:border-white/[0.1] transition-all backdrop-blur-sm"
                >
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-white/50 mt-2 font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Cascade chain */}
            <motion.div
              className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...SPRING_SMOOTH }}
            >
              <h3 className="font-semibold text-white mb-5 flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-orange-400" /> Cascading Effects</h3>
              <div className="space-y-2">
                {(result.cascade_chain ?? []).map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05, ...SPRING_SMOOTH }}>
                    <motion.button
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                      whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.08)' }}
                      className="w-full flex items-center gap-3 text-left p-4 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-all border border-white/[0.05] hover:border-white/[0.1]"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${probColor(step.probability)} border border-current ring-2 ring-current ring-opacity-20`}>
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{step.event}</div>
                        <div className="text-xs text-white/50">{step.timeframe} · {Math.round(step.probability * 100)}% probability</div>
                      </div>
                      <motion.div animate={{ rotate: expandedStep === i ? 180 : 0 }} transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}>
                        <ChevronDown className="w-4 h-4 text-white/30" />
                      </motion.div>
                    </motion.button>
                    <AnimatePresence>
                      {expandedStep === i && step.actors_involved?.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={SPRING_SMOOTH}
                          className="mt-2 ml-4 p-3 bg-white/[0.05] rounded-lg text-xs text-white/80 border border-white/[0.05] backdrop-blur-sm"
                        >
                          <span className="font-medium">Key Actors:</span> {step.actors_involved.join(', ')}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {i < (result.cascade_chain?.length ?? 0) - 1 && (
                      <motion.div className="flex justify-center py-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.05 + 0.1 }}>
                        <motion.div className="w-0.5 h-3 bg-gradient-to-b from-white/[0.1] to-white/[0.05]" />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Commodity impacts */}
            {result.commodity_impacts && Object.keys(result.commodity_impacts).length > 0 && (
              <motion.div
                className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ...SPRING_SMOOTH }}
              >
                <h3 className="font-semibold text-white mb-4 text-lg">💹 Market Impacts</h3>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(result.commodity_impacts).map(([sym, data], idx) => (
                    <motion.div
                      key={sym}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.27 + idx * 0.03, ...SPRING_SNAPPY }}
                      whileHover={{ y: -2 }}
                      className="flex items-center gap-3 p-3 bg-white/[0.05] rounded-lg border border-white/[0.05] hover:bg-white/[0.08] hover:border-white/[0.1] transition-all backdrop-blur-sm"
                    >
                      <span className="font-mono text-sm font-bold text-blue-400 w-14 uppercase">{sym}</span>
                      <span className={`font-bold text-lg ${data.change_pct > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {commodityDir(data.direction)}{Math.abs(data.change_pct)}%
                      </span>
                      <span className="text-xs text-white/50 flex-1">{data.reason}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Affected regions + actors */}
            <motion.div
              className="grid grid-cols-2 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, ...SPRING_SMOOTH }}
            >
              {result.affected_regions && result.affected_regions.length > 0 && (
                <motion.div
                  className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm hover:border-white/[0.1] transition-all"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.32, ...SPRING_SNAPPY }}
                  whileHover={{ y: -2 }}
                >
                  <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" /> Affected Regions</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.affected_regions.map((r, idx) => (
                      <motion.span key={r} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.33 + idx * 0.03 }} className="text-xs px-3 py-1 bg-blue-400/20 text-blue-300 rounded-full font-medium border border-blue-400/30 backdrop-blur-sm">
                        {r}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
              {result.affected_actors && result.affected_actors.length > 0 && (
                <motion.div
                  className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm hover:border-white/[0.1] transition-all"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, ...SPRING_SNAPPY }}
                  whileHover={{ y: -2 }}
                >
                  <h3 className="font-semibold text-white text-sm mb-3">Key Actors</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.affected_actors.map((a, idx) => (
                      <motion.span key={a} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.36 + idx * 0.03 }} className="text-xs px-3 py-1 bg-purple-400/20 text-purple-300 rounded-full font-medium border border-purple-400/30 backdrop-blur-sm">
                        {a}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* AI Analysis */}
            {result.ai_analysis && (
              <motion.div
                className="bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-400/30 rounded-xl p-6 backdrop-blur-sm hover:border-blue-400/50 transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38, ...SPRING_SMOOTH }}
              >
                <h3 className="font-semibold text-blue-300 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Strategic Analysis</h3>
                <p className="text-sm text-white/80 leading-relaxed">{result.ai_analysis}</p>
              </motion.div>
            )}

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <motion.div
                className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, ...SPRING_SMOOTH }}
              >
                <h3 className="font-semibold text-white mb-4">📋 Recommendations</h3>
                <ul className="space-y-2.5">
                  {result.recommendations.map((r, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.41 + i * 0.03, ...SPRING_SMOOTH }}
                      className="flex items-start gap-3 text-sm text-white/80"
                    >
                      <span className="text-blue-400 font-bold mt-0.5">→</span> <span>{r}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Historical parallels */}
            {result.historical_parallels && result.historical_parallels.length > 0 && (
              <motion.div
                className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm hover:border-white/[0.1] transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, ...SPRING_SMOOTH }}
              >
                <h3 className="font-semibold text-white mb-4">📚 Historical Parallels</h3>
                <div className="space-y-3">
                  {result.historical_parallels.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.46 + i * 0.04, ...SPRING_SMOOTH }}
                      whileHover={{ x: 4, borderColor: 'rgba(255,255,255,0.15)' }}
                      className="p-4 bg-white/[0.05] rounded-lg border border-white/[0.05] hover:bg-white/[0.08] hover:border-white/[0.1] transition-all backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{h.title}</span>
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-400/20 text-green-300">{Math.round(h.similarity * 100)}% match</span>
                      </div>
                      <p className="text-xs text-white/60">{h.description}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
