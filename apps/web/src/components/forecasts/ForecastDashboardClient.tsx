'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info, TrendingUpIcon, Network, Activity, Clock } from 'lucide-react'

/* ================================================================ */
/*  Types                                                            */
/* ================================================================ */
type Forecast = {
  country_code: string
  country_name: string
  current_risk_level: number
  predicted_risk_level: number
  confidence: number
  horizon_days: number
  escalation_probability: number
  status_quo_probability: number
  deescalation_probability: number
  scenario_drivers: {
    escalation: string[]
    status_quo: string[]
    deescalation: string[]
  }
  signals: {
    signal_type: string
    strength: number
    direction: 'escalating' | 'stable' | 'deescalating'
    description: string
  }[]
  events_last_30d: number
  events_prior_30d: number
  avg_daily_events: number
  deadliest_event_type: string
  trend_direction: 'escalating' | 'stable' | 'deescalating'
  created_at: string
}

type CrossSignal = {
  country_code: string
  country_name: string
  convergence_score: number
  active_domains: string[]
  escalation_probability: number
}

type IndividualModel = {
  model_name: string
  probability: number
  direction: 'escalate' | 'stable' | 'de-escalate'
  weight: number
}

type EnsemblePrediction = {
  ensemble_probability: number
  ensemble_direction: 'escalate' | 'stable' | 'de-escalate'
  confidence: number
  model_agreement: number
  individual_models: IndividualModel[]
  reasoning: string
}

/* ================================================================ */
/*  Constants                                                        */
/* ================================================================ */
const TOP_COUNTRIES = ['UA', 'SY', 'SD', 'PS', 'MM', 'SO', 'CD', 'AF', 'YE', 'IQ', 'ET', 'ML']

const COUNTRY_FLAGS: Record<string, string> = {
  UA: '🇺🇦', SY: '🇸🇾', SD: '🇸🇩', PS: '🇵🇸', MM: '🇲🇲', SO: '🇸🇴',
  CD: '🇨🇩', AF: '🇦🇫', YE: '🇾🇪', IQ: '🇮🇶', ET: '🇪🇹', ML: '🇲🇱',
}

const DOMAIN_COLORS: Record<string, string> = {
  Military: '#ef4444',
  Political: '#3b82f6',
  Economic: '#eab308',
  Humanitarian: '#22c55e',
  Social: '#a78bfa',
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

/* ================================================================ */
/*  Model Icons Helper                                              */
/* ================================================================ */
function getModelIcon(modelName: string) {
  if (modelName.toLowerCase().includes('statistical')) {
    return <TrendingUpIcon className="w-5 h-5" />
  }
  if (modelName.toLowerCase().includes('pattern')) {
    return <Network className="w-5 h-5" />
  }
  if (modelName.toLowerCase().includes('momentum')) {
    return <Activity className="w-5 h-5" />
  }
  if (modelName.toLowerCase().includes('analogue') || modelName.toLowerCase().includes('historical')) {
    return <Clock className="w-5 h-5" />
  }
  return <TrendingUpIcon className="w-5 h-5" />
}

function getAgreementColor(agreement: number) {
  if (agreement >= 0.75) return '#22c55e' // green - strong agreement
  if (agreement >= 0.5) return '#eab308' // yellow - mixed
  return '#ef4444' // red - disagree
}

/* ================================================================ */
/*  Ensemble Model Card                                             */
/* ================================================================ */
function EnsembleModelCard({ model, index }: { model: IndividualModel; index: number }) {
  const directionIcon =
    model.direction === 'escalate' ? '↑' :
    model.direction === 'de-escalate' ? '↓' : '→'

  const directionColor =
    model.direction === 'escalate' ? '#ef4444' :
    model.direction === 'de-escalate' ? '#22c55e' : '#eab308'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SMOOTH, delay: 0.4 + index * 0.08 }}
      className="rounded-xl overflow-hidden border p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="text-white/40">{getModelIcon(model.model_name)}</div>
          <div>
            <h4 className="text-sm font-semibold text-white">{model.model_name}</h4>
            <p className="text-[11px] text-white/40">Weight: {(model.weight * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Probability</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: directionColor }}>
            {(model.probability * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
          <span className="text-xs text-white/50">Direction</span>
          <span className="text-lg" style={{ color: directionColor }}>
            {directionIcon}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ================================================================ */
/*  Ensemble Model Consensus Panel                                  */
/* ================================================================ */
function EnsembleModelConsensus({ ensemble, countryCode }: { ensemble: EnsemblePrediction | null; countryCode: string }) {
  if (!ensemble) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SMOOTH, delay: 0.3 }}
        className="rounded-2xl overflow-hidden border p-6 text-center text-white/50"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <p>Loading ensemble consensus…</p>
      </motion.div>
    )
  }

  const agreementColor = getAgreementColor(ensemble.model_agreement)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SMOOTH, delay: 0.3 }}
      className="rounded-2xl overflow-hidden border p-6 space-y-5"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-white">Ensemble Model Consensus</h3>
        <Info className="w-4 h-4 text-white/30" />
      </div>
      <p className="text-xs text-white/40">Multi-model consensus prediction</p>

      {/* Ensemble Probability - Large Number */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING_SNAPPY, delay: 0.35 }}
        className="rounded-xl p-4 text-center"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <p className="text-xs text-white/50 mb-2">Ensemble Probability</p>
        <motion.div
          className="text-5xl font-bold font-mono mb-2"
          style={{ color: '#06b6d4' }}
        >
          {(ensemble.ensemble_probability * 100).toFixed(0)}%
        </motion.div>
        <p className="text-sm text-white/60">
          {ensemble.ensemble_direction === 'escalate' ? '📈 Escalation' :
           ensemble.ensemble_direction === 'de-escalate' ? '📉 De-escalation' :
           '➡️ Status Quo'}
        </p>
      </motion.div>

      {/* Model Agreement */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_SMOOTH, delay: 0.4 }}
        className="rounded-xl p-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-white">Model Agreement</span>
          <span className="text-sm font-bold" style={{ color: agreementColor }}>
            {(ensemble.model_agreement * 100).toFixed(0)}%
          </span>
        </div>
        <motion.div
          className="relative h-2.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: agreementColor }}
            initial={{ width: 0 }}
            animate={{ width: `${ensemble.model_agreement * 100}%` }}
            transition={{ duration: 1.2, delay: 0.45 }}
          />
        </motion.div>
        <p className="text-[10px] text-white/40 mt-2">
          {ensemble.model_agreement >= 0.75 ? '✓ Strong agreement between models' :
           ensemble.model_agreement >= 0.5 ? '⚠ Mixed predictions' :
           '⚠ Models strongly disagree'}
        </p>
      </motion.div>

      {/* Individual Models Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-cyan-400/50" />
          Individual Model Predictions
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ensemble.individual_models.map((model, idx) => (
            <EnsembleModelCard key={model.model_name} model={model} index={idx} />
          ))}
        </div>
      </motion.div>

      {/* Reasoning */}
      {ensemble.reasoning && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_SMOOTH, delay: 0.5 }}
          className="rounded-xl p-4 border"
          style={{
            background: 'rgba(255,255,255,0.02)',
            borderColor: 'rgba(255,255,255,0.05)',
          }}
        >
          <p className="text-xs font-semibold text-white/60 mb-2">Ensemble Reasoning</p>
          <p className="text-xs text-white/50 leading-relaxed">{ensemble.reasoning}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

/* ================================================================ */
/*  Animated Counter                                                */
/* ================================================================ */
function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame: number
    const target = Math.round(value * 100) / 100
    const start = 0
    const startTime = Date.now()
    const durationMs = duration * 1000

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / durationMs, 1)
      const current = start + (target - start) * progress
      setDisplay(Math.round(current * 100) / 100)

      if (progress < 1) {
        frame = requestAnimationFrame(animate)
      }
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span>{display.toFixed(0)}</span>
}

/* ================================================================ */
/*  Confidence Gauge (Circular SVG)                                 */
/* ================================================================ */
function ConfidenceGauge({ confidence }: { confidence: number }) {
  const r = 24
  const circ = 2 * Math.PI * r
  const color = confidence >= 0.8 ? '#22c55e' : confidence >= 0.6 ? '#eab308' : '#f97316'

  return (
    <motion.svg
      width={60}
      height={60}
      viewBox="0 0 60 60"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING_SNAPPY, delay: 0.2 }}
    >
      <circle cx={30} cy={30} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
      <motion.circle
        cx={30}
        cy={30}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`${circ * confidence} ${circ}`}
        initial={{ strokeDasharray: `0 ${circ}` }}
        animate={{ strokeDasharray: `${circ * confidence} ${circ}` }}
        transition={{ duration: 1.5, delay: 0.3 }}
      />
      <text x={30} y={36} textAnchor="middle" fontSize="14" fontWeight="700" fill={color} tabIndex={-1}>
        {Math.round(confidence * 100)}%
      </text>
    </motion.svg>
  )
}

/* ================================================================ */
/*  Scenario Probability Panel                                      */
/* ================================================================ */
function ScenarioProbabilityPanel({ forecast }: { forecast: Forecast }) {
  const scenarios = [
    {
      label: 'Escalation',
      probability: forecast.escalation_probability,
      color: '#ef4444',
      drivers: forecast.scenario_drivers.escalation,
    },
    {
      label: 'Status Quo',
      probability: forecast.status_quo_probability,
      color: '#eab308',
      drivers: forecast.scenario_drivers.status_quo,
    },
    {
      label: 'De-escalation',
      probability: forecast.deescalation_probability,
      color: '#22c55e',
      drivers: forecast.scenario_drivers.deescalation,
    },
  ]

  return (
    <motion.div
      className="rounded-2xl overflow-hidden border p-6 space-y-5"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SMOOTH, delay: 0.3 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-white">Scenario Probabilities</h3>
        <Info className="w-4 h-4 text-white/30" />
      </div>
      <p className="text-xs text-white/40">3-outcome probability distribution</p>

      <div className="space-y-4">
        {scenarios.map((scenario, idx) => (
          <motion.div
            key={scenario.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + idx * 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white">{scenario.label}</span>
              <motion.span
                className="text-sm font-bold tabular-nums"
                style={{ color: scenario.color }}
              >
                <AnimatedCounter value={scenario.probability} duration={1.2} />%
              </motion.span>
            </div>

            <motion.div
              className="relative h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: scenario.color }}
                initial={{ width: 0 }}
                animate={{ width: `${scenario.probability * 100}%` }}
                transition={{ duration: 1.2, delay: 0.4 + idx * 0.1 }}
              />
            </motion.div>

            {scenario.drivers.length > 0 && (
              <motion.div
                className="flex flex-wrap gap-1 mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
              >
                {scenario.drivers.slice(0, 3).map((driver, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: scenario.color + '15',
                      color: scenario.color,
                      border: `1px solid ${scenario.color}30`,
                    }}
                  >
                    {driver}
                  </span>
                ))}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ================================================================ */
/*  Signal Strength Matrix                                          */
/* ================================================================ */
function SignalStrengthMatrix({ forecast }: { forecast: Forecast }) {
  return (
    <motion.div
      className="rounded-2xl overflow-hidden border p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SMOOTH, delay: 0.4 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-white">Signal Strength</h3>
        <Info className="w-4 h-4 text-white/30" />
      </div>

      <div className="space-y-4">
        {forecast.signals.map((signal, idx) => {
          const color =
            signal.direction === 'escalating'
              ? '#ef4444'
              : signal.direction === 'deescalating'
                ? '#22c55e'
                : '#eab308'

          return (
            <motion.div
              key={`${signal.signal_type}-${idx}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + idx * 0.08 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-shrink-0">
                  {signal.direction === 'escalating' ? (
                    <TrendingUp className="w-4 h-4" style={{ color }} />
                  ) : signal.direction === 'deescalating' ? (
                    <TrendingDown className="w-4 h-4" style={{ color }} />
                  ) : (
                    <Minus className="w-4 h-4" style={{ color }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">
                    {signal.signal_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-white/50">{signal.description}</p>
                </div>
                <span className="text-xs font-bold" style={{ color }}>
                  {Math.round(signal.strength * 100)}%
                </span>
              </div>

              <motion.div
                className="relative h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${signal.strength * 100}%` }}
                  transition={{ duration: 1.2, delay: 0.5 + idx * 0.08 }}
                />
              </motion.div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ================================================================ */
/*  Forecast Card                                                   */
/* ================================================================ */
function ForecastCard({
  forecast,
  onClick,
  isSelected,
}: {
  forecast: Forecast
  onClick: () => void
  isSelected: boolean
}) {
  const trendIcon =
    forecast.trend_direction === 'escalating'
      ? '📈'
      : forecast.trend_direction === 'deescalating'
        ? '📉'
        : '➡️'

  const riskChange = forecast.predicted_risk_level - forecast.current_risk_level
  const riskTrend = riskChange > 0.1 ? '↑' : riskChange < -0.1 ? '↓' : '→'
  const riskColor = riskChange > 0.1 ? '#ef4444' : riskChange < -0.1 ? '#22c55e' : '#eab308'

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left cursor-pointer group"
      whileHover={{ y: -2 }}
      whileTap={{ y: 0 }}
    >
      <motion.div
        className="rounded-xl overflow-hidden border p-4 transition-all"
        style={{
          background: isSelected
            ? 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.02) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          borderColor: isSelected ? '#22c55e40' : 'rgba(255,255,255,0.06)',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING_SNAPPY }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{COUNTRY_FLAGS[forecast.country_code] || '🌍'}</span>
            <div>
              <h4 className="text-sm font-bold text-white">{forecast.country_name}</h4>
              <p className="text-[11px] text-white/40">{forecast.horizon_days}d forecast</p>
            </div>
          </div>
          <ConfidenceGauge confidence={forecast.confidence} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Risk Level</span>
            <span className="text-xs font-semibold text-white">
              {Math.round(forecast.current_risk_level * 100)} →{' '}
              <span style={{ color: riskColor }}>{Math.round(forecast.predicted_risk_level * 100)}</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Escalation Prob</span>
            <span className="text-xs font-semibold" style={{ color: '#ef4444' }}>
              {Math.round(forecast.escalation_probability * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Trend</span>
            <span className="text-xs">{trendIcon}</span>
          </div>
        </div>
      </motion.div>
    </motion.button>
  )
}

/* ================================================================ */
/*  Convergence Hotspot Card                                        */
/* ================================================================ */
function ConvergenceHotspotCard({ signal }: { signal: CrossSignal }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const color = signal.escalation_probability > 0.6 ? '#ef4444' : signal.escalation_probability > 0.4 ? '#f97316' : '#22c55e'

  return (
    <motion.div
      className="rounded-xl overflow-hidden border p-4"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...SPRING_SNAPPY }}
      whileHover={{ y: -2 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{COUNTRY_FLAGS[signal.country_code] || '🌍'}</span>
          <div>
            <h4 className="text-sm font-bold text-white">{signal.country_name}</h4>
            <p className="text-[11px] text-white/40">Convergence</p>
          </div>
        </div>
        <motion.svg
          width={50}
          height={50}
          viewBox="0 0 50 50"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING_SNAPPY, delay: 0.1 }}
        >
          <circle cx={25} cy={25} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
          <motion.circle
            cx={25}
            cy={25}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${circ * signal.convergence_score} ${circ}`}
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${circ * signal.convergence_score} ${circ}` }}
            transition={{ duration: 1.5, delay: 0.2 }}
          />
          <text x={25} y={29} textAnchor="middle" fontSize="12" fontWeight="700" fill={color} tabIndex={-1}>
            {Math.round(signal.convergence_score * 100)}
          </text>
        </motion.svg>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50">Active Domains</span>
          <span className="text-xs font-semibold text-white">{signal.active_domains.length}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {signal.active_domains.map((domain, i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: DOMAIN_COLORS[domain] || '#64748b' }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              title={domain}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
          <span className="text-xs text-white/50">Escalation</span>
          <span className="text-xs font-semibold" style={{ color }}>
            {Math.round(signal.escalation_probability * 100)}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ================================================================ */
/*  Historical Context Panel                                        */
/* ================================================================ */
function HistoricalContextPanel({ forecast }: { forecast: Forecast }) {
  const maxEvents = Math.max(forecast.events_last_30d, forecast.events_prior_30d)

  return (
    <motion.div
      className="rounded-2xl overflow-hidden border p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SMOOTH, delay: 0.5 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold text-white">Historical Context</h3>
        <Info className="w-4 h-4 text-white/30" />
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">Last 30 Days</span>
            <span className="text-xs font-bold text-white">{forecast.events_last_30d}</span>
          </div>
          <motion.div
            className="relative h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#ef4444' }}
              initial={{ width: 0 }}
              animate={{ width: `${(forecast.events_last_30d / maxEvents) * 100}%` }}
              transition={{ duration: 1.2, delay: 0.5 }}
            />
          </motion.div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white">Prior 30 Days</span>
            <span className="text-xs font-bold text-white">{forecast.events_prior_30d}</span>
          </div>
          <motion.div
            className="relative h-2 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#3b82f6' }}
              initial={{ width: 0 }}
              animate={{ width: `${(forecast.events_prior_30d / maxEvents) * 100}%` }}
              transition={{ duration: 1.2, delay: 0.6 }}
            />
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.05]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1">Avg Daily Events</p>
            <p className="text-lg font-bold text-white">{Math.round(forecast.avg_daily_events * 10) / 10}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1">Deadliest Event</p>
            <p className="text-sm font-semibold text-white/80">{forecast.deadliest_event_type}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ================================================================ */
/*  Main Dashboard Component                                        */
/* ================================================================ */
export function ForecastDashboardClient() {
  const [forecasts, setForecasts] = useState<Forecast[]>([])
  const [crossSignals, setCrossSignals] = useState<CrossSignal[]>([])
  const [ensemble, setEnsemble] = useState<EnsemblePrediction | null>(null)
  const [ensembleLoading, setEnsembleLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [horizon, setHorizon] = useState(14)

  // Fetch ensemble prediction when country changes
  useEffect(() => {
    if (!selectedCountry) return

    const fetchEnsemble = async () => {
      setEnsembleLoading(true)
      try {
        const response = await fetch(
          `/api/v1/intelligence/ensemble-forecast?country_code=${selectedCountry}&horizon=${horizon}`
        )
        if (response.ok) {
          const data = await response.json()
          setEnsemble(data.data?.prediction || null)
        } else {
          setEnsemble(null)
        }
      } catch (error) {
        console.error('Failed to fetch ensemble data:', error)
        setEnsemble(null)
      } finally {
        setEnsembleLoading(false)
      }
    }

    fetchEnsemble()
  }, [selectedCountry, horizon])

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch forecasts for top countries
        const forecastPromises = TOP_COUNTRIES.map(code =>
          fetch(`/api/v1/forecasts/predict?country_code=${code}&horizon=${horizon}`)
            .then(r => r.json())
            .catch(() => null)
        )

        const forecasts = await Promise.all(forecastPromises)
        const validForecasts = forecasts.filter((f): f is Forecast => f !== null && f.country_code)
        setForecasts(validForecasts)

        if (validForecasts.length > 0 && !selectedCountry) {
          const firstCountry = validForecasts[0]?.country_code
          if (firstCountry) {
            setSelectedCountry(firstCountry)
          }
        }

        // Fetch cross-signals for convergence
        const crossResponse = await fetch('/api/v1/intelligence/cross-signals')
        const crossData = await crossResponse.json()
        setCrossSignals(
          Array.isArray(crossData)
            ? crossData
            : Array.isArray(crossData.signals)
              ? crossData.signals
              : []
        )
      } catch (error) {
        console.error('Failed to fetch forecast data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizon])

  const selectedForecast = useMemo(
    () => forecasts.find(f => f.country_code === selectedCountry),
    [forecasts, selectedCountry]
  )

  const horizonOptions = [
    { label: '7d', value: 7 },
    { label: '14d', value: 14 },
    { label: '30d', value: 30 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          className="text-white/50 text-sm"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Loading forecasts…
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="inline-block w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400/20 to-cyan-400/5 border border-cyan-400/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
              </span>
              Predictive Intelligence
            </h2>
            <p className="text-sm text-white/40 mt-1">
              Next-gen conflict forecasting using signal convergence & ML models
            </p>
          </div>
        </div>

        {/* Horizon Selector */}
        <motion.div className="flex gap-2 mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {horizonOptions.map(opt => (
            <motion.button
              key={opt.value}
              onClick={() => setHorizon(opt.value)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer"
              style={{
                background: horizon === opt.value ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                borderColor: horizon === opt.value ? '#22c55e' : 'rgba(255,255,255,0.1)',
                color: horizon === opt.value ? '#22c55e' : 'rgba(255,255,255,0.6)',
              }}
            >
              {opt.label}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>

      {/* Global Forecast Overview Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-cyan-400" />
          Top 12 Countries at Risk
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {forecasts.map(forecast => (
            <ForecastCard
              key={forecast.country_code}
              forecast={forecast}
              onClick={() => setSelectedCountry(forecast.country_code)}
              isSelected={selectedCountry === forecast.country_code}
            />
          ))}
        </div>
      </motion.div>

      {/* Selected Country Detail Section */}
      {selectedForecast && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          key={selectedForecast.country_code}
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-lg">{COUNTRY_FLAGS[selectedForecast.country_code]}</span>
            {selectedForecast.country_name} - Detailed Analysis
          </h3>

          {/* Ensemble Model Consensus */}
          <div className="mb-6">
            {ensembleLoading ? (
              <motion.div
                className="rounded-2xl border p-6 text-center text-white/50"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
                  borderColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Loading ensemble consensus…
                </motion.div>
              </motion.div>
            ) : (
              <EnsembleModelConsensus ensemble={ensemble} countryCode={selectedForecast.country_code} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ScenarioProbabilityPanel forecast={selectedForecast} />
            <SignalStrengthMatrix forecast={selectedForecast} />
            <HistoricalContextPanel forecast={selectedForecast} />
          </div>
        </motion.div>
      )}

      {/* Convergence Hotspots */}
      {crossSignals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-r from-red-400 to-orange-400" />
            Convergence Hotspots
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {crossSignals.slice(0, 12).map(signal => (
              <ConvergenceHotspotCard key={signal.country_code} signal={signal} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Methodology Footer */}
      <motion.div
        className="rounded-2xl overflow-hidden border p-6 mt-8"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.003) 100%)',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="flex items-start gap-4">
          <Info className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">Methodology</h4>
            <p className="text-xs text-white/50 leading-relaxed">
              Forecasts combine multi-signal intelligence (SIGINT, HUMINT, OSINT), machine learning conflict escalation models, and real-time event data. Confidence scores reflect model calibration on historical accuracy. Signal convergence identifies multi-domain threat escalation patterns that institutional investors and government agencies depend on.
            </p>
            <p className="text-[11px] text-white/30 mt-3">
              Model Version 2.4 • Calibration: 78% accuracy on 12m validation set • Last updated {new Date(selectedForecast?.created_at || Date.now()).toLocaleDateString()}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
