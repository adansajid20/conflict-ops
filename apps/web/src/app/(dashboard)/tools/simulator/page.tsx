'use client'

import { useState, useCallback } from 'react'
import { Zap, Loader2, ChevronDown, ChevronUp, TrendingUp, Globe, AlertTriangle } from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-[#070B11] p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Zap className="w-6 h-6 text-blue-400" /> Scenario Simulator</h1>
        <p className="text-white/80 text-sm mt-1">Model cascading effects of any geopolitical trigger event</p>
      </div>

      {/* Templates */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-2">Quick scenarios</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(t => (
            <button key={t} onClick={() => setTrigger(t)} className="text-xs px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-full transition-colors text-white/60">
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 space-y-4 hover:bg-white/[0.03] transition-colors">
        <div>
          <label className="text-sm text-white/80 mb-2 block">Trigger Event</label>
          <textarea
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            placeholder="Describe the trigger event (e.g., &apos;Iran closes Strait of Hormuz after US sanctions&apos;)"
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400 resize-none"
            rows={3}
          />
        </div>
        <div>
          <label className="text-sm text-white/80 mb-2 block">Primary Region (optional)</label>
          <input
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="e.g., Iran, Middle East, Red Sea"
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400"
          />
        </div>
        <button
          onClick={() => void run()}
          disabled={loading || !trigger.trim()}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {loading ? 'Simulating...' : 'Run Simulation'}
        </button>
        {error && <div className="text-red-400 text-sm">{error}</div>}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 text-center hover:bg-white/[0.03] transition-colors">
              <div className={`text-2xl font-bold ${probColor(result.probability ?? 0)}`}>{Math.round((result.probability ?? 0) * 100)}%</div>
              <div className="text-xs text-white/50 mt-1">Scenario Probability</div>
            </div>
            <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 text-center hover:bg-white/[0.03] transition-colors">
              <div className="text-lg font-bold text-blue-400">{result.time_horizon}</div>
              <div className="text-xs text-white/50 mt-1">Time Horizon</div>
            </div>
            <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 text-center hover:bg-white/[0.03] transition-colors">
              <div className="text-2xl font-bold text-orange-400">{result.cascade_chain?.length ?? 0}</div>
              <div className="text-xs text-white/50 mt-1">Cascade Steps</div>
            </div>
          </div>

          {/* Cascade chain */}
          <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-400" /> Cascading Effects</h3>
            <div className="space-y-3">
              {(result.cascade_chain ?? []).map((step, i) => (
                <div key={i}>
                  <button
                    onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    className="w-full flex items-center gap-3 text-left p-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors border border-white/[0.05]"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${probColor(step.probability)} border border-current`}>
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{step.event}</div>
                      <div className="text-xs text-white/50">{step.timeframe} · {Math.round(step.probability * 100)}% probability</div>
                    </div>
                    {expandedStep === i ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                  </button>
                  {expandedStep === i && step.actors_involved?.length > 0 && (
                    <div className="mt-1 ml-11 p-3 bg-white/[0.05] rounded-lg text-xs text-white/80 border border-white/[0.05]">
                      Actors: {step.actors_involved.join(', ')}
                    </div>
                  )}
                  {i < (result.cascade_chain?.length ?? 0) - 1 && (
                    <div className="flex justify-center py-1"><div className="w-0.5 h-4 bg-white/[0.1]" /></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Commodity impacts */}
          {result.commodity_impacts && Object.keys(result.commodity_impacts).length > 0 && (
            <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
              <h3 className="font-semibold text-white mb-4">💹 Market Impacts</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(result.commodity_impacts).map(([sym, data]) => (
                  <div key={sym} className="flex items-center gap-3 p-3 bg-white/[0.05] rounded-lg border border-white/[0.05] hover:bg-white/[0.08] transition-colors">
                    <span className="font-mono text-sm text-blue-400 w-14">{sym}</span>
                    <span className={`font-bold ${data.change_pct > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {commodityDir(data.direction)}{Math.abs(data.change_pct)}%
                    </span>
                    <span className="text-xs text-white/50 flex-1">{data.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected regions + actors */}
          <div className="grid grid-cols-2 gap-3">
            {result.affected_regions && result.affected_regions.length > 0 && (
              <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.03] transition-colors">
                <h3 className="font-semibold text-white text-sm mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" /> Affected Regions</h3>
                <div className="flex flex-wrap gap-2">
                  {result.affected_regions.map(r => <span key={r} className="text-xs px-2 py-1 bg-blue-400/20 text-blue-300 rounded-full">{r}</span>)}
                </div>
              </div>
            )}
            {result.affected_actors && result.affected_actors.length > 0 && (
              <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.03] transition-colors">
                <h3 className="font-semibold text-white text-sm mb-3">Key Actors</h3>
                <div className="flex flex-wrap gap-2">
                  {result.affected_actors.map(a => <span key={a} className="text-xs px-2 py-1 bg-white/[0.1] text-white/80 rounded-full">{a}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* AI Analysis */}
          {result.ai_analysis && (
            <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-5 hover:bg-blue-500/15 transition-colors">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-blue-400" /> Strategic Analysis</h3>
              <p className="text-sm text-white/80 leading-relaxed">{result.ai_analysis}</p>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
              <h3 className="font-semibold text-white mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="text-blue-400 mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Historical parallels */}
          {result.historical_parallels && result.historical_parallels.length > 0 && (
            <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
              <h3 className="font-semibold text-white mb-3">📚 Historical Parallels</h3>
              <div className="space-y-3">
                {result.historical_parallels.map((h, i) => (
                  <div key={i} className="p-3 bg-white/[0.05] rounded-lg border border-white/[0.05] hover:bg-white/[0.08] transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{h.title}</span>
                      <span className="text-xs text-white/50">{Math.round(h.similarity * 100)}% similar</span>
                    </div>
                    <p className="text-xs text-white/50">{h.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
