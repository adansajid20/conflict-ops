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

interface ClientProps {
  countryData: CountryBrief
  riskScores: RiskScoreExplainer | null
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
export function CountryIntelClient({ countryData, riskScores }: ClientProps) {
  const getRiskColorForScore = (score: number) => {
    if (score >= 8) return RISK_COLORS.critical
    if (score >= 6) return RISK_COLORS.high
    if (score >= 4) return RISK_COLORS.medium
    return RISK_COLORS.low
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
