'use client'

import { useEffect, useState, useCallback } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react'

type Commodity = { id: string; symbol: string; name: string; price: number; change_24h: number; change_pct_24h: number; currency: string; recorded_at: string }
type Correlation = { commodity_symbol: string; price_change_pct: number; correlation_strength: number; ai_explanation: string; detected_at: string }

type ApiData = { commodities?: Commodity[]; correlations?: Correlation[] }

const COMMODITY_META: Record<string, { emoji: string; region: string }> = {
  'CL=F': { emoji: '🛢️', region: 'Middle East / OPEC' },
  'BZ=F': { emoji: '🛢️', region: 'Global / North Sea' },
  'GC=F': { emoji: '🥇', region: 'Safe Haven (Global)' },
  'SI=F': { emoji: '⚪', region: 'Industrial / Safe Haven' },
  'ZW=F': { emoji: '🌾', region: 'Ukraine / Russia / US' },
  'ZC=F': { emoji: '🌽', region: 'US / Brazil / Ukraine' },
  'NG=F': { emoji: '🔥', region: 'Russia / Middle East' },
  'HG=F': { emoji: '🟠', region: 'China / Chile / DRC' },
}

export default function MarketPage() {
  const [data, setData] = useState<ApiData>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/commodities')
      const d = await res.json() as ApiData
      setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const fmt = (n: number, decimals = 2) => n.toFixed(decimals)
  const pctColor = (n: number) => n > 0 ? 'text-green-400' : n < 0 ? 'text-red-400' : 'text-gray-400'
  const PctIcon = ({ n }: { n: number }) => n > 0 ? <TrendingUp className="w-3 h-3" /> : n < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />

  const commodities = data.commodities ?? []
  const correlations = data.correlations ?? []

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Market Impact Tracker</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time commodity prices correlated with geopolitical events</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Commodity Grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Live Commodity Prices</h2>
        {commodities.length === 0 && !loading && (
          <div className="flex items-center gap-2 text-yellow-400 text-sm p-4 bg-yellow-400/10 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            No commodity data yet. The collect-commodity-prices cron populates this every 30 minutes.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {commodities.map(c => {
            const meta = COMMODITY_META[c.symbol]
            return (
              <div key={c.symbol} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{meta?.emoji ?? '💹'}</span>
                  <span className="text-xs text-gray-400 font-mono">{c.symbol}</span>
                </div>
                <div className="font-bold text-xl">${fmt(c.price)}</div>
                <div className="text-xs text-gray-500 mb-2">{c.name}</div>
                <div className={`flex items-center gap-1 text-sm font-medium ${pctColor(c.change_pct_24h)}`}>
                  <PctIcon n={c.change_pct_24h} />
                  {c.change_pct_24h > 0 ? '+' : ''}{fmt(c.change_pct_24h)}% (24h)
                </div>
                {meta?.region && <div className="text-xs text-gray-500 mt-1">{meta.region}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Correlations */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Event–Market Correlations
          <span className="ml-2 text-xs text-gray-500 normal-case font-normal">AI-detected links between geopolitical events and price moves</span>
        </h2>
        {correlations.length === 0 ? (
          <div className="text-gray-500 text-sm p-4 bg-gray-900 rounded-xl border border-gray-800">
            No correlations detected yet. The detect-market-correlations cron runs hourly and populates this when commodity prices move {'>'} 1.5% following critical events.
          </div>
        ) : (
          <div className="space-y-3">
            {correlations.map((c, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-mono text-sm font-bold text-blue-400">{c.commodity_symbol}</span>
                  <span className={`text-sm font-semibold ${pctColor(c.price_change_pct)}`}>
                    {c.price_change_pct > 0 ? '+' : ''}{fmt(c.price_change_pct)}%
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="text-xs text-gray-400">Confidence</div>
                    <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${c.correlation_strength * 100}%` }} />
                    </div>
                    <div className="text-xs text-gray-300">{Math.round(c.correlation_strength * 100)}%</div>
                  </div>
                </div>
                {c.ai_explanation && <p className="text-sm text-gray-300">{c.ai_explanation}</p>}
                <div className="text-xs text-gray-500 mt-2">{new Date(c.detected_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Region-commodity map */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Region → Commodity Impact Map</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              { region: 'Middle East', impact: 'Oil (CL=F, BZ=F), Natural Gas (NG=F)', color: 'text-red-400' },
              { region: 'Ukraine / Russia', impact: 'Wheat (ZW=F), Corn (ZC=F), Natural Gas', color: 'text-orange-400' },
              { region: 'Red Sea / Suez', impact: 'Brent Oil (BZ=F), Shipping costs, Copper', color: 'text-yellow-400' },
              { region: 'Any Critical Event', impact: 'Gold (GC=F) — universal safe haven', color: 'text-blue-400' },
              { region: 'East Asia / Taiwan', impact: 'Copper (HG=F), Silver — semiconductor supply', color: 'text-purple-400' },
              { region: 'Sub-Saharan Africa', impact: 'Copper (DRC), Gold — mining disruption', color: 'text-green-400' },
            ].map(r => (
              <div key={r.region} className="flex gap-3 p-3 bg-gray-800 rounded-lg">
                <div className={`font-semibold ${r.color} shrink-0`}>{r.region}</div>
                <div className="text-gray-400">→ {r.impact}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
