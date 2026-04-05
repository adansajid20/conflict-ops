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
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-yellow-400" /> Scenario Simulator</h1>
        <p className="text-gray-400 text-sm mt-1">Model cascading effects of any geopolitical trigger event</p>
      </div>

      {/* Templates */}
      <div>
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Quick scenarios</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(t => (
            <button key={t} onClick={() => setTrigger(t)} className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-full transition-colors text-gray-300">
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Trigger Event</label>
          <textarea
            value={trigger}
            onChange={e => setTrigger(e.target.value)}
            placeholder="Describe the trigger event (e.g., 'Iran closes Strait of Hormuz after US sanctions')"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500 placeholder-gray-500 resize-none"
            rows={3}
          />
        </div>
        <div>
          <label className="text-sm text-gray-400 mb-2 block">Primary Region (optional)</label>
          <input
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="e.g., Iran, Middle East, Red Sea"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => void run()}
          disabled={loading || !trigger.trim()}
          className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${probColor(result.probability ?? 0)}`}>{Math.round((result.probability ?? 0) * 100)}%</div>
              <div className="text-xs text-gray-400 mt-1">Scenario Probability</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-lg font-bold text-blue-400">{result.time_horizon}</div>
              <div className="text-xs text-gray-400 mt-1">Time Horizon</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{result.cascade_chain?.length ?? 0}</div>
              <div className="text-xs text-gray-400 mt-1">Cascade Steps</div>
            </div>
          </div>

          {/* Cascade chain */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-400" /> Cascading Effects</h3>
            <div className="space-y-3">
              {(result.cascade_chain ?? []).map((step, i) => (
                <div key={i}>
                  <button
                    onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    className="w-full flex items-center gap-3 text-left p-3 bg-gray-800 hover:bg-gray-750 rounded-lg transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${probColor(step.probability)} border border-current`}>
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{step.event}</div>
                      <div className="text-xs text-gray-400">{step.timeframe} · {Math.round(step.probability * 100)}% probability</div>
                    </div>
                    {expandedStep === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {expandedStep === i && step.actors_involved?.length > 0 && (
                    <div className="mt-1 ml-11 p-3 bg-gray-800/50 rounded-lg text-xs text-gray-300">
                      Actors: {step.actors_involved.join(', ')}
                    </div>
                  )}
                  {i < (result.cascade_chain?.length ?? 0) - 1 && (
                    <div className="flex justify-center py-1"><div className="w-0.5 h-4 bg-gray-700" /></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Commodity impacts */}
          {result.commodity_impacts && Object.keys(result.commodity_impacts).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4">💹 Market Impacts</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(result.commodity_impacts).map(([sym, data]) => (
                  <div key={sym} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                    <span className="font-mono text-sm text-blue-400 w-14">{sym}</span>
                    <span className={`font-bold ${data.change_pct > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {commodityDir(data.direction)}{Math.abs(data.change_pct)}%
                    </span>
                    <span className="text-xs text-gray-400 flex-1">{data.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affected regions + actors */}
          <div className="grid grid-cols-2 gap-3">
            {result.affected_regions && result.affected_regions.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" /> Affected Regions</h3>
                <div className="flex flex-wrap gap-2">
                  {result.affected_regions.map(r => <span key={r} className="text-xs px-2 py-1 bg-blue-400/20 text-blue-300 rounded-full">{r}</span>)}
                </div>
              </div>
            )}
            {result.affected_actors && result.affected_actors.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3">Key Actors</h3>
                <div className="flex flex-wrap gap-2">
                  {result.affected_actors.map(a => <span key={a} className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded-full">{a}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* AI Analysis */}
          {result.ai_analysis && (
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-blue-400" /> Strategic Analysis</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{result.ai_analysis}</p>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-blue-400 mt-0.5">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Historical parallels */}
          {result.historical_parallels && result.historical_parallels.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-3">📚 Historical Parallels</h3>
              <div className="space-y-3">
                {result.historical_parallels.map((h, i) => (
                  <div key={i} className="p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{h.title}</span>
                      <span className="text-xs text-gray-400">{Math.round(h.similarity * 100)}% similar</span>
                    </div>
                    <p className="text-xs text-gray-400">{h.description}</p>
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
