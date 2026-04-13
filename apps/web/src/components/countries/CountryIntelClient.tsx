'use client'

import React, { useMemo, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, Users, AlertTriangle, BarChart3, Shield, Globe,
  Zap, Award, Target, MapPin, ChevronRight, ArrowRight, Gauge, Activity
} from 'lucide-react'

/* ============================================================================ */
/*  Types                                                                     */
/* ============================================================================ */
interface CountryBrief {
  country_code: string
  country_name: string
  flag_emoji: string
  region: string
  risk_level: number
  risk_label: string
  travel_advisory: {
    level: number
    label: string
    description: string
  }
  risk_breakdown: {
    category: string
    score: number
  }[]
  active_threats: {
    id: string
    title: string
    severity: string
    date: string
    event_type: string
  }[]
  event_stats: {
    days_7: number
    days_30: number
    days_90: number
    severity_distribution: {
      critical: number
      high: number
      medium: number
      low: number
    }
    top_event_types: {
      type: string
      count: number
    }[]
    casualty_total: number
  }
  trend_analysis: {
    direction: string
    percentage_change: number
    interpretation: string
  }
  key_actors: {
    id: string
    name: string
    event_count: number
    threat_level: string
  }[]
  neighboring_countries: {
    code: string
    name: string
    risk_level: number
  }[]
}

interface RiskScoreExplainer {
  indicators: {
    id: string
    name: string
    icon: string
    score: number
    reasoning: string
    trend: string
  }[]
}

interface StrategicContext {
  country_code: string
  phase: 'escalation' | 'peak' | 'de-escalation' | 'dormant'
  long_term_trend: {
    slope: number
    direction: 'escalating' | 'stable' | 'de-escalating'
    confidence: number
    event_count_90d: number
    severity_trend_90d: number
    casualty_trend_90d: number
  }
  cyclical_context: {
    is_seasonal: boolean
    deviation_from_cycle: number
    historical_pattern: string
    quarter_comparison: {
      current_30d: number
      prior_year_same_period: number
      difference_pct: number
    }
  }
  active_precursors: {
    type: string
    detected_at: string
    expected_follow_on: string
    timeline_days: number
    confidence: number
  }[]
  strategic_risk_level: number
  forecast_note: string
}

interface ClientProps {
  countryCode: string
  countryData?: CountryBrief
  riskScores?: RiskScoreExplainer | null
}

/* ============================================================================ */
/*  Constants                                                                 */
/* ============================================================================ */
const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

const RISK_COLORS = {
  critical: { bg: '#ef4444', light: 'rgba(239, 68, 68, 0.1)', text: '#fca5a5' },
  high: { bg: '#f97316', light: 'rgba(249, 115, 22, 0.1)', text: '#fed7aa' },
  medium: { bg: '#eab308', light: 'rgba(234, 179, 8, 0.1)', text: '#fde047' },
  low: { bg: '#22c55e', light: 'rgba(34, 197, 94, 0.1)', text: '#86efac' },
}

const ADVISORY_LEVELS = {
  1: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'Safe' },
  2: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', label: 'Caution' },
  3: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', label: 'Reconsider' },
  4: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'Do Not Travel' },
}

const SPRING_CONFIG = { type: 'spring' as const, stiffness: 400, damping: 30 }

const GLASS_STYLE = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
  borderColor: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(10px)',
}

/* ============================================================================ */
/*  Animated Counter Component                                                */
/* ============================================================================ */
function AnimatedCounter({ value, duration = 1 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const increment = value / (duration * 60)
    const timer = setInterval(() => {
      start += increment
      if (start >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 1000 / 60)
    return () => clearInterval(timer)
  }, [value, duration])

  return <span className="font-mono font-bold">{count}</span>
}

/* ============================================================================ */
/*  Radar Chart Component                                                      */
/* ============================================================================ */
function RiskRadarChart({ data }: { data: { category: string; score: number }[] }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  if (!data || data.length === 0) return null

  const numAxes = data.length
  const maxScore = 100
  const radius = 150
  const angleSlice = (Math.PI * 2) / numAxes

  // Generate axes
  const axes = data.map((d, i) => {
    const angle = angleSlice * i - Math.PI / 2
    const x1 = 200 + radius * Math.cos(angle)
    const y1 = 200 + radius * Math.sin(angle)
    return { angle, x: x1, y: y1, ...d }
  })

  // Generate polygon points
  const polygonPoints = axes
    .map((axis) => {
      const value = axis.score
      const r = (value / maxScore) * radius
      const x = 200 + r * Math.cos(axis.angle)
      const y = 200 + r * Math.sin(axis.angle)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl border overflow-hidden p-8"
      style={GLASS_STYLE}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.6, ...SPRING_CONFIG }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

      <h3 className="font-bold text-lg mb-6 flex items-center gap-3 text-white">
        <Gauge className="w-5 h-5 text-cyan-400" />
        Risk Assessment Radar
      </h3>

      <div className="flex justify-center">
        <svg width="450" height="450" className="drop-shadow-lg">
          <defs>
            <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(34, 197, 94, 0.2)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.2)" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background circles */}
          {[20, 40, 60, 80, 100].map((pct) => {
            const r = (pct / 100) * radius
            return (
              <circle
                key={`circle-${pct}`}
                cx="200"
                cy="200"
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            )
          })}

          {/* Axis lines and labels */}
          {axes.map((axis, i) => (
            <g key={`axis-${i}`}>
              <line
                x1="200"
                y1="200"
                x2={axis.x}
                y2={axis.y}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
              <text
                x={axis.x + (axis.x - 200) * 0.15}
                y={axis.y + (axis.y - 200) * 0.15}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs fill-white/50 font-semibold"
              >
                {axis.category.substring(0, 12)}
              </text>
            </g>
          ))}

          {/* Animated polygon */}
          {isInView && (
            <>
              <motion.polygon
                points={polygonPoints}
                fill="url(#radarGradient)"
                fillOpacity="0.6"
                stroke="#22c55e"
                strokeWidth="2"
                filter="url(#glow)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
              <motion.polygon
                points={polygonPoints}
                fill="none"
                stroke="rgba(34, 197, 94, 0.5)"
                strokeWidth="1"
                strokeDasharray="5,5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-8 grid grid-cols-2 gap-4 text-xs">
        {axes.map((axis, i) => (
          <motion.div
            key={`legend-${i}`}
            className="flex items-center justify-between p-2 rounded border border-white/10"
            initial={{ opacity: 0, x: -10 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{ delay: 0.4 + i * 0.05 }}
          >
            <span className="text-white/70">{axis.category}</span>
            <span className="font-mono text-cyan-400 font-bold">{axis.score}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

/* ============================================================================ */
/*  Risk Indicator Cards Component                                             */
/* ============================================================================ */
function RiskIndicatorCards({ indicators }: { indicators: any[] }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  if (!indicators || indicators.length === 0) return null

  return (
    <motion.div
      ref={ref}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ staggerChildren: 0.1 }}
    >
      {indicators.map((indicator, i) => {
        const score = indicator.score || 0
        const isUp = indicator.trend === 'up'
        const color = score >= 70 ? SEVERITY_COLORS.critical : score >= 50 ? SEVERITY_COLORS.high : score >= 30 ? SEVERITY_COLORS.medium : SEVERITY_COLORS.low

        return (
          <motion.div
            key={indicator.id}
            className="rounded-xl border overflow-hidden p-6 group"
            style={GLASS_STYLE}
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: i * 0.1, ...SPRING_CONFIG }}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-semibold text-sm text-white mb-1">{indicator.name}</h4>
                <p className="text-xs text-white/40">{indicator.id}</p>
              </div>
              <motion.div
                className="text-xl"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}
              >
                {indicator.icon}
              </motion.div>
            </div>

            {/* Score with circular progress */}
            <div className="flex items-center gap-4 mb-4">
              <svg width="80" height="80" className="transform -rotate-90">
                <circle cx="40" cy="40" r="35" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <motion.circle
                  cx="40"
                  cy="40"
                  r="35"
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 35}`}
                  strokeDashoffset={`${2 * Math.PI * 35 * (1 - score / 100)}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 35 }}
                  animate={isInView ? { strokeDashoffset: 2 * Math.PI * 35 * (1 - score / 100) } : {}}
                  transition={{ duration: 1.5, delay: i * 0.1 }}
                  filter="drop-shadow(0 0 6px currentColor)"
                />
              </svg>
              <div>
                <motion.div
                  className="text-2xl font-bold font-mono"
                  style={{ color }}
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ delay: i * 0.1 + 0.3 }}
                >
                  <AnimatedCounter value={score} duration={1} />
                </motion.div>
                <p className="text-xs text-white/40">score</p>
              </div>
            </div>

            {/* Trend */}
            <div className="flex items-center gap-2 mb-4">
              {isUp ? (
                <TrendingUp className="w-4 h-4 text-red-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-500" />
              )}
              <span className="text-xs font-semibold" style={{ color: isUp ? '#ef4444' : '#22c55e' }}>
                {isUp ? 'Deteriorating' : 'Improving'}
              </span>
            </div>

            {/* Reasoning */}
            <p className="text-xs text-white/60 leading-relaxed border-t border-white/10 pt-3">
              {indicator.reasoning}
            </p>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/* ============================================================================ */
/*  Strategic Assessment Section                                               */
/* ============================================================================ */
function StrategicAssessmentSection({ context }: { context: StrategicContext }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  // Phase configuration
  const phaseConfig = {
    escalation: { color: '#ef4444', icon: TrendingUp, label: 'Escalation', bgColor: 'rgba(239, 68, 68, 0.1)' },
    peak: { color: '#f97316', icon: AlertTriangle, label: 'Peak Activity', bgColor: 'rgba(249, 115, 22, 0.1)' },
    'de-escalation': { color: '#eab308', icon: TrendingDown, label: 'De-escalation', bgColor: 'rgba(234, 179, 8, 0.1)' },
    dormant: { color: '#22c55e', icon: Activity, label: 'Dormant', bgColor: 'rgba(34, 197, 94, 0.1)' },
  }

  const phase = phaseConfig[context.phase as keyof typeof phaseConfig] || phaseConfig.dormant
  const PhaseIcon = phase.icon

  // Determine precursor urgency colors
  const getPrecursorColor = (timelineDays: number, confidence: number) => {
    if (timelineDays <= 7 && confidence > 0.7) return { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', label: 'Imminent' }
    if (timelineDays <= 21 && confidence > 0.6) return { bg: 'rgba(249, 115, 22, 0.1)', border: '#f97316', label: 'Near-term' }
    return { bg: 'rgba(234, 179, 8, 0.1)', border: '#eab308', label: 'Watch' }
  }

  return (
    <motion.div
      ref={ref}
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ staggerChildren: 0.1 }}
    >
      <h2 className="text-2xl font-bold text-white flex items-center gap-3">
        <Shield className="w-6 h-6 text-purple-400" />
        Strategic Assessment
      </h2>

      {/* Conflict Phase Badge */}
      <motion.div
        className="rounded-2xl border overflow-hidden p-8"
        style={GLASS_STYLE}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, ...SPRING_CONFIG }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent" />

        <h3 className="text-lg font-bold text-white mb-6">Current Phase</h3>

        <motion.div
          className="flex items-center gap-6 p-6 rounded-xl"
          style={{ backgroundColor: phase.bgColor, borderLeft: `4px solid ${phase.color}` }}
          initial={{ scale: 0.95 }}
          animate={isInView ? { scale: 1 } : { scale: 0.95 }}
          transition={{ ...SPRING_CONFIG }}
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ color: phase.color }}
          >
            <PhaseIcon className="w-10 h-10" />
          </motion.div>
          <div>
            <motion.p className="text-3xl font-bold" style={{ color: phase.color }}>
              {phase.label}
            </motion.p>
            <p className="text-sm text-white/60 mt-1">Conflict trajectory analysis</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Long-Term Trend */}
      <motion.div
        className="rounded-2xl border overflow-hidden p-8"
        style={GLASS_STYLE}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.1, ...SPRING_CONFIG }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

        <h3 className="text-lg font-bold text-white mb-6">90-Day Trend Analysis</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Trend Direction */}
          <motion.div
            className="p-5 rounded-lg border"
            style={{ borderColor: phase.color + '40' }}
            initial={{ opacity: 0, x: -10 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-xs text-white/60 mb-3 font-semibold">Direction</p>
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ y: context.long_term_trend.slope > 0 ? -3 : 3 }}
                transition={{ repeat: Infinity, duration: 1.5, type: 'spring' as const }}
                style={{ color: phase.color }}
              >
                {context.long_term_trend.direction === 'escalating' ? (
                  <TrendingUp className="w-6 h-6" />
                ) : context.long_term_trend.direction === 'de-escalating' ? (
                  <TrendingDown className="w-6 h-6" />
                ) : (
                  <Activity className="w-6 h-6" />
                )}
              </motion.div>
              <motion.p
                className="text-2xl font-bold capitalize"
                style={{ color: phase.color }}
              >
                {context.long_term_trend.direction}
              </motion.p>
            </div>
            <p className="text-xs text-white/50">Slope: {context.long_term_trend.slope.toFixed(3)}</p>
          </motion.div>

          {/* Confidence & Events */}
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, x: 10 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
            transition={{ delay: 0.1 }}
          >
            <div className="p-5 rounded-lg border border-cyan-400/40">
              <p className="text-xs text-white/60 mb-3 font-semibold">Confidence (R²)</p>
              <div className="flex items-end gap-3">
                <motion.p className="text-3xl font-bold text-cyan-400">
                  {(context.long_term_trend.confidence * 100).toFixed(0)}%
                </motion.p>
                <motion.div
                  className="flex-1 h-8 bg-white/5 rounded-lg overflow-hidden"
                  initial={{ width: 0 }}
                  animate={isInView ? { width: '100%' } : { width: 0 }}
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                    initial={{ width: 0 }}
                    animate={isInView ? { width: `${context.long_term_trend.confidence * 100}%` } : { width: 0 }}
                    transition={{ duration: 1.5, delay: 0.2 }}
                  />
                </motion.div>
              </div>
              <p className="text-xs text-white/50 mt-2">Trend fit quality</p>
            </div>

            <div className="p-5 rounded-lg border border-yellow-400/40">
              <p className="text-xs text-white/60 mb-2 font-semibold">90-Day Event Count</p>
              <motion.p className="text-2xl font-bold text-yellow-400 font-mono">
                <AnimatedCounter value={context.long_term_trend.event_count_90d} />
              </motion.p>
            </div>
          </motion.div>
        </div>

        {/* Simple line visualization */}
        <motion.div
          className="mt-6 p-4 bg-white/5 rounded-lg overflow-hidden"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.2 }}
        >
          <svg width="100%" height="80" viewBox="0 0 300 60">
            <line x1="0" y1="55" x2="300" y2="55" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
            <polyline
              points="0,50 10,48 20,45 30,40 40,35 50,28 60,20 70,15 80,12 90,10 100,15 110,20 120,28 130,35 140,42 150,48 160,50 170,48 180,45 190,40 200,35 210,30 220,28 230,25 240,20 250,18 260,15 270,12 280,10 290,8 300,5"
              fill="none"
              stroke={phase.color}
              strokeWidth="2"
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* Cyclical Context */}
      {context.cyclical_context.is_seasonal && (
        <motion.div
          className="rounded-2xl border overflow-hidden p-8"
          style={GLASS_STYLE}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.2, ...SPRING_CONFIG }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <Globe className="w-5 h-5 text-amber-400" />
            Seasonal Context
          </h3>

          <motion.div
            className="p-4 rounded-lg border border-amber-400/40 bg-amber-400/5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ ...SPRING_CONFIG }}
          >
            <p className="text-sm text-white font-semibold mb-2">
              Activity is <span style={{ color: context.cyclical_context.deviation_from_cycle > 0 ? '#f97316' : '#22c55e' }} className="font-bold">
                {Math.abs(context.cyclical_context.deviation_from_cycle).toFixed(0)}%
              </span> {context.cyclical_context.deviation_from_cycle > 0 ? 'above' : 'below'} historical seasonal average
            </p>
            <p className="text-xs text-white/60">
              Pattern: {context.cyclical_context.historical_pattern.replace(/_/g, ' ')}
            </p>
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-white/50">Current (30d)</p>
                  <p className="font-bold text-white">{context.cyclical_context.quarter_comparison.current_30d}</p>
                </div>
                <div>
                  <p className="text-white/50">Prior Year (30d)</p>
                  <p className="font-bold text-white">{context.cyclical_context.quarter_comparison.prior_year_same_period}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Active Precursors */}
      {context.active_precursors.length > 0 && (
        <motion.div
          className="rounded-2xl border overflow-hidden p-8"
          style={GLASS_STYLE}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6, delay: 0.3, ...SPRING_CONFIG }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />

          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Active Precursors (Most Critical)
          </h3>

          <div className="space-y-3">
            {context.active_precursors.map((precursor, i) => {
              const urgency = getPrecursorColor(precursor.timeline_days, precursor.confidence)

              return (
                <motion.div
                  key={`${precursor.type}-${i}`}
                  className="p-5 rounded-lg border"
                  style={{ backgroundColor: urgency.bg, borderColor: urgency.border + '60' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                  transition={{ delay: 0.3 + i * 0.08, ...SPRING_CONFIG }}
                  whileHover={{ scale: 1.01, x: 2 }}
                >
                  <div className="flex items-start gap-4">
                    <motion.div
                      className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                      style={{ backgroundColor: urgency.border }}
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="font-semibold text-white capitalize text-sm">
                          {precursor.type.replace(/_/g, ' ')}
                        </p>
                        <motion.span
                          className="text-xs font-bold px-2 py-1 rounded whitespace-nowrap"
                          style={{ backgroundColor: urgency.border + '20', color: urgency.border }}
                        >
                          {urgency.label}
                        </motion.span>
                      </div>

                      <p className="text-xs text-white/70 mb-2">
                        Expected follow-on: <span className="font-semibold">{precursor.expected_follow_on}</span>
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-white/60 gap-2">
                        <div>Confidence: <span className="font-bold text-white">{(precursor.confidence * 100).toFixed(0)}%</span></div>
                        <div>Timeline: <span className="font-bold text-white">{precursor.timeline_days} days</span></div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Strategic Risk Score */}
      <motion.div
        className="rounded-2xl border overflow-hidden p-8"
        style={GLASS_STYLE}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: context.active_precursors.length > 0 ? 0.4 : 0.3, ...SPRING_CONFIG }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-400/30 to-transparent" />

        <h3 className="text-lg font-bold text-white mb-6">Strategic Risk Score</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Circular gauge */}
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: 0.2, ...SPRING_CONFIG }}
          >
            <svg width="180" height="180" className="transform -rotate-90">
              <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <motion.circle
                cx="90"
                cy="90"
                r="80"
                fill="none"
                stroke={context.strategic_risk_level > 75 ? '#ef4444' : context.strategic_risk_level > 50 ? '#f97316' : '#eab308'}
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 80}`}
                strokeDashoffset={`${2 * Math.PI * 80 * (1 - context.strategic_risk_level / 100)}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 80 }}
                animate={isInView ? { strokeDashoffset: 2 * Math.PI * 80 * (1 - context.strategic_risk_level / 100) } : {}}
                transition={{ duration: 1.5, delay: 0.3 }}
                strokeLinecap="round"
                filter="drop-shadow(0 0 8px currentColor)"
              />
              <text
                x="90"
                y="95"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-2xl font-bold fill-white"
              >
                <tspan x="90" dy="0">
                  <motion.tspan
                    initial={{ opacity: 0 }}
                    animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <AnimatedCounter value={context.strategic_risk_level} />
                  </motion.tspan>
                </tspan>
                <tspan x="90" dy="16" className="text-xs fill-white/60">
                  / 100
                </tspan>
              </text>
            </svg>
          </motion.div>

          {/* Forecast Note */}
          <motion.div
            className="flex flex-col justify-center"
            initial={{ opacity: 0, x: 10 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 10 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-xs text-white/60 mb-3 font-semibold">Forecast Assessment</p>
            <motion.p className="text-sm leading-relaxed text-white/80 p-4 rounded-lg border border-white/10">
              {context.forecast_note}
            </motion.p>
            <p className="text-xs text-white/40 mt-4">
              Assessment generated from 90-day trend analysis, cyclical patterns, and precursor detection
            </p>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ============================================================================ */
/*  Event Statistics Panel                                                     */
/* ============================================================================ */
function EventStatisticsPanel({ stats }: { stats: any }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const topTypes = stats.top_event_types || []
  const severityDist = stats.severity_distribution || {}
  const total = Object.values(severityDist).reduce((a: number, b: any) => a + (b as number), 0) || 1

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl border overflow-hidden p-8 space-y-6"
      style={GLASS_STYLE}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ...SPRING_CONFIG }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />

      <h3 className="font-bold text-lg flex items-center gap-3 text-white">
        <BarChart3 className="w-5 h-5 text-yellow-400" />
        Event Statistics
      </h3>

      {/* Time period counters */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '7 Days', value: stats.days_7, delay: 0 },
          { label: '30 Days', value: stats.days_30, delay: 0.1 },
          { label: '90 Days', value: stats.days_90, delay: 0.2 },
        ].map((period, i) => (
          <motion.div
            key={period.label}
            className="text-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
            transition={{ delay: period.delay, ...SPRING_CONFIG }}
          >
            <motion.div className="text-2xl font-bold text-cyan-400 font-mono mb-1">
              <AnimatedCounter value={period.value} />
            </motion.div>
            <p className="text-xs text-white/50">{period.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Severity distribution bar */}
      <div className="space-y-2">
        <p className="text-xs text-white/60 font-semibold">Severity Distribution</p>
        <div className="flex gap-1 h-8 rounded-lg overflow-hidden bg-white/5">
          {[
            { key: 'critical', color: SEVERITY_COLORS.critical, pct: (severityDist.critical || 0) / total },
            { key: 'high', color: SEVERITY_COLORS.high, pct: (severityDist.high || 0) / total },
            { key: 'medium', color: SEVERITY_COLORS.medium, pct: (severityDist.medium || 0) / total },
            { key: 'low', color: SEVERITY_COLORS.low, pct: (severityDist.low || 0) / total },
          ].map((seg, i) => (
            <motion.div
              key={seg.key}
              style={{ width: `${seg.pct * 100}%`, backgroundColor: seg.color }}
              initial={{ width: 0 }}
              animate={isInView ? { width: `${seg.pct * 100}%` } : { width: 0 }}
              transition={{ duration: 1, delay: i * 0.15 }}
              title={`${seg.key}: ${((seg.pct * 100).toFixed(1))}%`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-white/40">
          <span>Critical: {((severityDist.critical || 0 / total) * 100).toFixed(0)}%</span>
          <span>High: {((severityDist.high || 0 / total) * 100).toFixed(0)}%</span>
          <span>Medium: {((severityDist.medium || 0 / total) * 100).toFixed(0)}%</span>
          <span>Low: {((severityDist.low || 0 / total) * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Top event types */}
      {topTypes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/60 font-semibold">Top Event Types</p>
          <div className="space-y-2">
            {topTypes.slice(0, 5).map((type: any, i: number) => {
              const maxCount = Math.max(...topTypes.map((t: any) => t.count))
              const pct = (type.count / maxCount) * 100

              return (
                <motion.div
                  key={type.type}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-xs text-white/70 flex-1">{type.type}</span>
                    <span className="text-xs font-mono text-white/40">{type.count}</span>
                  </div>
                  <motion.div
                    className="h-2 bg-white/5 rounded-full overflow-hidden"
                    initial={{ width: 0 }}
                    animate={isInView ? { width: '100%' } : { width: 0 }}
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                      initial={{ width: 0 }}
                      animate={isInView ? { width: `${pct}%` } : { width: 0 }}
                      transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                    />
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Casualties */}
      {stats.casualty_total !== undefined && (
        <motion.div
          className="p-4 rounded-lg border border-red-500/20 bg-red-500/5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-xs text-white/60 mb-1">Total Casualties (estimated)</p>
          <motion.p className="text-2xl font-bold text-red-400 font-mono">
            <AnimatedCounter value={stats.casualty_total} />
          </motion.p>
          <p className="text-[10px] text-white/40 mt-2">
            Based on reported incident data. Actual numbers may vary.
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

/* ============================================================================ */
/*  Active Threats Section                                                     */
/* ============================================================================ */
function ActiveThreatsSection({ threats }: { threats: any[] }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <motion.div
      ref={ref}
      className="space-y-3"
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
    >
      <h3 className="font-bold text-lg flex items-center gap-3 text-white">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        Active Threats
      </h3>

      <div className="space-y-3">
        {threats.slice(0, 5).map((threat, i) => {
          const isExpanded = expanded === threat.id
          const severityColor = SEVERITY_COLORS[threat.severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.medium

          return (
            <motion.button
              key={threat.id}
              onClick={() => setExpanded(isExpanded ? null : threat.id)}
              className="w-full text-left rounded-xl border overflow-hidden"
              style={GLASS_STYLE}
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ delay: i * 0.08, ...SPRING_CONFIG }}
              whileHover={{ scale: 1.01, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-white">{threat.title}</h4>
                    <p className="text-xs text-white/40 mt-1">{new Date(threat.date).toLocaleDateString()}</p>
                  </div>
                  <motion.div
                    className="px-2 py-1 rounded text-xs font-bold uppercase"
                    style={{ backgroundColor: severityColor + '20', color: severityColor, border: `1px solid ${severityColor}30` }}
                  >
                    {threat.severity}
                  </motion.div>
                </div>

                <p className="text-xs text-white/60">{threat.event_type}</p>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pt-3 border-t border-white/10"
                    >
                      <p className="text-sm text-white/70">{threat.summary || 'No additional details available.'}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================================ */
/*  Trend Timeline Component                                                   */
/* ============================================================================ */
function TrendTimeline({ trend }: { trend: any }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const isEscalating = trend.direction === 'escalating'
  const trendColor = isEscalating ? '#ef4444' : trend.direction === 'stable' ? '#eab308' : '#22c55e'
  const TrendIcon = isEscalating ? TrendingUp : trend.direction === 'stable' ? Activity : TrendingDown

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl border overflow-hidden p-8"
      style={GLASS_STYLE}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ...SPRING_CONFIG }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-400/30 to-transparent" />

      <h3 className="font-bold text-lg mb-6 flex items-center gap-3 text-white">
        <TrendIcon className="w-5 h-5" style={{ color: trendColor }} />
        Trend Analysis
      </h3>

      <div className="space-y-4">
        <motion.div
          className="p-4 rounded-lg border"
          style={{ borderColor: trendColor + '40', backgroundColor: trendColor + '10' }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ ...SPRING_CONFIG }}
        >
          <div className="flex items-end justify-between mb-2">
            <span className="text-xs text-white/60 font-semibold">Current Direction</span>
            <motion.span
              className="text-3xl font-bold font-mono"
              style={{ color: trendColor }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {Math.abs(trend.percentage_change).toFixed(1)}%
            </motion.span>
          </div>
          <p className="text-sm font-semibold capitalize" style={{ color: trendColor }}>
            {trend.direction}
          </p>
        </motion.div>

        <motion.p
          className="text-sm text-white/70 leading-relaxed p-4 rounded-lg border border-white/10"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.2 }}
        >
          {trend.interpretation}
        </motion.p>
      </div>
    </motion.div>
  )
}

/* ============================================================================ */
/*  Key Actors Panel                                                           */
/* ============================================================================ */
function KeyActorsPanel({ actors }: { actors: any[] }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  if (!actors || actors.length === 0) return null

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl border overflow-hidden p-8"
      style={GLASS_STYLE}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ...SPRING_CONFIG }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/30 to-transparent" />

      <h3 className="font-bold text-lg mb-6 flex items-center gap-3 text-white">
        <Users className="w-5 h-5 text-orange-400" />
        Key Actors
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actors.slice(0, 6).map((actor, i) => {
          const threatColor = actor.threat_level === 'critical' ? SEVERITY_COLORS.critical : actor.threat_level === 'high' ? SEVERITY_COLORS.high : SEVERITY_COLORS.medium

          return (
            <motion.div
              key={actor.id}
              className="p-4 rounded-lg border"
              style={{ ...GLASS_STYLE, borderColor: threatColor + '40' }}
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
              transition={{ delay: i * 0.08, ...SPRING_CONFIG }}
              whileHover={{ scale: 1.02, x: 2 }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h4 className="font-semibold text-sm text-white flex-1">{actor.name}</h4>
                <motion.span
                  className="px-2 py-1 rounded text-xs font-bold uppercase whitespace-nowrap"
                  style={{ backgroundColor: threatColor + '20', color: threatColor, border: `1px solid ${threatColor}30` }}
                >
                  {actor.threat_level}
                </motion.span>
              </div>
              <p className="text-xs text-white/60">
                <span className="text-white/80 font-semibold">{actor.event_count}</span> events
              </p>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================================ */
/*  Neighboring Countries Component                                            */
/* ============================================================================ */
function NeighboringCountries({ neighbors }: { neighbors: any[] }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  if (!neighbors || neighbors.length === 0) return null

  const getRiskColorForScore = (score: number) => {
    if (score >= 7) return RISK_COLORS.critical
    if (score >= 5) return RISK_COLORS.high
    if (score >= 3) return RISK_COLORS.medium
    return RISK_COLORS.low
  }

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl border overflow-hidden p-8"
      style={GLASS_STYLE}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6, ...SPRING_CONFIG }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent" />

      <h3 className="font-bold text-lg mb-6 flex items-center gap-3 text-white">
        <Globe className="w-5 h-5 text-blue-400" />
        Neighboring Risk Landscape
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {neighbors.map((neighbor, i) => {
          const riskColor = getRiskColorForScore(neighbor.risk_level)

          return (
            <motion.div
              key={neighbor.code}
              className="group cursor-pointer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.06, ...SPRING_CONFIG }}
              whileHover={{ scale: 1.05 }}
            >
              <Link href={`/analysis/countries/${neighbor.code.toLowerCase()}`}>
                <motion.div
                  className="rounded-lg border p-4 text-center transition-all"
                  style={{
                    borderColor: riskColor.bg,
                    backgroundColor: riskColor.light,
                  }}
                  whileHover={{ borderColor: riskColor.bg, opacity: 1 }}
                >
                  <p className="font-semibold text-sm text-white mb-1">{neighbor.name}</p>
                  <motion.p
                    className="text-lg font-bold font-mono"
                    style={{ color: riskColor.bg }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2.5, delay: i * 0.1 }}
                  >
                    {neighbor.risk_level.toFixed(1)}
                  </motion.p>
                  <p className="text-[10px] text-white/50 mt-1">Risk Score</p>
                </motion.div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

/* ============================================================================ */
/*  Travel Advisory Banner                                                     */
/* ============================================================================ */
function TravelAdvisoryBanner({ advisory }: { advisory: any }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const advisoryColor = ADVISORY_LEVELS[advisory.level as keyof typeof ADVISORY_LEVELS]

  return (
    <motion.div
      ref={ref}
      className="rounded-2xl border overflow-hidden p-6"
      style={{
        background: `linear-gradient(135deg, ${advisoryColor.bg} 0%, rgba(255,255,255,0.02) 100%)`,
        borderColor: advisoryColor.color + '40',
      }}
      initial={{ opacity: 0, x: -20 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
      transition={{ duration: 0.6, ...SPRING_CONFIG }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <motion.div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
            style={{ backgroundColor: advisoryColor.color + '20', color: advisoryColor.color }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {advisory.level === 1 ? '✓' : advisory.level === 2 ? '!' : advisory.level === 3 ? '⚠' : '✗'}
          </motion.div>
          <div>
            <h4
              className="font-bold text-lg mb-2"
              style={{ color: advisoryColor.color }}
            >
              {advisoryColor.label}
            </h4>
            <p className="text-sm text-white/70">{advisory.description}</p>
          </div>
        </div>
        <Shield className="w-6 h-6 flex-shrink-0" style={{ color: advisoryColor.color }} />
      </div>
    </motion.div>
  )
}

/* ============================================================================ */
/*  Main Client Component                                                      */
/* ============================================================================ */
/* ============================================================================ */
/*  FLAG emoji lookup                                                        */
/* ============================================================================ */
function countryCodeToFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

/* ============================================================================ */
/*  Transform API responses into component types                             */
/* ============================================================================ */
function transformBriefResponse(raw: Record<string, unknown>, code: string): CountryBrief {
  const d = (raw as { data?: Record<string, unknown> }).data ?? raw
  const profile = (d as Record<string, unknown>).country_profile as Record<string, unknown> | undefined
  const stats = (d as Record<string, unknown>).event_statistics as Record<string, unknown> | undefined
  const trend = (d as Record<string, unknown>).trend_analysis as Record<string, unknown> | undefined
  const rb = (d as Record<string, unknown>).risk_breakdown as Record<string, number> | undefined
  const advisoryLevel = ((d as Record<string, unknown>).travel_advisory_level ?? 1) as number
  const advisoryLabels: Record<number, { label: string; description: string }> = {
    1: { label: 'Exercise Normal Precautions', description: 'Standard safety measures recommended.' },
    2: { label: 'Exercise Increased Caution', description: 'Be aware of heightened risks.' },
    3: { label: 'Reconsider Travel', description: 'Serious risks present. Reconsider travel plans.' },
    4: { label: 'Do Not Travel', description: 'Very high risk. Avoid all travel.' },
  }
  const advisory = advisoryLabels[advisoryLevel] ?? advisoryLabels[1]!

  const riskBreakdown = rb
    ? Object.entries(rb).map(([category, score]) => ({ category, score }))
    : []

  const sevDist = (stats?.severity_distribution ?? { critical: 0, high: 0, medium: 0, low: 0 }) as {
    critical: number; high: number; medium: number; low: number
  }

  const riskLevel = advisoryLevel * 2.5 // map 1-4 to ~2.5-10 scale

  const riskLabels: Record<number, string> = { 1: 'Low', 2: 'Moderate', 3: 'High', 4: 'Critical' }

  return {
    country_code: code,
    country_name: (profile?.name ?? code) as string,
    flag_emoji: countryCodeToFlag(code),
    region: (profile?.region ?? 'Unknown') as string,
    risk_level: riskLevel,
    risk_label: riskLabels[advisoryLevel] ?? 'Unknown',
    travel_advisory: {
      level: advisoryLevel,
      label: advisory.label,
      description: advisory.description,
    },
    risk_breakdown: riskBreakdown,
    active_threats: (((d as Record<string, unknown>).active_threats ?? []) as Record<string, unknown>[]).map(t => ({
      id: (t.id ?? '') as string,
      title: (t.title ?? 'Unknown Event') as string,
      severity: String(t.severity ?? 'unknown'),
      date: (t.occurred_at ?? '') as string,
      event_type: (t.event_type ?? '') as string,
    })),
    event_stats: {
      days_7: (stats?.events_7d ?? 0) as number,
      days_30: (stats?.events_30d ?? 0) as number,
      days_90: (stats?.events_90d ?? 0) as number,
      severity_distribution: sevDist,
      top_event_types: ((stats?.top_event_types ?? []) as { type: string; count: number }[]),
      casualty_total: (stats?.total_casualties_30d ?? 0) as number,
    },
    trend_analysis: {
      direction: (trend?.direction ?? 'stable') as string,
      percentage_change: (trend?.change_percent ?? 0) as number,
      interpretation: (trend?.direction === 'escalating' ? 'Situation is worsening compared to prior period' : trend?.direction === 'de_escalating' ? 'Situation is improving' : 'Situation remains stable') as string,
    },
    key_actors: (((d as Record<string, unknown>).key_actors ?? []) as Record<string, unknown>[]).map(a => ({
      id: (a.actorId ?? '') as string,
      name: (a.actorId ?? 'Unknown') as string,
      event_count: (a.count ?? 0) as number,
      threat_level: 'high',
    })),
    neighboring_countries: (((d as Record<string, unknown>).neighboring_risk ?? []) as Record<string, unknown>[]).map(n => ({
      code: (n.country_code ?? '') as string,
      name: (n.country_name ?? '') as string,
      risk_level: (n.risk_level ?? 0) as number,
    })),
  }
}

function transformRiskScores(raw: Record<string, unknown>): RiskScoreExplainer {
  const d = (raw as { data?: Record<string, unknown> }).data ?? raw
  const indicatorKeys = [
    { key: 'conflict_intensity', icon: '⚔️' },
    { key: 'civilian_impact', icon: '👥' },
    { key: 'geographic_spread', icon: '🌍' },
    { key: 'escalation_trajectory', icon: '📈' },
    { key: 'actor_fragmentation', icon: '🔀' },
    { key: 'international_attention', icon: '📡' },
  ]

  const indicators = indicatorKeys
    .map(({ key, icon }) => {
      const ind = (d as Record<string, unknown>)[key] as Record<string, unknown> | undefined
      if (!ind) return null
      return {
        id: key,
        name: (ind.name ?? key) as string,
        icon,
        score: (ind.score ?? 0) as number,
        reasoning: (ind.reasoning ?? '') as string,
        trend: (ind.trend ?? 'stable') as string,
      }
    })
    .filter(Boolean) as RiskScoreExplainer['indicators']

  return { indicators }
}

export function CountryIntelClient({ countryCode, countryData: initialCountryData, riskScores: initialRiskScores }: ClientProps) {
  const [countryData, setCountryData] = useState<CountryBrief | null>(initialCountryData ?? null)
  const [riskScores, setRiskScores] = useState<RiskScoreExplainer | null>(initialRiskScores ?? null)
  const [loading, setLoading] = useState(!initialCountryData)
  const [error, setError] = useState<string | null>(null)
  const [strategicContext, setStrategicContext] = useState<StrategicContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [earlyWarning, setEarlyWarning] = useState<any | null>(null)
  const [conflictPhase, setConflictPhase] = useState<any | null>(null)
  const [actionBriefs, setActionBriefs] = useState<any | null>(null)

  // Client-side data fetching when no server data is provided
  useEffect(() => {
    if (initialCountryData) return // Already have data from server
    const code = countryCode.toUpperCase()
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/v1/countries/${code}/brief`).then(r => {
        if (!r.ok) throw new Error(`Country not found (${r.status})`)
        return r.json()
      }),
      fetch(`/api/v1/risk-scores/explain?country_code=${code}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/early-warning?country_code=${code}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/v1/conflict-phases?country_code=${code}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/v1/action-briefs?country_code=${code}`).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([briefRaw, riskRaw, warningRaw, phaseRaw, briefsRaw]) => {
        const brief = transformBriefResponse(briefRaw, code)
        setCountryData(brief)
        if (riskRaw?.success) {
          setRiskScores(transformRiskScores(riskRaw))
        }
        if (warningRaw?.success && warningRaw?.data) {
          setEarlyWarning(warningRaw.data)
        }
        if (phaseRaw?.success && phaseRaw?.data) {
          setConflictPhase(phaseRaw.data)
        }
        if (briefsRaw?.success && briefsRaw?.data) {
          setActionBriefs(briefsRaw.data)
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to load country data')
      })
      .finally(() => setLoading(false))
  }, [countryCode, initialCountryData])

  useEffect(() => {
    if (!countryData) return
    // Fetch strategic context
    fetch(`/api/v1/intelligence/strategic-context?country_code=${countryData.country_code}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => {
        if (d.success && d.data) {
          setStrategicContext(d.data)
        }
      })
      .catch(() => { /* strategic context is optional — gracefully degrade */ })
      .finally(() => setContextLoading(false))
  }, [countryData])

  const getRiskColorForScore = (score: number) => {
    if (score >= 8) return RISK_COLORS.critical
    if (score >= 6) return RISK_COLORS.high
    if (score >= 4) return RISK_COLORS.medium
    return RISK_COLORS.low
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-white/60 text-lg">Loading intelligence briefing...</p>
          <p className="text-white/30 text-sm font-mono">{countryCode}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !countryData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Intelligence Unavailable</h2>
          <p className="text-white/60">{error || `No intelligence data available for ${countryCode}.`}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-colors text-sm"
          >
            ← Back to Overview
          </Link>
        </div>
      </div>
    )
  }

  const riskColor = getRiskColorForScore(countryData.risk_level)

  return (
    <motion.div
      className="min-h-screen p-8 space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ...SPRING_CONFIG }}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl">{countryData.flag_emoji}</span>
              <div>
                <h1 className="text-5xl font-bold text-white">{countryData.country_name}</h1>
                <p className="text-sm text-white/60 mt-2">{countryData.region}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <motion.div
                className="px-4 py-2 rounded-full font-bold text-lg font-mono"
                style={{
                  backgroundColor: riskColor.light,
                  color: riskColor.text,
                  border: `2px solid ${riskColor.bg}`,
                }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2.5 }}
              >
                {countryData.risk_level.toFixed(1)} / 10
              </motion.div>
              <motion.span
                className="text-sm font-semibold uppercase tracking-wide px-3 py-1 rounded-full"
                style={{
                  backgroundColor: riskColor.light,
                  color: riskColor.text,
                }}
              >
                {countryData.risk_label}
              </motion.span>
            </div>
          </div>

          {/* Travel Advisory Pill */}
          <motion.div
            className="text-right"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-xs text-white/50 mb-3 font-semibold">Travel Advisory</p>
            <motion.div
              className="inline-block px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-wider border-2"
              style={{
                backgroundColor: ADVISORY_LEVELS[countryData.travel_advisory.level as keyof typeof ADVISORY_LEVELS].bg,
                borderColor: ADVISORY_LEVELS[countryData.travel_advisory.level as keyof typeof ADVISORY_LEVELS].color,
                color: ADVISORY_LEVELS[countryData.travel_advisory.level as keyof typeof ADVISORY_LEVELS].color,
              }}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              Level {countryData.travel_advisory.level}
            </motion.div>
          </motion.div>
        </div>
      </motion.div>

      {/* Travel Advisory Banner */}
      <TravelAdvisoryBanner advisory={countryData.travel_advisory} />

      {/* Risk Radar Chart - Hero Visual */}
      {countryData.risk_breakdown.length > 0 && (
        <RiskRadarChart data={countryData.risk_breakdown} />
      )}

      {/* Strategic Assessment Section */}
      {!contextLoading && strategicContext && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <StrategicAssessmentSection context={strategicContext} />
        </motion.div>
      )}

      {/* 6-Indicator Risk Cards */}
      {riskScores && riskScores.indicators && riskScores.indicators.length > 0 && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="w-6 h-6 text-cyan-400" />
            Explainable Risk Indicators
          </h2>
          <RiskIndicatorCards indicators={riskScores.indicators} />
        </motion.div>
      )}

      {/* Event Statistics Panel */}
      {countryData.event_stats && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <EventStatisticsPanel stats={countryData.event_stats} />
        </motion.div>
      )}

      {/* Active Threats & Trend in grid */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <ActiveThreatsSection threats={countryData.active_threats} />
        {countryData.trend_analysis && <TrendTimeline trend={countryData.trend_analysis} />}
      </motion.div>

      {/* Key Actors & Neighboring Countries */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <KeyActorsPanel actors={countryData.key_actors} />
        <NeighboringCountries neighbors={countryData.neighboring_countries} />
      </motion.div>

      {/* Early Warning Assessment Section */}
      {earlyWarning ? (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            Early Warning Assessment
          </h2>
          <div className="space-y-6">
            {/* Warning Level Badge */}
            <div className="flex items-center justify-center gap-6">
              <motion.div
                className="relative w-32 h-32 rounded-full flex items-center justify-center font-bold text-5xl"
                style={{
                  backgroundColor:
                    earlyWarning.warning_level >= 5
                      ? '#ef4444'
                      : earlyWarning.warning_level >= 4
                        ? '#f97316'
                        : earlyWarning.warning_level >= 3
                          ? '#eab308'
                          : '#22c55e',
                  boxShadow: `0 0 20px ${
                    earlyWarning.warning_level >= 5
                      ? 'rgba(239, 68, 68, 0.5)'
                      : earlyWarning.warning_level >= 4
                        ? 'rgba(249, 115, 22, 0.5)'
                        : earlyWarning.warning_level >= 3
                          ? 'rgba(234, 179, 8, 0.5)'
                          : 'rgba(34, 197, 94, 0.5)'
                  }`,
                }}
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {earlyWarning.warning_level}
              </motion.div>
              <div className="flex-1 space-y-2">
                <p className="text-white/80 text-sm">Current Level</p>
                <p className="text-white text-xl font-semibold">{earlyWarning.warning_label}</p>
                <p className="text-white/60 text-sm">
                  Trajectory: <span className="text-white font-semibold capitalize">
                    {earlyWarning.trajectory?.direction || 'N/A'}
                  </span>
                </p>
                {earlyWarning.time_to_crisis && (
                  <p className="text-orange-400 text-sm">
                    Est. {earlyWarning.time_to_crisis.estimated_hours}h to crisis
                  </p>
                )}
              </div>
            </div>

            {/* Threat Scores Grid */}
            {earlyWarning.threat_scores && Object.keys(earlyWarning.threat_scores).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(earlyWarning.threat_scores).map(([threat, score]) => (
                  <motion.div
                    key={threat}
                    className="p-3 rounded-lg border border-white/10 bg-white/[0.02]"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-xs font-semibold text-white/70 mb-2 capitalize">
                      {threat.replace(/_/g, ' ')}
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: (score as number) >= 75 ? '#ef4444' : (score as number) >= 50 ? '#f97316' : '#22c55e',
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ delay: 0.1, duration: 0.8 }}
                      />
                    </div>
                    <div className="text-xs text-white/60 mt-1">{Math.round(score as number)}%</div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="p-6 rounded-xl bg-white/[0.02] border border-white/10 text-center text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Early warning data unavailable
        </motion.div>
      )}

      {/* Conflict Phase Section */}
      {conflictPhase ? (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
        >
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            Conflict Phase Lifecycle
          </h2>
          <div className="space-y-6">
            {/* Phase Timeline */}
            <div className="p-6 bg-white/[0.02] border border-white/10 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-8">
                {['DORMANT', 'EMERGING', 'ESCALATION', 'CRISIS', 'DE-ESCALATION'].map((phase, idx) => {
                  const isActive = conflictPhase.currentPhase === phase
                  return (
                    <motion.div
                      key={phase}
                      className="flex flex-col items-center flex-1"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx }}
                    >
                      <motion.div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs mb-2 border-2 ${
                          isActive
                            ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300'
                            : 'border-white/20 bg-white/5 text-white/50'
                        }`}
                        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
                      >
                        {idx + 1}
                      </motion.div>
                      <p className="text-xs font-semibold text-center text-white/70">{phase}</p>
                    </motion.div>
                  )
                })}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-white/60">
                  <span>Phase Duration:</span>
                  <span className="text-white">
                    {conflictPhase.phaseDuration?.days || 'N/A'} days
                    {conflictPhase.phaseDuration?.since && ` (since ${conflictPhase.phaseDuration.since})`}
                  </span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Velocity:</span>
                  <span className="text-white font-semibold capitalize">
                    {conflictPhase.velocity?.classification || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Confidence:</span>
                  <span className="text-white">{Math.round((conflictPhase.confidence || 0) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Transition Probabilities */}
            {conflictPhase.transitionProbabilities && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Next 7d', value: conflictPhase.transitionProbabilities.next7d },
                  { label: 'Next 14d', value: conflictPhase.transitionProbabilities.next14d },
                  { label: 'Next 30d', value: conflictPhase.transitionProbabilities.next30d },
                ].map(({ label, value }) => (
                  <motion.div
                    key={label}
                    className="p-4 bg-white/[0.02] border border-white/10 rounded-lg"
                    whileHover={{ scale: 1.05 }}
                  >
                    <div className="text-xs text-white/50 mb-2">{label}</div>
                    <div className="text-lg font-bold text-cyan-400">{Math.round((value || 0) * 100)}%</div>
                    <div className="text-xs text-white/40">of phase change</div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="p-6 rounded-xl bg-white/[0.02] border border-white/10 text-center text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
        >
          Conflict phase data unavailable
        </motion.div>
      )}

      {/* Action Briefs Section */}
      {actionBriefs && actionBriefs.actions && actionBriefs.actions.length > 0 ? (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target className="w-6 h-6 text-green-400" />
            Prescriptive Action Recommendations
          </h2>
          <div className="space-y-4">
            {/* Organize actions by timeframe */}
            {['Immediate', 'Short-term', 'Medium-term'].map(timeframe => {
              const timeframeActions = actionBriefs.actions.filter(
                (a: any) => a.timeframe?.toLowerCase() === timeframe.toLowerCase()
              )
              return timeframeActions.length > 0 ? (
                <motion.div
                  key={timeframe}
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide px-1">
                    {timeframe}
                  </h3>
                  {timeframeActions.map((action: any) => (
                    <motion.div
                      key={action.id}
                      className="p-4 bg-white/[0.02] border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                      whileHover={{ x: 4 }}
                    >
                      <div className="flex gap-3 mb-2">
                        <motion.span
                          className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${
                            action.priority === 'critical'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : action.priority === 'high'
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                : action.priority === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                  : 'bg-green-500/20 text-green-300 border border-green-500/30'
                          }`}
                        >
                          {action.priority}
                        </motion.span>
                      </div>
                      <p className="text-white/80 text-sm mb-2">{action.description}</p>
                      {action.personas && action.personas.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {action.personas.map((persona: string) => (
                            <span
                              key={persona}
                              className="text-xs px-2 py-1 rounded bg-white/5 text-white/60 border border-white/10"
                            >
                              {persona}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              ) : null
            })}

            {/* Monitoring Priorities */}
            {actionBriefs.monitoringPriorities && actionBriefs.monitoringPriorities.length > 0 && (
              <motion.div
                className="mt-6 p-4 bg-white/[0.02] border border-white/10 rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">Monitor</h3>
                <ul className="space-y-2">
                  {actionBriefs.monitoringPriorities.map((item: any, idx: number) => (
                    <li key={idx} className="text-sm text-white/60 flex gap-2">
                      <span className="text-cyan-400">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="p-6 rounded-xl bg-white/[0.02] border border-white/10 text-center text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          Action briefs data unavailable
        </motion.div>
      )}

      {/* Footer */}
      <motion.div
        className="text-center text-xs text-white/40 py-8 border-t border-white/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p>Data updated regularly. For critical decisions, verify with official sources.</p>
      </motion.div>
    </motion.div>
  )
}
