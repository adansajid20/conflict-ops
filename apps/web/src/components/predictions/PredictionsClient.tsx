'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'

type Prediction = {
  id: string; prediction_type: string; title: string; description: string
  region: string; probability: number; time_horizon_hours: number
  severity_if_true: string; evidence: Record<string, unknown>
  outcome: string | null; created_at: string; expires_at: string
}

type PredMeta = { total: number; accuracy_30d: number | null; confirmed_30d: number; total_evaluated_30d: number }

const TYPE_COLORS: Record<string, string> = { escalation: '#ef4444', attack: '#f97316', diplomatic: '#3b82f6', humanitarian: '#a78bfa', economic: '#22c55e' }
const TYPE_ICONS: Record<string, string> = { escalation: '⚡', attack: '💥', diplomatic: '🤝', humanitarian: '🏥', economic: '📊' }
const SEV_COLORS: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { stiffness: 120, damping: 20, mass: 0.8 }

function ProbabilityRing({ prob }: { prob: number }) {
  const r = 28, circ = 2 * Math.PI * r
  const pct = Math.round(prob * 100)
  const color = pct >= 70 ? '#ef4444' : pct >= 50 ? '#f97316' : pct >= 30 ? '#eab308' : '#22c55e'

  return (
    <motion.div
      className="relative flex-shrink-0"
      style={{ width: 70, height: 70 }}
      initial={{ scale: 0.8, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
    >
      <svg width={70} height={70} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
        <motion.circle
          cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={`${circ * prob} ${circ}`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          whileInView={{ strokeDasharray: `${circ * prob} ${circ}` }}
          transition={{ duration: 1.5, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-lg font-bold tabular-nums"
          style={{ color }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {pct}%
        </motion.span>
      </div>
    </motion.div>
  )
}

function AccuracyChart({ accuracy }: { accuracy: number | null }) {
  if (!accuracy) return null
  const segments = 20
  const filled = Math.round((accuracy / 100) * segments)

  return (
    <motion.svg
      width="100%"
      height={32}
      viewBox="0 0 200 32"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      {[...Array(segments)].map((_, i) => {
        const isFilled = i < filled
        const x = (i * 10) + 2
        return (
          <motion.rect
            key={i}
            x={x}
            y={4}
            width={8}
            height={24}
            rx={1}
            fill={isFilled ? '#3b82f6' : 'rgba(255,255,255,0.05)'}
            initial={{ height: 0, y: 16 }}
            whileInView={{ height: 24, y: 4 }}
            transition={{ delay: i * 0.02 + 0.2 }}
          />
        )
      })}
    </motion.svg>
  )
}

function PredCard({ pred, expanded, onToggle }: { pred: Prediction; expanded: boolean; onToggle: () => void }) {
  const color = TYPE_COLORS[pred.prediction_type] ?? '#64748b'
  const icon = TYPE_ICONS[pred.prediction_type] ?? '🔮'
  const sevColor = SEV_COLORS[pred.severity_if_true] ?? '#64748b'
  const hoursLeft = Math.max(0, Math.round((new Date(pred.expires_at).getTime() - Date.now()) / 3600000))
  const indicators = (pred.evidence?.key_indicators as string[]) ?? []
  const isHighConfidence = pred.probability >= 0.7

  return (
    <motion.div
      layout
      onClick={onToggle}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
      className="cursor-pointer"
    >
      <motion.div
        className="group relative overflow-hidden rounded-2xl border transition-all hover:shadow-lg"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          borderColor: expanded ? color + '40' : 'rgba(255,255,255,0.06)',
        }}
        whileHover={{
          borderColor: color + '60',
          boxShadow: `0 0 20px ${color}20`
        }}
      >
        {/* Top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Main content */}
        <div className="flex gap-5 items-start p-6">
          <ProbabilityRing prob={pred.probability} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <motion.span
                className="text-[11px] font-bold uppercase tracking-[0.05em] px-2.5 py-1 rounded-lg"
                style={{ color, background: color + '15', border: `1px solid ${color}30` }}
              >
                {icon} {pred.prediction_type}
              </motion.span>
              <motion.span
                className="text-[11px] px-2.5 py-1 rounded-lg uppercase font-semibold"
                style={{ color: sevColor, background: sevColor + '15', border: `1px solid ${sevColor}30` }}
              >
                {pred.severity_if_true}
              </motion.span>
              <motion.span className="text-[11px] text-white/40 ml-auto">⏱ {hoursLeft}h</motion.span>
            </div>

            <motion.h3 className="text-sm font-bold text-white leading-snug mb-1 line-clamp-2">
              {pred.title}
            </motion.h3>

            <div className="flex items-center justify-between">
              <motion.span className="text-xs text-white/50">
                {pred.region.replace(/_/g, ' ')}
              </motion.span>
              {isHighConfidence && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1"
                >
                  <TrendingUp className="w-3 h-3 text-red-400" />
                  <span className="text-xs text-red-400 font-semibold">HIGH CONFIDENCE</span>
                </motion.div>
              )}
            </div>
          </div>

          <motion.div
            className="text-white/30 flex-shrink-0"
            animate={{ rotate: expanded ? 180 : 0 }}
          >
            ▼
          </motion.div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring' as const, ...SPRING_SMOOTH }}
              className="border-t border-white/[0.05] px-6 pb-6 pt-4 space-y-4"
            >
              <motion.p
                className="text-xs text-white/70 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {pred.description}
              </motion.p>

              {indicators.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 mb-3">Watch For</div>
                  <motion.div className="space-y-2">
                    {indicators.map((ind, i) => (
                      <motion.div
                        key={i}
                        className="flex items-start gap-2 text-xs text-white/60 pl-2 border-l-2"
                        style={{ borderColor: color + '40' }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 + 0.2 }}
                      >
                        <span className="flex-shrink-0 mt-1" style={{ color }}>•</span>
                        <span>{ind}</span>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              )}

              <motion.div
                className="text-[10px] text-white/40 pt-2 border-t border-white/[0.05]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Generated {new Date(pred.created_at).toLocaleDateString()} at {new Date(pred.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

export function PredictionsClient() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [meta, setMeta] = useState<PredMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/v1/predictions?limit=30')
      .then(r => r.json())
      .then(d => {
        const dd = d as { predictions: Prediction[]; meta: PredMeta }
        setPredictions(dd.predictions ?? [])
        setMeta(dd.meta ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? predictions : predictions.filter(p => p.prediction_type === filter)
  const types = ['all', 'escalation', 'attack', 'diplomatic', 'humanitarian', 'economic']
  const highConfidenceCount = predictions.filter(p => p.probability >= 0.7).length

  if (loading) return (
    <div className="min-h-screen bg-[#070B11] flex items-center justify-center">
      <motion.div
        className="text-white/50 text-sm"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        Loading predictions…
      </motion.div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#070B11] px-8 py-10">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-end justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold text-white m-0 flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-blue-400" />
              Prediction Engine
            </h1>
            <p className="text-sm text-white/40 mt-2">AI-powered geopolitical forecast system</p>
          </div>
        </div>
      </motion.div>

      {/* KPI Strip */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
      >
        {[
          { label: 'Total Predictions', value: predictions.length, color: '#3b82f6' },
          { label: 'Accuracy (30d)', value: meta?.accuracy_30d != null ? `${meta.accuracy_30d}%` : '—', color: '#a78bfa' },
          { label: 'Active', value: predictions.length, color: '#eab308' },
          { label: 'Confirmed (30d)', value: meta?.confirmed_30d ?? 0, color: '#22c55e' },
          { label: 'High Confidence', value: highConfidenceCount, color: '#ef4444' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, type: 'spring' as const, ...SPRING_SNAPPY }}
            className="group rounded-xl overflow-hidden border p-4 transition-all hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-2">{kpi.label}</div>
            <motion.div
              className="text-2xl font-bold font-mono"
              style={{ color: kpi.color }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring' as const, ...SPRING_SNAPPY, delay: 0.2 + i * 0.05 }}
            >
              {kpi.value}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      {/* Accuracy breakdown chart */}
      {meta?.accuracy_30d != null && (
        <motion.div
          className="mb-8 rounded-2xl overflow-hidden border p-6"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
            30-Day Accuracy Breakdown
          </div>
          <AccuracyChart accuracy={meta.accuracy_30d} />
        </motion.div>
      )}

      {/* Type filter */}
      <motion.div
        className="flex gap-2 mb-8 flex-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {types.map((t, i) => {
          const color = TYPE_COLORS[t] ?? '#3b82f6'
          const active = filter === t
          return (
            <motion.button
              key={t}
              onClick={() => setFilter(t)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 rounded-full text-xs cursor-pointer transition-all border font-semibold"
              style={{
                background: active ? color + '15' : 'transparent',
                borderColor: active ? color : 'rgba(255,255,255,0.1)',
                color: active ? color : 'rgba(255,255,255,0.5)',
                textTransform: 'capitalize',
              }}
            >
              {TYPE_ICONS[t] ? `${TYPE_ICONS[t]} ` : ''}{t === 'all' ? 'All Types' : t}
            </motion.button>
          )
        })}
      </motion.div>

      {/* Predictions list */}
      {filtered.length === 0 ? (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AlertCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No predictions match this filter.</p>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.05 }}
        >
          <AnimatePresence mode="popLayout">
            {filtered.map(pred => (
              <PredCard
                key={pred.id}
                pred={pred}
                expanded={expanded === pred.id}
                onToggle={() => setExpanded(expanded === pred.id ? null : pred.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
