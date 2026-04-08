'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle, BarChart3 } from 'lucide-react'

type Commodity = { id: string; symbol: string; name: string; price: number; change_24h: number; change_pct_24h: number; currency: string; recorded_at: string }
type Correlation = { commodity_symbol: string; price_change_pct: number; correlation_strength: number; ai_explanation: string; detected_at: string }

type ApiData = { commodities?: Commodity[]; correlations?: Correlation[] }

const COMMODITY_META: Record<string, { emoji: string; region: string; sector: string }> = {
  'CL=F': { emoji: '🛢️', region: 'Middle East / OPEC', sector: 'Energy' },
  'BZ=F': { emoji: '🛢️', region: 'Global / North Sea', sector: 'Energy' },
  'GC=F': { emoji: '🥇', region: 'Safe Haven (Global)', sector: 'Precious Metals' },
  'SI=F': { emoji: '⚪', region: 'Industrial / Safe Haven', sector: 'Precious Metals' },
  'ZW=F': { emoji: '🌾', region: 'Ukraine / Russia / US', sector: 'Agriculture' },
  'ZC=F': { emoji: '🌽', region: 'US / Brazil / Ukraine', sector: 'Agriculture' },
  'NG=F': { emoji: '🔥', region: 'Russia / Middle East', sector: 'Energy' },
  'HG=F': { emoji: '🟠', region: 'China / Chile / DRC', sector: 'Metals' },
}

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }

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
  const pctColor = (n: number) => n > 0 ? '#22c55e' : n < 0 ? '#ef4444' : '#6b7280'
  const PctIcon = ({ n }: { n: number }) => n > 0 ? <TrendingUp className="w-3 h-3" /> : n < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />

  const commodities = data.commodities ?? []
  const correlations = data.correlations ?? []
  const energyComm = commodities.filter(c => COMMODITY_META[c.symbol]?.sector === 'Energy')
  const agriComm = commodities.filter(c => COMMODITY_META[c.symbol]?.sector === 'Agriculture')
  const metalsComm = commodities.filter(c => ['Precious Metals', 'Metals'].includes(COMMODITY_META[c.symbol]?.sector ?? ''))

  return (
    <div className="min-h-screen bg-[#070B11] px-8 py-10 space-y-8">
      {/* Header */}
      <motion.div
        className="flex items-end justify-between gap-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <BarChart3 className="w-8 h-8 text-blue-400" />
            Market Impact Tracker
          </h1>
          <p className="text-sm text-white/40">Real-time commodity prices correlated with geopolitical events</p>
        </div>
        <motion.button
          onClick={() => void load()}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border transition-all"
          style={{
            background: loading ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.1)',
            borderColor: loading ? 'rgba(255,255,255,0.06)' : '#3b82f6',
            color: loading ? 'rgba(255,255,255,0.5)' : '#3b82f6',
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Updating…' : 'Refresh'}
        </motion.button>
      </motion.div>

      {/* Commodity Grid by Sector */}
      {commodities.length === 0 && !loading ? (
        <motion.div
          className="flex items-center gap-3 p-4 rounded-lg border"
          style={{
            background: '#eab30815',
            borderColor: '#eab30830',
            color: '#eab308',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">No commodity data yet. Check back soon.</span>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {/* Energy Sector */}
          {energyComm.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🛢️</span>
                Energy Sector
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {energyComm.map((c, i) => (
                  <CommodityCard key={c.symbol} commodity={c} delay={i * 0.05} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Agriculture Sector */}
          {agriComm.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🌾</span>
                Agriculture
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {agriComm.map((c, i) => (
                  <CommodityCard key={c.symbol} commodity={c} delay={i * 0.05} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Precious Metals & Metals */}
          {metalsComm.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                Precious Metals & Base Metals
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metalsComm.map((c, i) => (
                  <CommodityCard key={c.symbol} commodity={c} delay={i * 0.05} />
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Correlations */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          🔗 Event-Market Correlations
        </h2>
        {correlations.length === 0 ? (
          <motion.div
            className="p-6 rounded-2xl border"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-white/40 text-sm">No correlations detected yet.</p>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
          >
            {correlations.map((corr, i) => (
              <CorrelationCard key={i} correlation={corr} delay={i * 0.05} />
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Region-commodity map */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-lg font-bold text-white">📍 Region Impact Map</h2>
        <div
          className="rounded-2xl border p-6 grid grid-cols-1 md:grid-cols-2 gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          {[
            { region: 'Middle East', impact: 'Oil (CL=F, BZ=F), Natural Gas', color: '#ef4444' },
            { region: 'Ukraine/Russia', impact: 'Wheat (ZW=F), Corn (ZC=F)', color: '#f97316' },
            { region: 'Red Sea/Suez', impact: 'Brent Oil (BZ=F), Shipping', color: '#eab308' },
            { region: 'Critical Events', impact: 'Gold (GC=F) — safe haven', color: '#3b82f6' },
            { region: 'East Asia/Taiwan', impact: 'Copper (HG=F) — semiconductors', color: '#a78bfa' },
            { region: 'Sub-Saharan Africa', impact: 'Copper (DRC), Gold — mining', color: '#22c55e' },
          ].map((r, i) => (
            <motion.div
              key={r.region}
              className="p-4 rounded-lg border"
              style={{
                background: r.color + '10',
                borderColor: r.color + '30',
              }}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="font-semibold text-sm mb-1" style={{ color: r.color }}>
                {r.region}
              </div>
              <div className="text-xs text-white/50">→ {r.impact}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function CommodityCard({ commodity, delay }: { commodity: Commodity; delay: number }) {
  const meta = COMMODITY_META[commodity.symbol]
  const color = commodity.change_pct_24h > 0 ? '#22c55e' : commodity.change_pct_24h < 0 ? '#ef4444' : '#6b7280'

  return (
    <motion.div
      className="rounded-2xl border overflow-hidden group"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
      whileHover={{
        borderColor: color + '60',
        boxShadow: `0 0 20px ${color}20`,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring' as const, ...SPRING_SNAPPY }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{meta?.emoji ?? '💹'}</span>
            <span className="text-xs text-white/50 font-mono font-bold">{commodity.symbol}</span>
          </div>
          <motion.div
            className="flex items-center gap-1 font-semibold text-xs px-2 py-1 rounded"
            style={{ color, background: color + '15', borderColor: color + '30', border: '1px solid' }}
          >
            {commodity.change_pct_24h > 0 ? <TrendingUp className="w-3 h-3" /> : commodity.change_pct_24h < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {commodity.change_pct_24h > 0 ? '+' : ''}{fmt(commodity.change_pct_24h)}%
          </motion.div>
        </div>

        <motion.div
          className="font-bold text-2xl text-white font-mono"
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          transition={{ delay: delay + 0.1, type: 'spring' as const, ...SPRING_SNAPPY }}
        >
          ${fmt(commodity.price)}
        </motion.div>

        <div className="text-xs text-white/40">{commodity.name}</div>

        {meta?.region && (
          <div className="text-[10px] text-white/50 pt-2 border-t border-white/[0.05]">
            {meta.region}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function CorrelationCard({ correlation, delay }: { correlation: Correlation; delay: number }) {
  const color = correlation.price_change_pct > 0 ? '#22c55e' : correlation.price_change_pct < 0 ? '#ef4444' : '#6b7280'

  return (
    <motion.div
      className="rounded-2xl border overflow-hidden p-5 space-y-3"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring' as const, ...SPRING_SNAPPY }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="flex items-center justify-between gap-4">
        <motion.span
          className="font-mono text-sm font-bold"
          style={{ color: '#3b82f6' }}
        >
          {correlation.commodity_symbol}
        </motion.span>

        <motion.div
          className="flex items-center gap-2 font-semibold text-sm px-3 py-1.5 rounded"
          style={{ color, background: color + '15', border: `1px solid ${color}30` }}
        >
          {correlation.price_change_pct > 0 ? <TrendingUp className="w-3 h-3" /> : correlation.price_change_pct < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {correlation.price_change_pct > 0 ? '+' : ''}{fmt(correlation.price_change_pct)}%
        </motion.div>

        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs text-white/40">Confidence</span>
          <div className="w-24 h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#3b82f6' }}
              initial={{ width: 0 }}
              whileInView={{ width: `${correlation.correlation_strength * 100}%` }}
              transition={{ duration: 1, delay: delay + 0.2 }}
            />
          </div>
          <span className="text-xs text-white/60 w-10 text-right font-mono">{Math.round(correlation.correlation_strength * 100)}%</span>
        </div>
      </div>

      {correlation.ai_explanation && (
        <p className="text-sm text-white/60 leading-relaxed">{correlation.ai_explanation}</p>
      )}

      <div className="text-xs text-white/30 pt-2 border-t border-white/[0.05]">
        {new Date(correlation.detected_at).toLocaleDateString()} at {new Date(correlation.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </motion.div>
  )
}

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals)
}
