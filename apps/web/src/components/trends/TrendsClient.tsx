'use client'

import { useEffect, useState, useRef, useCallback, MouseEvent } from 'react'
import { motion, AnimatePresence, useInView, useSpring, useTransform, useMotionValue, MotionValue } from 'framer-motion'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type DayVolume = { date: string; total: number; critical: number; high: number; medium: number; low: number; fatalities: number }
type CommandStrip = {
  total_events: number; prior_events: number; events_change_pct: number
  total_fatalities: number; prior_fatalities: number; fatalities_change_pct: number
  displacement_events: number; prior_displacement: number; displacement_change_pct: number
  active_conflicts: number; escalation_index: number
  escalation_events: number; prior_escalation_events: number; escalation_change_pct: number
  daily_sparkline: number[]; fatality_sparkline: number[]
}
type EscalationEntry = {
  country_code: string; level: number; label: string
  event_count: number; avg_severity: number; fatality_estimate: number
  daily_counts: { date: string; count: number }[]
  signals: { signal_type: string; confidence: number; basis: string }[]
}
type CasualtyTracker = {
  total_fatalities: number
  by_region: { region: string; count: number }[]
  by_country: { country_code: string; count: number }[]
  by_type: { event_type: string; count: number }[]
  daily_fatalities: { date: string; fatalities: number }[]
  displacement_events: number; humanitarian_events: number
}
type AttackPattern = {
  event_type: string; count: number; critical: number; fatalities: number
  countries_affected: number; prior_count: number; change_pct: number
}
type RegionThreat = {
  region: string; events: number; critical: number; fatalities: number
  escalation_events: number; displacement_events: number
  attack_types: number; countries: number; threat_score: number
}
type ActorEntry = {
  name: string; event_count: number; regions: string[]; countries: string[]
  avg_severity: number; fatalities: number; event_types: string[]
  prior_count: number; trending: number
}
type PredictionPanel = {
  total: number; confirmed: number; denied: number; expired: number; active: number
  accuracy_pct: number | null
  by_type: { type: string; total: number; confirmed: number; active: number; accuracy: number | null }[]
  high_confidence: { id: string; title: string; probability: number; severity_if_true: number; region: string; type: string }[]
  recent: { id: string; title: string; outcome: string | null; probability: number; type: string; created_at: string }[]
}
type ComparativeAnalysis = {
  trend: string; this_week: { total: number; critical: number }; last_week: { total: number; critical: number }
  week_change_pct: number; period_change_pct: number
  anomaly_days: { date: string; count: number; sigma: number }[]
  anomaly_threshold: number; mean_daily: number; stddev_daily: number
  region_comparison: { region: string; current: number; prior: number; change_pct: number }[]
}
type VelocityPanel = {
  hourly_velocity: { hour: string; count: number }[]
  current_rate: number; avg_hourly: number; peak_hourly: number
  anomalies: { hour: string; count: number; sigma: number }[]
  anomaly_threshold: number
}
type TrendsData = {
  days: number; generated_at: string
  command_strip: CommandStrip; daily_volume: DayVolume[]; escalation_timeline: EscalationEntry[]
  casualty_tracker: CasualtyTracker; attack_patterns: AttackPattern[]
  attack_trend_lines: Record<string, { date: string; count: number }[]>
  region_threat_matrix: RegionThreat[]; actor_intel: ActorEntry[]
  prediction_panel: PredictionPanel; comparative_analysis: ComparativeAnalysis
  velocity_panel: VelocityPanel
  forecast_signals: { signal_type: string; country_code: string; confidence: number; conflict_zone: string }[]
  country_risks: { country_code: string; risk_score: number; trend: string; event_count_7d: number; severity_avg: number }[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SEV = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
const SIG_C: Record<string, string> = { ESCALATION_TREND: '#ef4444', DEESCALATION: '#22c55e', NEW_FRONT: '#f97316', CEASEFIRE_RISK: '#3b82f6' }
const ESC_C = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
const ESC_L = ['', 'Stable', 'Tension', 'Crisis', 'Conflict', 'War']
const EV_LABELS: Record<string, string> = {
  armed_conflict: 'Armed Conflict', airstrike: 'Airstrike', terrorism: 'Terrorism', coup: 'Coup',
  civil_unrest: 'Civil Unrest', protest: 'Protest', political_crisis: 'Political Crisis',
  political: 'Political', sanctions: 'Sanctions', ceasefire: 'Ceasefire', diplomacy: 'Diplomacy',
  wmd_threat: 'WMD Threat', humanitarian_crisis: 'Humanitarian Crisis', natural_disaster: 'Natural Disaster',
  security: 'Security', cyber: 'Cyber', displacement: 'Displacement', humanitarian: 'Humanitarian',
  border_incident: 'Border Incident', maritime_incident: 'Maritime Incident',
  aviation_incident: 'Aviation Incident', military: 'Military', mobilization: 'Mobilization',
  explosion: 'Explosion', attack: 'Attack', news: 'News', unknown: 'Unknown',
}

/* spring configs */
const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }
const SPRING_BOUNCY = { type: 'spring' as const, stiffness: 300, damping: 15, mass: 0.5 }

/* ------------------------------------------------------------------ */
/*  Spring-animated number counter                                     */
/* ------------------------------------------------------------------ */
function SpringNumber({ value, decimals = 0, color }: { value: number; decimals?: number; color?: string }) {
  const spring = useSpring(0, { stiffness: 80, damping: 25, mass: 1 })
  const display = useTransform(spring, (v: number) => decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString())
  const [text, setText] = useState(decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString())

  useEffect(() => { spring.set(value) }, [value, spring])
  useEffect(() => {
    const unsub = display.on('change', (v: string) => setText(v))
    return unsub
  }, [display])

  return <span style={color ? { color } : undefined}>{text}</span>
}

/* ------------------------------------------------------------------ */
/*  Animated SVG Sparkline with smooth bezier + glow                   */
/* ------------------------------------------------------------------ */
function AnimatedSparkline({ data, color = '#3b82f6', h = 36, w = 120, filled = true, glow = true }: {
  data: number[]; color?: string; h?: number; w?: number; filled?: boolean; glow?: boolean
}) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  if (data.length < 2) return null
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - ((v - min) / range) * (h - 6) - 3 }))

  // Smooth cubic bezier path
  let d = `M${pts[0]!.x},${pts[0]!.y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!, curr = pts[i]!
    const cpx = (prev.x + curr.x) / 2
    d += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
  }
  const fillPath = d + ` L${w},${h} L0,${h} Z`
  const lastPt = pts[pts.length - 1]!

  return (
    <svg ref={ref} width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        {glow && <filter id={`glow-${color.replace('#', '')}`}><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>}
      </defs>
      {filled && (
        <motion.path d={fillPath} fill={`url(#sg-${color.replace('#', '')})`}
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ duration: 0.8, delay: 0.3 }} />
      )}
      <motion.path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
        filter={glow ? `url(#glow-${color.replace('#', '')})` : undefined}
        initial={{ pathLength: 0, opacity: 0 }} animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }} />
      <motion.circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill={color}
        initial={{ scale: 0, opacity: 0 }} animate={inView ? { scale: [0, 1.4, 1], opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 1.2 }} />
      <motion.circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill={color}
        animate={{ r: [3.5, 7, 3.5], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Scroll-reveal container                                            */
/* ------------------------------------------------------------------ */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ ...SPRING_SMOOTH, delay }}>
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  TiltCard — 3D Parallax Hover (PREMIUM #1)                         */
/* ------------------------------------------------------------------ */
function TiltCard({ children, className = '', delay = 0, glow }: { children: React.ReactNode; className?: string; delay?: number; glow?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotateX = useTransform(y, [-100, 100], [4, -4])
  const rotateY = useTransform(x, [-100, 100], [-4, 4])
  const [gradientPos, setGradientPos] = useState({ x: 50, y: 50 })

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const px = e.clientX - cx
    const py = e.clientY - cy
    x.set(px)
    y.set(py)
    setGradientPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }, [x, y])

  const handleMouseLeave = useCallback(() => {
    x.set(0)
    y.set(0)
    setGradientPos({ x: 50, y: 50 })
  }, [x, y])

  return (
    <Reveal delay={delay} className={className}>
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative rounded-2xl overflow-hidden cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '22px',
          perspective: '800px',
          rotateX,
          rotateY,
        }}
        whileHover={{ y: -2, borderColor: 'rgba(255,255,255,0.12)', transition: { duration: 0.25 } }}>

        {/* top edge highlight */}
        <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.08) 50%, transparent 90%)' }} />

        {/* radial gradient highlight following cursor */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(600px circle at ${gradientPos.x}% ${gradientPos.y}%, rgba(255,255,255,0.08), transparent 80%)`,
          }}
        />

        {/* optional colored glow */}
        {glow && <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-[0.03] pointer-events-none" style={{ background: `radial-gradient(circle, ${glow}, transparent)` }} />}

        <motion.div style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </motion.div>
      </motion.div>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */
/*  InteractiveAreaChart — Stacked Area SVG (PREMIUM #2)              */
/* ------------------------------------------------------------------ */
function InteractiveAreaChart({ data }: { data: DayVolume[] }) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const w = Math.max(data.length * 10, 200)
  const h = 130
  const maxTotal = Math.max(...data.map(d => d.total), 1)
  const px = (i: number) => (i / Math.max(data.length - 1, 1)) * w
  const py = (val: number) => h - (val / maxTotal) * (h - 10)

  const buildPath = (getter: (d: DayVolume) => number, baselineGetter: (d: DayVolume) => number): string => {
    let path = `M${px(0)},${py(baselineGetter(data[0]!))}`
    for (let i = 0; i < data.length; i++) {
      const xp = px(i)
      const yp = py(getter(data[i]!) + baselineGetter(data[i]!))
      path += ` L${xp},${yp}`
    }
    for (let i = data.length - 1; i >= 0; i--) {
      const xp = px(i)
      const yp = py(baselineGetter(data[i]!))
      path += ` L${xp},${yp}`
    }
    return path + ' Z'
  }

  const baseline = (d: DayVolume) => 0
  const lowBaseline = (d: DayVolume) => d.low
  const mediumBaseline = (d: DayVolume) => d.low + d.medium
  const highBaseline = (d: DayVolume) => d.low + d.medium + d.high

  const areas = [
    { path: buildPath(d => d.low, baseline), color: '#22c55e', label: 'Low' },
    { path: buildPath(d => d.medium, lowBaseline), color: '#eab308', label: 'Medium' },
    { path: buildPath(d => d.high, mediumBaseline), color: '#f97316', label: 'High' },
    { path: buildPath(d => d.critical, highBaseline), color: '#ef4444', label: 'Critical' },
  ]

  return (
    <div className="relative">
      <svg ref={ref} width={w + 20} height={h + 40} className="overflow-visible" style={{ maxWidth: '100%', height: 'auto' }}>
        <defs>
          {areas.map((a, i) => (
            <linearGradient key={i} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={a.color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={a.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {areas.map((a, i) => (
          <motion.path
            key={i}
            d={a.path}
            fill={`url(#grad-${i})`}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: i * 0.15 }}
          />
        ))}

        {areas.map((a, i) => (
          <motion.path
            key={`stroke-${i}`}
            d={a.path.replace('Z', '')}
            fill="none"
            stroke={a.color}
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 1.2, delay: i * 0.1 }}
          />
        ))}

        {hoveredIndex !== null && (
          <motion.line
            x1={px(hoveredIndex)}
            y1="0"
            x2={px(hoveredIndex)}
            y2={h}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            strokeDasharray="4,4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        )}

        <rect
          width={w}
          height={h}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const relX = e.clientX - rect.left
            const idx = Math.round((relX / w) * (data.length - 1))
            setHoveredIndex(Math.max(0, Math.min(idx, data.length - 1)))
            setTooltipPos({ x: relX, y: e.clientY - rect.top })
          }}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      </svg>

      {hoveredIndex !== null && data[hoveredIndex] && (
        <motion.div
          className="absolute bg-black/90 text-white text-xs rounded-lg p-3 pointer-events-none z-50"
          style={{
            left: `${(hoveredIndex / Math.max(data.length - 1, 1)) * 100}%`,
            top: '-60px',
            transform: 'translateX(-50%)',
          }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}>
          <div className="font-semibold">{data[hoveredIndex]!.date}</div>
          <div className="text-white/70 text-[11px]">Total: {data[hoveredIndex]!.total}</div>
          <div className="text-red-400/70 text-[11px]">{data[hoveredIndex]!.fatalities} fatalities</div>
          <div className="text-[10px] mt-1 space-y-0.5">
            <div className="text-emerald-400">Low: {data[hoveredIndex]!.low}</div>
            <div className="text-yellow-400">Med: {data[hoveredIndex]!.medium}</div>
            <div className="text-orange-400">High: {data[hoveredIndex]!.high}</div>
            <div className="text-red-400">Crit: {data[hoveredIndex]!.critical}</div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  AnimatedDonut — SVG Circle Segments (PREMIUM #3)                  */
/* ------------------------------------------------------------------ */
function AnimatedDonut({ segments, radius = 60, cx = 70, cy = 70, label = '' }: {
  segments: { value: number; max: number; color: string; label?: string }[]
  radius?: number
  cx?: number
  cy?: number
  label?: string
}) {
  const ref = useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  const circumference = 2 * Math.PI * radius

  let currentOffset = 0
  const normalizedSegments = segments.map(seg => {
    const ratio = seg.value / seg.max
    const length = ratio * circumference
    const offset = currentOffset
    currentOffset += length
    return { ...seg, length, offset }
  })

  const pct = segments.length > 0 ? Math.round((segments[0]!.value / segments[0]!.max) * 100) : 0

  return (
    <svg ref={ref} width={cx * 2} height={cy * 2} viewBox={`0 0 ${cx * 2} ${cy * 2}`} className="overflow-visible">
      {normalizedSegments.map((seg, i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth="12"
          strokeDasharray={seg.length}
          strokeDashoffset={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={inView ? { strokeDashoffset: circumference - seg.length } : {}}
          transition={{ ...SPRING_SMOOTH, delay: i * 0.1 }}
          style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }}
        />
      ))}
      {label && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="text-xs font-bold" fill="rgba(255,255,255,0.7)">
          {label}
        </text>
      )}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  HeatmapGrid — Color-intensity grid (PREMIUM #4)                   */
/* ------------------------------------------------------------------ */
function HeatmapGrid({ rows, metrics }: {
  rows: { label: string; values: number[] }[]
  metrics: { label: string; color: string }[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })

  // Normalize each column to 0-1
  const normalized = rows.map(row => ({
    ...row,
    values: row.values.map((v, colIdx) => {
      const colValues = rows.map(r => r.values[colIdx] ?? 0)
      const max = Math.max(...colValues, 1)
      return max > 0 ? v / max : 0
    }),
  }))

  return (
    <div ref={ref} className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Header */}
        <div className="flex mb-1">
          <div className="w-32 flex-shrink-0 text-[9px] uppercase tracking-[0.15em] text-white/12 font-medium py-2 px-2" />
          {metrics.map((m, i) => (
            <div key={i} className="w-24 flex-shrink-0 text-[9px] uppercase tracking-[0.15em] text-white/12 font-medium py-2 px-2 text-center">
              {m.label}
            </div>
          ))}
        </div>

        {/* Rows */}
        {normalized.map((row, rowIdx) => (
          <motion.div
            key={rowIdx}
            className="flex mb-1 rounded-lg overflow-hidden hover:bg-white/[0.04] transition-colors"
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ ...SPRING_SMOOTH, delay: rowIdx * 0.04 }}>
            <div className="w-32 flex-shrink-0 text-[11px] text-white/50 py-2 px-2 truncate font-medium">
              {row.label}
            </div>
            {row.values.map((normVal, colIdx) => (
              <motion.div
                key={colIdx}
                className="w-24 flex-shrink-0 py-2 px-2 flex items-center justify-center text-[12px] font-semibold text-white/70 rounded-sm relative"
                style={{
                  backgroundColor: `rgba(${
                    metrics[colIdx]!.color === '#3b82f6' ? '59,130,246' :
                    metrics[colIdx]!.color === '#ef4444' ? '239,68,68' :
                    metrics[colIdx]!.color === '#f97316' ? '249,115,22' :
                    metrics[colIdx]!.color === '#eab308' ? '234,179,8' :
                    metrics[colIdx]!.color === '#a78bfa' ? '167,139,250' :
                    '100,116,139'
                  },${0.02 + normVal * 0.58})`,
                }}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: (rowIdx * metrics.length + colIdx) * 0.02 }}>
                {rows[rowIdx]!.values[colIdx]}
              </motion.div>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  LivePulse — Data Freshness Indicator (PREMIUM #5)                 */
/* ------------------------------------------------------------------ */
function LivePulse({ generatedAt }: { generatedAt: string }) {
  const [minAgo, setMinAgo] = useState(0)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const gen = new Date(generatedAt)
      const diff = Math.floor((now.getTime() - gen.getTime()) / 60000)
      setMinAgo(Math.max(0, diff))
    }
    updateTime()
    const iv = setInterval(updateTime, 30000)
    return () => clearInterval(iv)
  }, [generatedAt])

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-2 h-2">
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-400"
          animate={{ scale: [1, 2.5], opacity: [1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
      </div>
      <span className="text-[10px] text-white/40 font-medium">Live · Updated {minAgo}m ago</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated bar (for charts)                                          */
/* ------------------------------------------------------------------ */
function AnimBar({ height, color, delay = 0, maxH = 120, tooltip }: { height: number; color: string; delay?: number; maxH?: number; tooltip?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div ref={ref} title={tooltip} className="cursor-default rounded-t-[3px]"
      style={{ background: `linear-gradient(to top, ${color}60, ${color})`, width: '100%' }}
      initial={{ height: 0 }} animate={inView ? { height } : {}} transition={{ ...SPRING_BOUNCY, delay }} />
  )
}

/* ------------------------------------------------------------------ */
/*  Animated progress bar                                              */
/* ------------------------------------------------------------------ */
function AnimProgress({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <div ref={ref} className="h-[5px] bg-white/[0.04] rounded-full overflow-hidden">
      <motion.div className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}90, ${color})` }}
        initial={{ width: '0%' }} animate={inView ? { width: `${pct}%` } : {}}
        transition={{ ...SPRING_SMOOTH, delay }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Delta indicator                                                    */
/* ------------------------------------------------------------------ */
function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-white/15 text-[11px]">—</span>
  const up = value > 0
  return (
    <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={SPRING_SNAPPY}
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-red-400' : 'text-emerald-400'}`}>
      <motion.svg width="10" height="10" viewBox="0 0 10 10"
        animate={{ rotate: up ? 0 : 180 }} transition={SPRING_SNAPPY}>
        <path d="M5 2L8 7H2L5 2Z" fill="currentColor" />
      </motion.svg>
      {Math.abs(value)}%
    </motion.span>
  )
}

/* ------------------------------------------------------------------ */
/*  Section header                                                     */
/* ------------------------------------------------------------------ */
function SH({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[15px] font-semibold text-white tracking-[-0.01em]">{title}</h2>
      {sub && <p className="text-[11px] text-white/20 mt-1 leading-relaxed">{sub}</p>}
    </div>
  )
}

/* Escalation badge */
function EscBadge({ level }: { level: number }) {
  const c = ESC_C[Math.min(level, 5) - 1] ?? '#64748b'
  return (
    <motion.span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${c}12`, color: c, border: `1px solid ${c}20` }}
      initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING_BOUNCY}>
      <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: c }}
        animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
      L{level} {ESC_L[level]}
    </motion.span>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-5">
        <div className="relative w-12 h-12">
          <motion.div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <motion.div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500"
            animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
          <motion.div className="absolute inset-1 rounded-full border-2 border-transparent border-b-blue-400/50"
            animate={{ rotate: -360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
        </div>
        <motion.span className="text-white/25 text-sm tracking-wide"
          animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
          Analyzing intelligence data…
        </motion.span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  MAIN COMPONENT                                                     */
/* ------------------------------------------------------------------ */
export function TrendsClient() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/trends?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d as TrendsData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  if (loading) return <Skeleton />
  if (!data) return null

  const { command_strip: cs, daily_volume: dv, escalation_timeline: et, casualty_tracker: ct, attack_patterns: ap, attack_trend_lines: atl, region_threat_matrix: rtm, actor_intel: ai, prediction_panel: pp, comparative_analysis: ca, velocity_panel: vp } = data
  const tc = ca.trend === 'escalating' ? '#ef4444' : ca.trend === 'de_escalating' ? '#22c55e' : '#64748b'
  const tl = ca.trend === 'escalating' ? 'Escalating' : ca.trend === 'de_escalating' ? 'De-escalating' : 'Stable'

  return (
    <AnimatePresence mode="wait">
      <motion.div key={days} className="space-y-5"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>

        {/* ========== HEADER ========== */}
        <Reveal>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-[22px] font-bold text-white tracking-[-0.02em]">Intelligence Trends</h1>
                <motion.span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: `${tc}12`, color: tc, border: `1px solid ${tc}25` }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_BOUNCY}>
                  <motion.span className="w-1.5 h-1.5 rounded-full" style={{ background: tc }}
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  {tl}
                </motion.span>
              </div>
              <p className="text-[12px] text-white/20 mt-1.5">
                <span className="text-white/35 font-medium">{cs.total_events.toLocaleString()}</span> events
                <span className="mx-2 text-white/[0.06]">|</span>{days}d window
                <span className="mx-2 text-white/[0.06]">|</span>{new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <LivePulse generatedAt={data.generated_at} />
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {[7, 30, 90].map(d => (
                  <motion.button key={d} onClick={() => setDays(d)}
                    className={`px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer relative ${days === d ? 'text-blue-400' : 'text-white/25'}`}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    {days === d && (
                      <motion.div layoutId="dayPill" className="absolute inset-0 rounded-lg"
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)', boxShadow: '0 0 20px rgba(59,130,246,0.1)' }}
                        transition={SPRING_SNAPPY} />
                    )}
                    <span className="relative z-10">{d}d</span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* ========== 1. KPI STRIP ========== */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Events', v: cs.total_events, ch: cs.events_change_pct, sp: cs.daily_sparkline, c: '#3b82f6' },
            { label: 'Est. Fatalities', v: cs.total_fatalities, ch: cs.fatalities_change_pct, sp: cs.fatality_sparkline, c: '#ef4444' },
            { label: 'Displacement', v: cs.displacement_events, ch: cs.displacement_change_pct, sp: null, c: '#a78bfa' },
            { label: 'Active Conflicts', v: cs.active_conflicts, ch: null, sp: null, c: '#f97316' },
            { label: 'Escalation Idx', v: cs.escalation_index, ch: cs.escalation_change_pct, sp: null, c: '#eab308', dec: 2 },
          ].map((kpi, i) => (
            <Reveal key={kpi.label} delay={i * 0.06}>
              <motion.div className="relative rounded-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.005) 100%)',
                  border: '1px solid rgba(255,255,255,0.06)', padding: '16px 18px',
                }}
                whileHover={{ y: -3, borderColor: `${kpi.c}30`, boxShadow: `0 8px 30px ${kpi.c}08`, transition: { duration: 0.3 } }}>
                <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${kpi.c}15, transparent)` }} />
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/20 font-medium mb-3">{kpi.label}</div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-[28px] font-bold tracking-tight leading-none" style={{ color: kpi.c }}>
                      <SpringNumber value={kpi.v} decimals={(kpi as {dec?: number}).dec ?? 0} />
                    </div>
                    {kpi.ch !== null && <div className="mt-1.5"><Delta value={kpi.ch} /></div>}
                  </div>
                  {kpi.sp && kpi.sp.length > 1 && (
                    <AnimatedSparkline data={kpi.sp} color={kpi.c} h={30} w={95} />
                  )}
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>

        {/* ========== 2. EVENT VOLUME + ESCALATION ========== */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-4">
          <TiltCard delay={0.1} glow="#3b82f6">
            <SH title="Event Volume by Severity" sub={`Daily breakdown — ${days}-day window`} />
            <div className="overflow-x-auto">
              <InteractiveAreaChart data={dv} />
            </div>
            <div className="flex gap-5 mt-4 pt-3 border-t border-white/[0.04]">
              {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: SEV[s] }} />
                  <span className="text-[11px] text-white/30 capitalize font-medium">{s}</span>
                </div>
              ))}
            </div>
          </TiltCard>

          <TiltCard delay={0.15} glow="#f97316">
            <SH title="Escalation Monitor" sub="Country threat levels from event data" />
            <div className="space-y-1.5 max-h-[310px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
              {et.length > 0 ? et.slice(0, 12).map((entry, i) => (
                <Reveal key={entry.country_code} delay={i * 0.04}>
                  <motion.div className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-mono text-white/45 w-8 font-semibold">{entry.country_code}</span>
                      <EscBadge level={entry.level} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-white/20 font-mono">{entry.event_count} ev</span>
                      {entry.fatality_estimate > 0 && <span className="text-[11px] text-red-400/50 font-mono">{entry.fatality_estimate}</span>}
                      {entry.signals.length > 0 && entry.signals[0] && (
                        <motion.span className="w-2.5 h-2.5 rounded-full"
                          style={{ background: SIG_C[entry.signals[0]!.signal_type] ?? '#64748b', boxShadow: `0 0 10px ${SIG_C[entry.signals[0]!.signal_type] ?? '#64748b'}50` }}
                          animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                      )}
                    </div>
                  </motion.div>
                </Reveal>
              )) : <p className="text-white/10 text-[11px] text-center py-6">No escalation data</p>}
            </div>
          </TiltCard>
        </div>

        {/* ========== 3. CASUALTY TRACKER ========== */}
        <TiltCard delay={0.1} glow="#ef4444">
          <SH title="Casualty & Impact Tracker" sub="Fatality estimates and humanitarian indicators extracted from event data" />
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/15 font-medium mb-4">Overview</div>
              <div className="text-[32px] font-bold text-red-400 tracking-tight leading-none mb-1">
                <SpringNumber value={ct.total_fatalities} color="#f87171" />
              </div>
              <div className="text-[11px] text-white/20 mb-4">Estimated fatalities ({days}d)</div>
              <div className="flex gap-4">
                {[{ v: ct.displacement_events, l: 'Displacement', c: '#a78bfa' }, { v: ct.humanitarian_events, l: 'Humanitarian', c: '#eab308' }].map(s => (
                  <div key={s.l}>
                    <div className="text-[20px] font-bold leading-none" style={{ color: s.c }}><SpringNumber value={s.v} /></div>
                    <div className="text-[10px] text-white/15 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            {[
              { t: 'By Region', items: ct.by_region.slice(0, 6).map(r => ({ l: r.region.replace(/_/g, ' '), v: r.count })), c: '#ef4444' },
              { t: 'By Country', items: ct.by_country.slice(0, 6).map(r => ({ l: r.country_code, v: r.count })), c: '#f97316' },
              { t: 'By Attack Type', items: ct.by_type.slice(0, 6).map(r => ({ l: EV_LABELS[r.event_type] ?? r.event_type, v: r.count })), c: '#eab308' },
            ].map(col => (
              <div key={col.t}>
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/15 font-medium mb-4">{col.t}</div>
                <div className="space-y-3">
                  {col.items.map((row, ri) => (
                    <Reveal key={row.l} delay={ri * 0.05}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] text-white/40 truncate max-w-[110px]">{row.l}</span>
                        <span className="text-[11px] font-mono font-semibold" style={{ color: col.c }}>{row.v.toLocaleString()}</span>
                      </div>
                      <AnimProgress pct={col.items[0] ? Math.round((row.v / col.items[0].v) * 100) : 0} color={col.c} delay={ri * 0.06} />
                    </Reveal>
                  ))}
                  {col.items.length === 0 && <p className="text-[11px] text-white/10">No data</p>}
                </div>
              </div>
            ))}
          </div>

          {ct.daily_fatalities.length > 0 && ct.total_fatalities > 0 && (
            <div className="mt-5 pt-4 border-t border-white/[0.04]">
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/15 font-medium mb-3">Daily Fatality Timeline</div>
              <div className="flex items-end gap-[2px]" style={{ height: 44 }}>
                {ct.daily_fatalities.map((d, di) => {
                  const max = Math.max(...ct.daily_fatalities.map(x => x.fatalities), 1)
                  const h = Math.max(2, Math.round((d.fatalities / max) * 44))
                  return <AnimBar key={d.date} height={d.fatalities > 0 ? h : 2} color={d.fatalities > 0 ? '#ef4444' : 'rgba(255,255,255,0.02)'} delay={di * 0.01} tooltip={`${d.date}: ${d.fatalities}`} />
                })}
              </div>
            </div>
          )}
        </TiltCard>

        {/* ========== 4. ATTACK PATTERNS ========== */}
        <TiltCard delay={0.1} glow="#f97316">
          <SH title="Attack Pattern Analysis" sub="Event type breakdown with trend comparison vs prior period" />
          <div className="grid grid-cols-[1fr_1fr] gap-8">
            <div>
              <div className="grid grid-cols-[1fr_55px_50px_50px_60px_45px] gap-2 mb-3 text-[9px] uppercase tracking-[0.15em] text-white/12 font-medium pb-2 border-b border-white/[0.04]">
                <div>Type</div><div className="text-right">Count</div><div className="text-right">Crit</div>
                <div className="text-right">Fatal</div><div className="text-right">Countries</div><div className="text-right">Δ</div>
              </div>
              {ap.slice(0, 10).map((row, ri) => (
                <Reveal key={row.event_type} delay={ri * 0.04}>
                  <motion.div className="grid grid-cols-[1fr_55px_50px_50px_60px_45px] gap-2 py-[7px] px-2 rounded-lg items-center"
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                    <span className="text-[12px] text-white/55 truncate font-medium">{EV_LABELS[row.event_type] ?? row.event_type}</span>
                    <span className="text-[12px] text-white/45 text-right font-mono">{row.count}</span>
                    <span className="text-[12px] text-red-400/60 text-right font-mono">{row.critical}</span>
                    <span className="text-[12px] text-red-400/40 text-right font-mono">{row.fatalities}</span>
                    <span className="text-[12px] text-white/25 text-right font-mono">{row.countries_affected}</span>
                    <div className="text-right"><Delta value={row.change_pct} /></div>
                  </motion.div>
                </Reveal>
              ))}
            </div>
            <div className="space-y-5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/15 font-medium">Trend Lines</div>
              {Object.entries(atl).slice(0, 4).map(([type, points], ti) => {
                const cols = ['#ef4444', '#f97316', '#eab308', '#3b82f6']
                return (
                  <Reveal key={type} delay={ti * 0.08}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-white/35 font-medium">{EV_LABELS[type] ?? type}</span>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: cols[ti % cols.length] }}>{points.reduce((s, p) => s + p.count, 0)}</span>
                    </div>
                    <AnimatedSparkline data={points.map(p => p.count)} color={cols[ti % cols.length]!} w={300} h={30} />
                  </Reveal>
                )
              })}
            </div>
          </div>
        </TiltCard>

        {/* ========== 5. REGIONAL THREAT MATRIX (HEATMAP) ========== */}
        <TiltCard delay={0.1} glow="#eab308">
          <SH title="Regional Threat Matrix" sub="Multi-dimensional threat assessment across severity, escalation, casualties, and displacement" />
          <HeatmapGrid
            rows={rtm.map(r => ({
              label: r.region.replace(/_/g, ' '),
              values: [r.events, r.critical, r.fatalities, r.escalation_events, r.displacement_events, r.threat_score],
            }))}
            metrics={[
              { label: 'Events', color: '#3b82f6' },
              { label: 'Critical', color: '#ef4444' },
              { label: 'Fatalities', color: '#f97316' },
              { label: 'Escal.', color: '#eab308' },
              { label: 'Displac.', color: '#a78bfa' },
              { label: 'Threat', color: '#ef4444' },
            ]}
          />
        </TiltCard>

        {/* ========== 6. ACTOR INTELLIGENCE ========== */}
        <TiltCard delay={0.1} glow="#a78bfa">
          <SH title="Actor Intelligence" sub="Key actors extracted from event data — frequency, severity, regional activity, and trending" />
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-8">
            <div>
              <div className="grid grid-cols-[1fr_50px_45px_45px_45px_40px] gap-2 mb-3 text-[9px] uppercase tracking-[0.15em] text-white/12 font-medium pb-2 border-b border-white/[0.04]">
                <div>Actor</div><div className="text-right">Events</div><div className="text-right">Sev</div>
                <div className="text-right">Fatal</div><div className="text-right">Reg</div><div className="text-right">Δ</div>
              </div>
              <div className="max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
                {ai.slice(0, 15).map((a, idx) => (
                  <Reveal key={a.name} delay={idx * 0.03}>
                    <motion.div className="grid grid-cols-[1fr_50px_45px_45px_45px_40px] gap-2 py-[6px] px-2 rounded-lg items-center"
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-white/12 w-4 text-right font-mono">{idx + 1}</span>
                        <span className="text-[12px] text-white/55 truncate font-medium">{a.name}</span>
                      </div>
                      <span className="text-[12px] text-white/45 text-right font-mono">{a.event_count}</span>
                      <span className="text-[12px] text-right font-mono font-semibold" style={{ color: a.avg_severity >= 4 ? '#ef4444' : a.avg_severity >= 3 ? '#f97316' : '#eab308' }}>{a.avg_severity.toFixed(1)}</span>
                      <span className="text-[12px] text-red-400/40 text-right font-mono">{a.fatalities}</span>
                      <span className="text-[12px] text-white/25 text-right font-mono">{a.regions.length}</span>
                      <div className="text-right"><Delta value={a.trending} /></div>
                    </motion.div>
                  </Reveal>
                ))}
                {ai.length === 0 && <p className="text-white/10 text-[11px] text-center py-6">No actor data</p>}
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/15 font-medium mb-3">Trending Actors</div>
                {ai.filter(a => a.trending > 50).length > 0 ? ai.filter(a => a.trending > 50).slice(0, 5).map((a, ti) => (
                  <Reveal key={a.name} delay={ti * 0.05}>
                    <motion.div className="flex items-center justify-between py-2 border-b border-white/[0.03]"
                      whileHover={{ x: 2 }} transition={{ duration: 0.2 }}>
                      <span className="text-[12px] text-white/50 truncate max-w-[140px]">{a.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/15 font-mono">{a.event_count}</span>
                        <Delta value={a.trending} />
                      </div>
                    </motion.div>
                  </Reveal>
                )) : <p className="text-[11px] text-white/10">No trending actors this period</p>}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/15 font-medium mb-3">Actor Regions</div>
                {(() => {
                  const rc = new Map<string, number>()
                  for (const a of ai.slice(0, 10)) for (const r of a.regions) rc.set(r, (rc.get(r) ?? 0) + 1)
                  const sorted = [...rc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
                  return sorted.length > 0 ? sorted.map(([region, count], ri) => (
                    <Reveal key={region} delay={ri * 0.04}>
                      <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                        <span className="text-[11px] text-white/35">{region.replace(/_/g, ' ')}</span>
                        <span className="text-[11px] text-white/15 font-mono">{count}</span>
                      </div>
                    </Reveal>
                  )) : <p className="text-[11px] text-white/10">No data</p>
                })()}
              </div>
            </div>
          </div>
        </TiltCard>

        {/* ========== 7. PREDICTIONS (with AnimatedDonut) ========== */}
        <div className="grid grid-cols-2 gap-4">
          <TiltCard delay={0.1} glow="#a78bfa">
            <SH title="Prediction Accuracy" sub="Forecast vs actual outcomes" />
            <div className="flex items-center gap-8 mb-6">
              <div className="flex flex-col items-center justify-center">
                <AnimatedDonut
                  segments={[
                    { value: pp.confirmed, max: pp.total, color: '#22c55e', label: 'Confirmed' },
                    { value: pp.denied, max: pp.total, color: '#ef4444', label: 'Denied' },
                    { value: pp.active, max: pp.total, color: '#f97316', label: 'Active' },
                  ]}
                  radius={45}
                  cx={55}
                  cy={55}
                  label={pp.accuracy_pct != null ? `${Math.round(pp.accuracy_pct)}%` : 'N/A'}
                />
                <div className="text-[10px] text-white/15 uppercase tracking-wider mt-2">Accuracy</div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                {[
                  { l: 'Confirmed', v: pp.confirmed, c: '#22c55e' },
                  { l: 'Active', v: pp.active, c: '#f97316' },
                  { l: 'Denied', v: pp.denied, c: '#ef4444' },
                  { l: 'Expired', v: pp.expired, c: '#475569' },
                ].map((r, ri) => (
                  <Reveal key={r.l} delay={ri * 0.06}>
                    <div className="text-center p-2.5 rounded-xl" style={{ background: `${r.c}08`, border: `1px solid ${r.c}10` }}>
                      <div className="text-[18px] font-bold" style={{ color: r.c }}><SpringNumber value={r.v} /></div>
                      <div className="text-[9px] text-white/15 uppercase tracking-wider mt-0.5">{r.l}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
            {pp.by_type.length > 0 && (
              <div className="pt-4 border-t border-white/[0.04] space-y-2">
                {pp.by_type.map((r, ti) => (
                  <Reveal key={r.type} delay={ti * 0.04}>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[11px] text-white/35 capitalize">{r.type.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-white/15 font-mono">{r.total}</span>
                        {r.accuracy !== null && <span className="text-[11px] font-mono font-semibold" style={{ color: r.accuracy >= 60 ? '#22c55e' : r.accuracy >= 40 ? '#eab308' : '#ef4444' }}>{r.accuracy}%</span>}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </TiltCard>

          <TiltCard delay={0.15} glow="#f97316">
            <SH title="High-Confidence Predictions" sub="Active forecasts ≥70% probability" />
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
              {pp.high_confidence.length > 0 ? pp.high_confidence.map((pred, pi) => (
                <Reveal key={pred.id} delay={pi * 0.05}>
                  <motion.div className="p-3.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}
                    whileHover={{ borderColor: 'rgba(255,255,255,0.1)', y: -1 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[12px] text-white/55 flex-1 line-clamp-2 leading-relaxed">{pred.title}</span>
                      <motion.span className="text-[15px] font-bold font-mono flex-shrink-0"
                        style={{ color: (pred.probability as number) >= 0.85 ? '#ef4444' : '#f97316' }}
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_BOUNCY}>
                        {Math.round((pred.probability as number) * 100)}%
                      </motion.span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {pred.region && <span className="text-[10px] text-white/15 px-2 py-0.5 rounded-md bg-white/[0.03]">{pred.region.replace(/_/g, ' ')}</span>}
                      {(pred.severity_if_true as number) >= 4 && <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: '#ef444412', color: '#ef4444' }}>SEV {pred.severity_if_true}</span>}
                    </div>
                  </motion.div>
                </Reveal>
              )) : <p className="text-white/10 text-[11px] text-center py-8">No high-confidence predictions</p>}
            </div>
          </TiltCard>
        </div>

        {/* ========== 8. COMPARATIVE ========== */}
        <div className="grid grid-cols-3 gap-4">
          <TiltCard delay={0.1}>
            <SH title="Week-over-Week" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[{ l: 'This Week', v: ca.this_week.total, c: ca.this_week.critical, active: true }, { l: 'Last Week', v: ca.last_week.total, c: ca.last_week.critical, active: false }].map(w => (
                <motion.div key={w.l} className="p-3 rounded-xl" style={{ background: w.active ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)', border: `1px solid rgba(255,255,255,${w.active ? 0.05 : 0.03})` }}
                  whileHover={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="text-[10px] text-white/15 mb-1.5 uppercase tracking-wider">{w.l}</div>
                  <div className={`text-[26px] font-bold tracking-tight leading-none ${w.active ? 'text-white' : 'text-white/35'}`}>
                    <SpringNumber value={w.v} />
                  </div>
                  <div className="text-[11px] text-red-400/40 mt-1 font-mono">{w.c} critical</div>
                </motion.div>
              ))}
            </div>
            <div className="space-y-2 pt-3 border-t border-white/[0.04]">
              <div className="flex justify-between items-center"><span className="text-[11px] text-white/20">Weekly</span><Delta value={ca.week_change_pct} /></div>
              <div className="flex justify-between items-center"><span className="text-[11px] text-white/20">Period</span><Delta value={ca.period_change_pct} /></div>
            </div>
          </TiltCard>

          <TiltCard delay={0.15} glow="#ef4444">
            <SH title="Anomaly Detection" sub={`σ-threshold: ${ca.anomaly_threshold}/day`} />
            <div className="text-[10px] text-white/10 mb-3 font-mono">μ={ca.mean_daily} · σ={ca.stddev_daily}</div>
            {ca.anomaly_days.length > 0 ? ca.anomaly_days.slice(0, 5).map((ad, i) => (
              <Reveal key={ad.date} delay={i * 0.05}>
                <motion.div className="flex items-center justify-between py-[6px] px-2 rounded-lg"
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                  <span className="text-[12px] text-white/45 font-mono">{ad.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/35 font-mono">{ad.count}</span>
                    <motion.span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
                      style={{ background: '#ef444415', color: '#ef4444', boxShadow: '0 0 12px #ef444410' }}
                      animate={{ boxShadow: ['0 0 12px #ef444410', '0 0 20px #ef444420', '0 0 12px #ef444410'] }}
                      transition={{ duration: 2, repeat: Infinity }}>
                      {ad.sigma}σ
                    </motion.span>
                  </div>
                </motion.div>
              </Reveal>
            )) : <p className="text-white/10 text-[11px] text-center py-6">No anomalies detected</p>}
          </TiltCard>

          <TiltCard delay={0.2}>
            <SH title="Regional Movement" sub="Largest changes vs prior period" />
            {ca.region_comparison.slice(0, 6).map((rc, ri) => (
              <Reveal key={rc.region} delay={ri * 0.04}>
                <motion.div className="flex items-center justify-between py-[6px] px-2 rounded-lg"
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.025)', x: 2 }} transition={{ duration: 0.2 }}>
                  <span className="text-[11px] text-white/35 truncate max-w-[100px]">{rc.region.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/15 font-mono">{rc.prior}→{rc.current}</span>
                    <Delta value={rc.change_pct} />
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </TiltCard>
        </div>

        {/* ========== 9. VELOCITY ========== */}
        <TiltCard delay={0.1} glow="#3b82f6">
          <SH title="Event Velocity (48h)" sub="Hourly ingestion rate with σ-based anomaly detection" />
          <div className="grid grid-cols-[1fr_180px] gap-6">
            <div>
              <div className="flex items-end gap-[2px]" style={{ height: 70 }}>
                {vp.hourly_velocity.map((h2, hi) => {
                  const max = Math.max(vp.peak_hourly, 1)
                  const ht = Math.max(3, Math.round((h2.count / max) * 70))
                  const anom = h2.count > vp.anomaly_threshold
                  return <AnimBar key={h2.hour} height={ht} color={anom ? '#ef4444' : 'rgba(59,130,246,0.55)'} delay={hi * 0.008} tooltip={`${h2.hour}: ${h2.count}`} />
                })}
              </div>
              <div className="flex gap-5 mt-3">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'rgba(59,130,246,0.5)' }} /><span className="text-[10px] text-white/20">Normal</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[3px] bg-red-500" /><span className="text-[10px] text-white/20">Anomaly ({">"}{Math.round(vp.anomaly_threshold)}/hr)</span></div>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { l: 'Current', v: vp.current_rate, u: '/hr', c: '#3b82f6' },
                { l: 'Average', v: vp.avg_hourly, u: '/hr', c: 'rgba(255,255,255,0.4)' },
                { l: 'Peak', v: vp.peak_hourly, u: '/hr', c: '#f97316' },
              ].map((s, si) => (
                <Reveal key={s.l} delay={si * 0.06}>
                  <div className="text-[10px] text-white/15 mb-0.5">{s.l}</div>
                  <div className="text-[22px] font-bold tracking-tight leading-none" style={{ color: s.c }}>
                    <SpringNumber value={s.v} /><span className="text-[11px] text-white/15 ml-1 font-normal">{s.u}</span>
                  </div>
                </Reveal>
              ))}
              {vp.anomalies.length > 0 && (
                <motion.div className="text-[10px] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                  style={{ background: '#ef444410', color: '#ef4444' }}
                  animate={{ boxShadow: ['0 0 0 rgba(239,68,68,0)', '0 0 15px rgba(239,68,68,0.1)', '0 0 0 rgba(239,68,68,0)'] }}
                  transition={{ duration: 2, repeat: Infinity }}>
                  <motion.span className="w-1.5 h-1.5 rounded-full bg-red-500"
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                  {vp.anomalies.length} spike{vp.anomalies.length > 1 ? 's' : ''}
                </motion.div>
              )}
            </div>
          </div>
        </TiltCard>

        {/* ========== FORECAST + COUNTRY RISK ========== */}
        <div className="grid grid-cols-2 gap-4">
          <TiltCard delay={0.1} glow="#22c55e">
            <SH title="Forecast Signals" sub="Active intelligence signals" />
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
              {data.forecast_signals.length > 0 ? data.forecast_signals.slice(0, 12).map((sig, si) => (
                <Reveal key={si} delay={si * 0.04}>
                  <motion.div className="flex items-center justify-between py-[6px] px-2 rounded-lg"
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                    <div className="flex items-center gap-2.5">
                      <motion.span className="w-2.5 h-2.5 rounded-full" style={{ background: SIG_C[sig.signal_type] ?? '#64748b', boxShadow: `0 0 10px ${SIG_C[sig.signal_type] ?? '#64748b'}40` }}
                        animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                      <span className="text-[12px] text-white/40 font-mono font-semibold">{sig.country_code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold"
                        style={{ background: `${SIG_C[sig.signal_type] ?? '#64748b'}10`, color: SIG_C[sig.signal_type] ?? '#64748b' }}>
                        {sig.signal_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[11px] text-white/25 font-mono">{Math.round(sig.confidence * 100)}%</span>
                  </motion.div>
                </Reveal>
              )) : <p className="text-white/10 text-[11px] text-center py-6">No active signals</p>}
            </div>
          </TiltCard>

          <TiltCard delay={0.15} glow="#3b82f6">
            <SH title="Country Risk Scores" sub="Composite risk assessment" />
            <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
              {data.country_risks.map((cr, ci) => {
                const c = cr.risk_score >= 70 ? '#ef4444' : cr.risk_score >= 40 ? '#f97316' : cr.risk_score >= 20 ? '#eab308' : '#22c55e'
                const tc2 = cr.trend === 'rising' ? '#ef4444' : cr.trend === 'falling' ? '#22c55e' : '#475569'
                return (
                  <Reveal key={cr.country_code} delay={ci * 0.03}>
                    <motion.div className="flex items-center justify-between py-[6px] px-2 rounded-lg"
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.025)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-white/45 font-mono font-semibold w-8">{cr.country_code}</span>
                        <div className="w-16 h-[5px] bg-white/[0.03] rounded-full overflow-hidden">
                          <AnimProgress pct={cr.risk_score} color={c} delay={ci * 0.04} />
                        </div>
                        <span className="text-[12px] font-bold font-mono" style={{ color: c }}>{cr.risk_score}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-white/12 font-mono">{cr.event_count_7d}/7d</span>
                        <motion.span className="text-[10px] font-semibold" style={{ color: tc2 }}
                          animate={cr.trend === 'rising' ? { y: [0, -2, 0] } : cr.trend === 'falling' ? { y: [0, 2, 0] } : {}}
                          transition={{ duration: 2, repeat: Infinity }}>
                          {cr.trend === 'rising' ? '▲' : cr.trend === 'falling' ? '▼' : '—'}
                        </motion.span>
                      </div>
                    </motion.div>
                  </Reveal>
                )
              })}
              {data.country_risks.length === 0 && <p className="text-white/10 text-[11px] text-center py-6">No data</p>}
            </div>
          </TiltCard>
        </div>

      </motion.div>
    </AnimatePresence>
  )
}
