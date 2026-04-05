'use client'

import { useState, useCallback } from 'react'
import { GitCompare, Loader2, TrendingUp, TrendingDown } from 'lucide-react'

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

function StatRow({ label, a, b, higherIsBad = true }: { label: string; a?: number | string; b?: number | string; higherIsBad?: boolean }) {
  const aNum = typeof a === 'number' ? a : parseFloat(String(a ?? '0'))
  const bNum = typeof b === 'number' ? b : parseFloat(String(b ?? '0'))
  const aWorse = higherIsBad ? aNum > bNum : aNum < bNum
  const bWorse = higherIsBad ? bNum > aNum : bNum < aNum
  return (
    <div className="flex items-center py-2 border-b border-gray-800 last:border-0">
      <div className="w-1/3 text-xs text-gray-400">{label}</div>
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
    </div>
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
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-purple-400" /> Comparative Analysis
        </h1>
        <p className="text-gray-400 text-sm mt-1">Side-by-side comparison of any two regions — risk, events, predictions, trajectory</p>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Region A</label>
            <select
              value={regionA}
              onChange={e => setRegionA(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500"
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="text-center text-gray-500 font-bold text-lg pb-1">vs</div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Region B</label>
            <select
              value={regionB}
              onChange={e => setRegionB(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500"
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => void compare()}
          disabled={loading || regionA === regionB}
          className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Compare Regions'}
        </button>
      </div>

      {result?.error && <div className="text-red-400 text-sm p-4 bg-red-950/20 rounded-xl border border-red-500/20">{result.error}</div>}

      {result && !result.error && (
        <div className="space-y-5">
          {/* Verdict banner */}
          {result.deteriorating_faster && (
            <div className="p-4 bg-orange-950/30 border border-orange-500/30 rounded-xl">
              <div className="text-sm font-semibold text-orange-300">
                ⚡ {result.deteriorating_faster} is deteriorating faster
              </div>
              {result.verdict && <p className="text-xs text-gray-400 mt-1">{result.verdict}</p>}
            </div>
          )}

          {/* Stats table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center bg-gray-800 px-4 py-3">
              <div className="w-1/3 text-xs text-gray-400 uppercase tracking-wider">Metric</div>
              <div className="w-1/3 text-center text-sm font-bold text-blue-400">{result.region_a?.region}</div>
              <div className="w-1/3 text-center text-sm font-bold text-purple-400">{result.region_b?.region}</div>
            </div>
            <div className="px-4 divide-y divide-gray-800">
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
          </div>

          {/* Top actors */}
          <div className="grid grid-cols-2 gap-3">
            {([result.region_a, result.region_b] as RegionStats[]).map((r, i) => r?.top_actors && (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${i === 0 ? 'text-blue-400' : 'text-purple-400'}`}>{r.region} — Top Actors</h3>
                <div className="flex flex-wrap gap-1">
                  {r.top_actors.map((a: string) => <span key={a} className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">{a}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          {result.ai_analysis && (
            <div className="bg-purple-950/20 border border-purple-800/30 rounded-xl p-5">
              <h3 className="font-semibold mb-2 text-purple-300">Intelligence Assessment</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{result.ai_analysis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
