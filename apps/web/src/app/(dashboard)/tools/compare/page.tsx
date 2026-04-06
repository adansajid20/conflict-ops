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
    <div className="flex items-center py-2 border-b border-white/[0.05] last:border-0">
      <div className="w-1/3 text-xs text-white/50">{label}</div>
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
    <div className="min-h-screen bg-[#070B11] p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-blue-400" /> Comparative Analysis
        </h1>
        <p className="text-white/80 text-sm mt-1">Side-by-side comparison of any two regions — risk, events, predictions, trajectory</p>
      </div>

      {/* Controls */}
      <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.03] transition-colors">
        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-white/80 mb-2 block">Region A</label>
            <select
              value={regionA}
              onChange={e => setRegionA(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400"
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="text-center text-white/50 font-bold text-lg pb-1">vs</div>
          <div>
            <label className="text-xs text-white/80 mb-2 block">Region B</label>
            <select
              value={regionB}
              onChange={e => setRegionB(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400"
            >
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <button
          onClick={() => void compare()}
          disabled={loading || regionA === regionB}
          className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompare className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Compare Regions'}
        </button>
      </div>

      {result?.error && <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded-xl border border-red-400/20">{result.error}</div>}

      {result && !result.error && (
        <div className="space-y-5">
          {/* Verdict banner */}
          {result.deteriorating_faster && (
            <div className="p-4 bg-orange-500/10 border border-orange-400/20 rounded-xl hover:bg-orange-500/15 transition-colors">
              <div className="text-sm font-semibold text-orange-400">
                ⚡ {result.deteriorating_faster} is deteriorating faster
              </div>
              {result.verdict && <p className="text-xs text-white/50 mt-1">{result.verdict}</p>}
            </div>
          )}

          {/* Stats table */}
          <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl overflow-hidden">
            <div className="flex items-center bg-white/[0.05] px-4 py-3">
              <div className="w-1/3 text-xs text-white/50 uppercase tracking-wider">Metric</div>
              <div className="w-1/3 text-center text-sm font-bold text-blue-400">{result.region_a?.region}</div>
              <div className="w-1/3 text-center text-sm font-bold text-blue-400">{result.region_b?.region}</div>
            </div>
            <div className="px-4 divide-y divide-white/[0.05]">
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
              <div key={i} className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 hover:bg-white/[0.03] transition-colors">
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 text-blue-400`}>{r.region} — Top Actors</h3>
                <div className="flex flex-wrap gap-1">
                  {r.top_actors.map((a: string) => <span key={a} className="text-xs px-2 py-0.5 bg-white/[0.1] rounded-full text-white/80">{a}</span>)}
                </div>
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          {result.ai_analysis && (
            <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-5 hover:bg-blue-500/15 transition-colors">
              <h3 className="font-semibold mb-2 text-blue-400">Intelligence Assessment</h3>
              <p className="text-sm text-white/80 leading-relaxed">{result.ai_analysis}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
