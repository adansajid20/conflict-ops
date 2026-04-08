'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

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
  command_strip: CommandStrip
  daily_volume: DayVolume[]
  escalation_timeline: EscalationEntry[]
  casualty_tracker: CasualtyTracker
  attack_patterns: AttackPattern[]
  attack_trend_lines: Record<string, { date: string; count: number }[]>
  region_threat_matrix: RegionThreat[]
  actor_intel: ActorEntry[]
  prediction_panel: PredictionPanel
  comparative_analysis: ComparativeAnalysis
  velocity_panel: VelocityPanel
  forecast_signals: { signal_type: string; country_code: string; confidence: number; conflict_zone: string }[]
  country_risks: { country_code: string; risk_score: number; trend: string; event_count_7d: number; severity_avg: number }[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SEV_COLORS = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e' }
const SIGNAL_COLORS: Record<string, string> = {
  ESCALATION_TREND: '#ef4444', DEESCALATION: '#22c55e', NEW_FRONT: '#f97316', CEASEFIRE_RISK: '#3b82f6',
}
const ESC_LEVEL_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
const ESC_LEVEL_LABELS = ['', 'Stable', 'Tension', 'Crisis', 'Conflict', 'War']

const EVENT_TYPE_LABELS: Record<string, string> = {
  armed_conflict: 'Armed Conflict', airstrike: 'Airstrike', terrorism: 'Terrorism',
  coup: 'Coup', civil_unrest: 'Civil Unrest', protest: 'Protest',
  political_crisis: 'Political Crisis', political: 'Political', sanctions: 'Sanctions',
  ceasefire: 'Ceasefire', diplomacy: 'Diplomacy', wmd_threat: 'WMD Threat',
  humanitarian_crisis: 'Humanitarian Crisis', natural_disaster: 'Natural Disaster',
  security: 'Security', cyber: 'Cyber', displacement: 'Displacement',
  humanitarian: 'Humanitarian', border_incident: 'Border Incident',
  maritime_incident: 'Maritime Incident', aviation_incident: 'Aviation Incident',
  military: 'Military', mobilization: 'Mobilization', explosion: 'Explosion',
  attack: 'Attack', news: 'News', unknown: 'Unknown',
}

/* ------------------------------------------------------------------ */
/*  CSS Keyframes (injected once)                                      */
/* ------------------------------------------------------------------ */
const STYLE_ID = 'trends-animations'
function injectStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes trendFadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes trendCountUp {
      from { opacity: 0; transform: scale(0.85); filter: blur(4px); }
      to { opacity: 1; transform: scale(1); filter: blur(0); }
    }
    @keyframes trendBarGrow {
      from { transform: scaleY(0); }
      to { transform: scaleY(1); }
    }
    @keyframes trendWidthGrow {
      from { width: 0%; }
    }
    @keyframes trendPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes trendGlow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
      50% { box-shadow: 0 0 20px 2px rgba(59,130,246,0.15); }
    }
    @keyframes trendSlideIn {
      from { opacity: 0; transform: translateX(-12px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes trendSparkDraw {
      from { stroke-dashoffset: 1000; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes trendShimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .trend-fade-up { animation: trendFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both; }
    .trend-count-up { animation: trendCountUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
    .trend-bar-grow { animation: trendBarGrow 0.8s cubic-bezier(0.16,1,0.3,1) both; transform-origin: bottom; }
    .trend-width-grow { animation: trendWidthGrow 1s cubic-bezier(0.16,1,0.3,1) both; }
    .trend-pulse { animation: trendPulse 2s ease-in-out infinite; }
    .trend-glow { animation: trendGlow 3s ease-in-out infinite; }
    .trend-slide-in { animation: trendSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
    .trend-spark-draw { stroke-dasharray: 1000; animation: trendSparkDraw 1.5s cubic-bezier(0.16,1,0.3,1) both; }
    .trend-stagger-1 { animation-delay: 0.05s; }
    .trend-stagger-2 { animation-delay: 0.1s; }
    .trend-stagger-3 { animation-delay: 0.15s; }
    .trend-stagger-4 { animation-delay: 0.2s; }
    .trend-stagger-5 { animation-delay: 0.25s; }
    .trend-stagger-6 { animation-delay: 0.3s; }
    .trend-stagger-7 { animation-delay: 0.35s; }
    .trend-stagger-8 { animation-delay: 0.4s; }
    .trend-stagger-9 { animation-delay: 0.45s; }
    .trend-stagger-10 { animation-delay: 0.5s; }
    .trend-card {
      background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 20px;
      transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
      position: relative;
      overflow: hidden;
    }
    .trend-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    }
    .trend-card:hover {
      background: linear-gradient(135deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%);
      border-color: rgba(255,255,255,0.1);
      transform: translateY(-1px);
    }
    .trend-kpi-card {
      background: linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 16px 18px;
      transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
      position: relative;
      overflow: hidden;
    }
    .trend-kpi-card::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 12px;
      right: 12px;
      height: 2px;
      border-radius: 2px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .trend-kpi-card:hover {
      background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%);
      border-color: rgba(255,255,255,0.1);
      transform: translateY(-2px);
    }
    .trend-kpi-card:hover::after { opacity: 1; }
    .trend-scrollbar::-webkit-scrollbar { width: 4px; }
    .trend-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .trend-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
    .trend-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
    .trend-table-row {
      transition: all 0.2s;
      border-radius: 8px;
      padding: 6px 8px;
    }
    .trend-table-row:hover {
      background: rgba(255,255,255,0.03);
    }
  `
  document.head.appendChild(style)
}

/* ------------------------------------------------------------------ */
/*  Animated number counter                                            */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, duration = 1200, decimals = 0, prefix = '', suffix = '' }: { value: number; duration?: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number>(0)
  useEffect(() => {
    const start = ref.current
    const diff = value - start
    if (diff === 0) return
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const current = start + diff * eased
      setDisplay(current)
      ref.current = current
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration])
  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()
  return <>{prefix}{formatted}{suffix}</>
}

/* ------------------------------------------------------------------ */
/*  Animated sparkline with SVG path draw                              */
/* ------------------------------------------------------------------ */
function Sparkline({ data, color = '#3b82f6', height = 32, width = 120, filled = false }: { data: number[]; color?: string; height?: number; width?: number; filled?: boolean }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const fillD = pathD + ` L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} className="overflow-visible" style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}>
      {filled && (
        <path d={fillD} fill={`url(#sparkGrad-${color.replace('#', '')})`} opacity="0.15" />
      )}
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="trend-spark-draw" />
      <circle cx={points[points.length - 1]!.x} cy={points[points.length - 1]!.y} r="3" fill={color} className="trend-pulse" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Reusable micro-components                                          */
/* ------------------------------------------------------------------ */
function Delta({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-white/20 text-[11px]">—</span>
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-red-400' : 'text-emerald-400'}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: up ? '' : 'rotate(180deg)' }}>
        <path d="M5 2L8 7H2L5 2Z" fill="currentColor" />
      </svg>
      {Math.abs(value)}{suffix}
    </span>
  )
}

function SectionHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {icon && <span className="text-lg mt-0.5">{icon}</span>}
      <div>
        <h2 className="text-[15px] font-semibold text-white tracking-[-0.01em]">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/25 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
    </div>
  )
}

function ProgressBar({ value, max, color, delay = 0 }: { value: number; max: number; color: string; delay?: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-[5px] bg-white/[0.04] rounded-full overflow-hidden">
      <div className="h-full rounded-full trend-width-grow"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}aa)`, width: `${pct}%`, animationDelay: `${delay}ms` }} />
    </div>
  )
}

function EscalationBadge({ level }: { level: number }) {
  const color = ESC_LEVEL_COLORS[Math.min(level, 5) - 1] ?? '#64748b'
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
      <span className="w-1.5 h-1.5 rounded-full trend-pulse" style={{ background: color }} />
      L{level} {ESC_LEVEL_LABELS[level]}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export function TrendsClient() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => { injectStyles() }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/trends?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d as TrendsData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-10 h-10 border-2 border-blue-500/20 rounded-full" />
          <div className="absolute inset-0 w-10 h-10 border-2 border-transparent border-t-blue-500 rounded-full animate-spin" />
        </div>
        <span className="text-white/30 text-sm tracking-wide">Analyzing intelligence data…</span>
      </div>
    </div>
  )
  if (!data) return null

  const { command_strip: cs, daily_volume: dv, escalation_timeline: et, casualty_tracker: ct, attack_patterns: ap, attack_trend_lines: atl, region_threat_matrix: rtm, actor_intel: ai, prediction_panel: pp, comparative_analysis: ca, velocity_panel: vp } = data

  const trendColor = ca.trend === 'escalating' ? '#ef4444' : ca.trend === 'de_escalating' ? '#22c55e' : '#64748b'
  const trendLabel = ca.trend === 'escalating' ? 'Escalating' : ca.trend === 'de_escalating' ? 'De-escalating' : 'Stable'

  return (
    <div className="space-y-5">

      {/* ============================================================= */}
      {/*  HEADER                                                        */}
      {/* ============================================================= */}
      <div className="flex items-center justify-between trend-fade-up">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-bold text-white tracking-[-0.02em]">Intelligence Trends</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                style={{ background: `${trendColor}15`, color: trendColor, border: `1px solid ${trendColor}30` }}>
                <span className="w-1.5 h-1.5 rounded-full trend-pulse" style={{ background: trendColor }} />
                {trendLabel}
              </span>
            </div>
            <p className="text-[12px] text-white/25 mt-1.5 tracking-wide">
              <span className="text-white/40 font-medium">{cs.total_events.toLocaleString()}</span> events analyzed
              <span className="mx-2 text-white/10">|</span>
              {days}-day window
              <span className="mx-2 text-white/10">|</span>
              Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.05]">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-[12px] font-semibold cursor-pointer transition-all duration-300 ${days === d ? 'bg-blue-500/20 text-blue-400 shadow-lg shadow-blue-500/10' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================= */}
      {/*  1. COMMAND STRIP — KPIs                                       */}
      {/* ============================================================= */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: cs.total_events, change: cs.events_change_pct, spark: cs.daily_sparkline, color: '#3b82f6', icon: '⚡' },
          { label: 'Est. Fatalities', value: cs.total_fatalities, change: cs.fatalities_change_pct, spark: cs.fatality_sparkline, color: '#ef4444', icon: '💀' },
          { label: 'Displacement Signals', value: cs.displacement_events, change: cs.displacement_change_pct, spark: null, color: '#a78bfa', icon: '🏚' },
          { label: 'Active Conflicts', value: cs.active_conflicts, change: null, spark: null, color: '#f97316', icon: '🔥' },
          { label: 'Escalation Index', value: cs.escalation_index, change: cs.escalation_change_pct, spark: null, color: '#eab308', icon: '📈', decimals: 2 },
        ].map((kpi, i) => (
          <div key={kpi.label} className={`trend-kpi-card trend-fade-up trend-stagger-${i + 1}`}
            style={{ ['--accent' as string]: kpi.color }}>
            <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${kpi.color}40, transparent)`, opacity: 0, transition: 'opacity 0.3s' }} />
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-[11px]">{kpi.icon}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/25 font-medium">{kpi.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[26px] font-bold tracking-tight trend-count-up" style={{ color: kpi.color }}>
                  <AnimatedNumber value={kpi.value} decimals={(kpi as { decimals?: number }).decimals ?? 0} />
                </div>
                {kpi.change !== null && <div className="mt-1"><Delta value={kpi.change} /></div>}
              </div>
              {kpi.spark && kpi.spark.length > 1 && (
                <div className="opacity-80">
                  <Sparkline data={kpi.spark} color={kpi.color} filled height={28} width={90} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ============================================================= */}
      {/*  2. EVENT VOLUME + ESCALATION LEVELS                           */}
      {/* ============================================================= */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        <div className="trend-card trend-fade-up trend-stagger-2">
          <SectionHeader title="Event Volume by Severity" subtitle={`Daily breakdown — ${days}-day window`} icon="📊" />
          <div className="overflow-x-auto">
            <div className="flex items-end gap-[3px]" style={{ height: 120, minWidth: Math.max(dv.length * 10, 200) }}>
              {dv.map((day, di) => {
                const max = Math.max(...dv.map(d => d.total), 1)
                const barW = Math.max(Math.floor(560 / Math.max(dv.length, 1)), 4)
                return (
                  <div key={day.date} title={`${day.date}\n${day.total} events · ${day.fatalities} fatalities`}
                    className="flex flex-col justify-end cursor-default group relative"
                    style={{ width: barW }}>
                    {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                      const h = Math.round((day[sev] / max) * 120)
                      return h > 0 ? (
                        <div key={sev} className="trend-bar-grow rounded-[2px] transition-opacity group-hover:opacity-80"
                          style={{ height: h, background: SEV_COLORS[sev], animationDelay: `${di * 15 + 200}ms` }} />
                      ) : null
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-5 mt-4 pt-3 border-t border-white/[0.04]">
            {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
              <div key={sev} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: SEV_COLORS[sev] }} />
                <span className="text-[11px] text-white/35 capitalize font-medium">{sev}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="trend-card trend-fade-up trend-stagger-3">
          <SectionHeader title="Escalation Monitor" subtitle="Country threat levels computed from event data" icon="🎯" />
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 trend-scrollbar">
            {et.length > 0 ? et.slice(0, 12).map((entry, i) => (
              <div key={entry.country_code} className={`trend-table-row flex items-center justify-between trend-slide-in trend-stagger-${Math.min(i + 1, 10)}`}>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-mono text-white/50 w-8 font-semibold">{entry.country_code}</span>
                  <EscalationBadge level={entry.level} />
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-[11px] text-white/25 font-mono">{entry.event_count} ev</span>
                  {entry.fatality_estimate > 0 && (
                    <span className="text-[11px] text-red-400/60 font-mono">{entry.fatality_estimate} fat</span>
                  )}
                  {entry.signals.length > 0 && entry.signals[0] && (
                    <span className="w-2.5 h-2.5 rounded-full trend-pulse"
                      style={{ background: SIGNAL_COLORS[entry.signals[0]!.signal_type] ?? '#64748b', boxShadow: `0 0 8px ${SIGNAL_COLORS[entry.signals[0]!.signal_type] ?? '#64748b'}50` }}
                      title={entry.signals[0]!.signal_type} />
                  )}
                </div>
              </div>
            )) : (
              <div className="text-[11px] text-white/15 text-center py-6">No escalation data for this period</div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  3. CASUALTY & IMPACT TRACKER                                  */}
      {/* ============================================================= */}
      <div className="trend-card trend-fade-up trend-stagger-3">
        <SectionHeader title="Casualty & Impact Tracker" subtitle="Fatality estimates and humanitarian indicators extracted from event data" icon="🩸" />
        <div className="grid grid-cols-4 gap-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/20 font-medium mb-4">Overview</div>
            <div className="space-y-4">
              <div>
                <div className="text-[28px] font-bold text-red-400 tracking-tight trend-count-up">
                  <AnimatedNumber value={ct.total_fatalities} />
                </div>
                <div className="text-[11px] text-white/25 mt-0.5">Estimated fatalities ({days}d)</div>
              </div>
              <div className="flex gap-4">
                <div>
                  <div className="text-[20px] font-bold text-purple-400 trend-count-up">
                    <AnimatedNumber value={ct.displacement_events} />
                  </div>
                  <div className="text-[10px] text-white/20">Displacement</div>
                </div>
                <div>
                  <div className="text-[20px] font-bold text-amber-400 trend-count-up">
                    <AnimatedNumber value={ct.humanitarian_events} />
                  </div>
                  <div className="text-[10px] text-white/20">Humanitarian</div>
                </div>
              </div>
            </div>
          </div>

          {[
            { title: 'By Region', items: ct.by_region.slice(0, 6).map(r => ({ label: r.region.replace(/_/g, ' '), value: r.count })), color: '#ef4444' },
            { title: 'By Country', items: ct.by_country.slice(0, 6).map(r => ({ label: r.country_code, value: r.count })), color: '#f97316' },
            { title: 'By Attack Type', items: ct.by_type.slice(0, 6).map(r => ({ label: EVENT_TYPE_LABELS[r.event_type] ?? r.event_type, value: r.count })), color: '#eab308' },
          ].map(col => (
            <div key={col.title}>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/20 font-medium mb-4">{col.title}</div>
              <div className="space-y-3">
                {col.items.map((row, ri) => (
                  <div key={row.label} className={`trend-slide-in trend-stagger-${ri + 1}`}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[11px] text-white/50 truncate max-w-[110px]">{row.label}</span>
                      <span className="text-[11px] font-mono font-semibold" style={{ color: col.color }}>{row.value.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={row.value} max={col.items[0]?.value ?? 1} color={col.color} delay={ri * 80} />
                  </div>
                ))}
                {col.items.length === 0 && <div className="text-[11px] text-white/15">No data</div>}
              </div>
            </div>
          ))}
        </div>

        {ct.daily_fatalities.length > 0 && ct.total_fatalities > 0 && (
          <div className="mt-5 pt-4 border-t border-white/[0.04]">
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/20 font-medium mb-3">Daily Fatality Timeline</div>
            <div className="flex items-end gap-[2px]" style={{ height: 40 }}>
              {ct.daily_fatalities.map((d, di) => {
                const max = Math.max(...ct.daily_fatalities.map(x => x.fatalities), 1)
                const h = Math.max(1, Math.round((d.fatalities / max) * 40))
                return (
                  <div key={d.date} title={`${d.date}: ${d.fatalities}`}
                    className="cursor-default rounded-t trend-bar-grow"
                    style={{ flex: 1, height: d.fatalities > 0 ? h : 2, background: d.fatalities > 0 ? `linear-gradient(to top, #ef444480, #ef4444)` : 'rgba(255,255,255,0.02)', minWidth: 2, animationDelay: `${di * 12}ms` }} />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/*  4. ATTACK PATTERN ANALYSIS                                    */}
      {/* ============================================================= */}
      <div className="trend-card trend-fade-up trend-stagger-4">
        <SectionHeader title="Attack Pattern Analysis" subtitle="Event type breakdown with trend comparison vs prior period" icon="⚔️" />
        <div className="grid grid-cols-[1fr_1fr] gap-8">
          <div>
            <div className="grid grid-cols-[1fr_55px_55px_55px_65px_50px] gap-2 mb-3 text-[9px] uppercase tracking-[0.15em] text-white/15 font-medium pb-2 border-b border-white/[0.04]">
              <div>Type</div><div className="text-right">Count</div><div className="text-right">Crit</div>
              <div className="text-right">Fatal</div><div className="text-right">Countries</div><div className="text-right">Trend</div>
            </div>
            <div className="space-y-0.5">
              {ap.slice(0, 10).map((row, ri) => (
                <div key={row.event_type} className={`grid grid-cols-[1fr_55px_55px_55px_65px_50px] gap-2 trend-table-row items-center trend-slide-in trend-stagger-${Math.min(ri + 1, 10)}`}>
                  <span className="text-[12px] text-white/60 truncate font-medium">{EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}</span>
                  <span className="text-[12px] text-white/50 text-right font-mono">{row.count}</span>
                  <span className="text-[12px] text-red-400/70 text-right font-mono">{row.critical}</span>
                  <span className="text-[12px] text-red-400/50 text-right font-mono">{row.fatalities}</span>
                  <span className="text-[12px] text-white/30 text-right font-mono">{row.countries_affected}</span>
                  <div className="text-right"><Delta value={row.change_pct} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/20 font-medium mb-2">Trend Lines (Top Types)</div>
            {Object.entries(atl).slice(0, 4).map(([type, points], ti) => {
              const colors = ['#ef4444', '#f97316', '#eab308', '#3b82f6']
              return (
                <div key={type} className={`trend-fade-up trend-stagger-${ti + 1}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-white/40 font-medium">{EVENT_TYPE_LABELS[type] ?? type}</span>
                    <span className="text-[11px] font-mono font-semibold" style={{ color: colors[ti % colors.length] }}>{points.reduce((s, p) => s + p.count, 0)}</span>
                  </div>
                  <Sparkline data={points.map(p => p.count)} color={colors[ti % colors.length]!} width={300} height={28} filled />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  5. REGIONAL THREAT MATRIX                                     */}
      {/* ============================================================= */}
      <div className="trend-card trend-fade-up trend-stagger-5">
        <SectionHeader title="Regional Threat Matrix" subtitle="Multi-dimensional threat assessment scored across severity, escalation, casualties, and displacement" icon="🗺️" />
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[1fr_65px_65px_70px_65px_65px_55px_60px_85px] gap-2 mb-3 text-[9px] uppercase tracking-[0.15em] text-white/15 font-medium pb-2 border-b border-white/[0.04]">
            <div>Region</div><div className="text-right">Events</div><div className="text-right">Critical</div>
            <div className="text-right">Fatalities</div><div className="text-right">Escal.</div>
            <div className="text-right">Displac.</div><div className="text-right">Types</div>
            <div className="text-right">Countries</div><div className="text-right">Threat</div>
          </div>
          <div className="space-y-0.5">
            {rtm.map((row, ri) => {
              const scoreColor = row.threat_score >= 70 ? '#ef4444' : row.threat_score >= 40 ? '#f97316' : row.threat_score >= 20 ? '#eab308' : '#22c55e'
              return (
                <div key={row.region} className={`grid grid-cols-[1fr_65px_65px_70px_65px_65px_55px_60px_85px] gap-2 trend-table-row items-center trend-slide-in trend-stagger-${Math.min(ri + 1, 10)}`}>
                  <span className="text-[12px] text-white/60 truncate font-medium">{row.region.replace(/_/g, ' ')}</span>
                  <span className="text-[12px] text-white/50 text-right font-mono">{row.events}</span>
                  <span className="text-[12px] text-red-400/70 text-right font-mono">{row.critical}</span>
                  <span className="text-[12px] text-red-400/50 text-right font-mono">{row.fatalities}</span>
                  <span className="text-[12px] text-orange-400/50 text-right font-mono">{row.escalation_events}</span>
                  <span className="text-[12px] text-purple-400/50 text-right font-mono">{row.displacement_events}</span>
                  <span className="text-[12px] text-white/30 text-right font-mono">{row.attack_types}</span>
                  <span className="text-[12px] text-white/30 text-right font-mono">{row.countries}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-14 h-[5px] bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full rounded-full trend-width-grow" style={{ background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})`, width: `${row.threat_score}%`, animationDelay: `${ri * 60}ms` }} />
                    </div>
                    <span className="text-[12px] font-bold font-mono w-6 text-right" style={{ color: scoreColor }}>{row.threat_score}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  6. ACTOR INTELLIGENCE                                         */}
      {/* ============================================================= */}
      <div className="trend-card trend-fade-up trend-stagger-6">
        <SectionHeader title="Actor Intelligence" subtitle="Key actors extracted from event data — frequency, severity, regional activity, and trending" icon="🎭" />
        <div className="grid grid-cols-[1.2fr_0.8fr] gap-8">
          <div>
            <div className="grid grid-cols-[1fr_50px_50px_50px_50px_45px] gap-2 mb-3 text-[9px] uppercase tracking-[0.15em] text-white/15 font-medium pb-2 border-b border-white/[0.04]">
              <div>Actor</div><div className="text-right">Events</div><div className="text-right">Sev</div>
              <div className="text-right">Fatal</div><div className="text-right">Regions</div><div className="text-right">Δ</div>
            </div>
            <div className="space-y-0.5 max-h-[320px] overflow-y-auto pr-1 trend-scrollbar">
              {ai.slice(0, 15).map((actor, idx) => (
                <div key={actor.name} className={`grid grid-cols-[1fr_50px_50px_50px_50px_45px] gap-2 trend-table-row items-center trend-slide-in trend-stagger-${Math.min(idx + 1, 10)}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-white/15 w-4 text-right flex-shrink-0 font-mono">{idx + 1}</span>
                    <span className="text-[12px] text-white/60 truncate font-medium">{actor.name}</span>
                  </div>
                  <span className="text-[12px] text-white/50 text-right font-mono">{actor.event_count}</span>
                  <span className="text-[12px] text-right font-mono font-semibold" style={{ color: actor.avg_severity >= 4 ? '#ef4444' : actor.avg_severity >= 3 ? '#f97316' : '#eab308' }}>
                    {actor.avg_severity.toFixed(1)}
                  </span>
                  <span className="text-[12px] text-red-400/50 text-right font-mono">{actor.fatalities}</span>
                  <span className="text-[12px] text-white/30 text-right font-mono">{actor.regions.length}</span>
                  <div className="text-right"><Delta value={actor.trending} /></div>
                </div>
              ))}
              {ai.length === 0 && <div className="text-[11px] text-white/15 text-center py-6">No actor data extracted</div>}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/20 font-medium mb-3">Trending Actors</div>
              {ai.filter(a => a.trending > 50).length > 0 ? ai.filter(a => a.trending > 50).slice(0, 5).map((actor, ti) => (
                <div key={actor.name} className={`flex items-center justify-between py-2 border-b border-white/[0.03] trend-slide-in trend-stagger-${ti + 1}`}>
                  <span className="text-[12px] text-white/60 font-medium truncate max-w-[140px]">{actor.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/20 font-mono">{actor.event_count}</span>
                    <Delta value={actor.trending} />
                  </div>
                </div>
              )) : (
                <div className="text-[11px] text-white/15 py-4">No significant trending actors</div>
              )}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/20 font-medium mb-3">Actor Regions</div>
              {(() => {
                const regionCounts = new Map<string, number>()
                for (const actor of ai.slice(0, 10)) {
                  for (const r of actor.regions) regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
                }
                const sorted = [...regionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
                return sorted.length > 0 ? sorted.map(([region, count], ri) => (
                  <div key={region} className={`flex items-center justify-between py-1.5 border-b border-white/[0.03] trend-slide-in trend-stagger-${ri + 1}`}>
                    <span className="text-[11px] text-white/40">{region.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-white/20 font-mono">{count} actors</span>
                  </div>
                )) : <div className="text-[11px] text-white/15">No data</div>
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  7. PREDICTION CORRELATION                                     */}
      {/* ============================================================= */}
      <div className="grid grid-cols-2 gap-4">
        <div className="trend-card trend-fade-up trend-stagger-7">
          <SectionHeader title="Prediction Accuracy" subtitle="Forecast vs actual outcomes" icon="🔮" />
          <div className="flex items-center gap-8 mb-6">
            <div className="text-center">
              <div className="text-[36px] font-bold text-purple-400 tracking-tight trend-count-up">
                {pp.accuracy_pct != null ? <AnimatedNumber value={pp.accuracy_pct} suffix="%" /> : 'N/A'}
              </div>
              <div className="text-[10px] text-white/20 uppercase tracking-wider mt-0.5">Accuracy</div>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-2">
              {[
                { label: 'Confirmed', count: pp.confirmed, color: '#22c55e' },
                { label: 'Active', count: pp.active, color: '#f97316' },
                { label: 'Denied', count: pp.denied, color: '#ef4444' },
                { label: 'Expired', count: pp.expired, color: '#475569' },
              ].map(row => (
                <div key={row.label} className="text-center p-2 rounded-lg" style={{ background: `${row.color}08` }}>
                  <div className="text-[18px] font-bold trend-count-up" style={{ color: row.color }}>
                    <AnimatedNumber value={row.count} />
                  </div>
                  <div className="text-[9px] text-white/20 uppercase tracking-wider">{row.label}</div>
                </div>
              ))}
            </div>
          </div>
          {pp.by_type.length > 0 && (
            <div className="pt-4 border-t border-white/[0.04] space-y-2">
              {pp.by_type.map((row, ti) => (
                <div key={row.type} className={`flex items-center justify-between py-1.5 trend-slide-in trend-stagger-${ti + 1}`}>
                  <span className="text-[11px] text-white/40 capitalize">{row.type.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-white/20 font-mono">{row.total}</span>
                    {row.accuracy !== null && (
                      <span className="text-[11px] font-mono font-semibold" style={{ color: row.accuracy >= 60 ? '#22c55e' : row.accuracy >= 40 ? '#eab308' : '#ef4444' }}>
                        {row.accuracy}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="trend-card trend-fade-up trend-stagger-8">
          <SectionHeader title="High-Confidence Predictions" subtitle="Active forecasts ≥70% probability" icon="⚠️" />
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 trend-scrollbar">
            {pp.high_confidence.length > 0 ? pp.high_confidence.map((pred, pi) => (
              <div key={pred.id} className={`p-3.5 rounded-xl border transition-all hover:border-white/[0.08] trend-slide-in trend-stagger-${Math.min(pi + 1, 10)}`}
                style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] text-white/60 flex-1 line-clamp-2 leading-relaxed">{pred.title}</span>
                  <span className="text-[14px] font-bold font-mono flex-shrink-0 trend-count-up"
                    style={{ color: (pred.probability as number) >= 0.85 ? '#ef4444' : '#f97316' }}>
                    {Math.round((pred.probability as number) * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {pred.region && <span className="text-[10px] text-white/20 px-2 py-0.5 rounded-md bg-white/[0.03]">{pred.region.replace(/_/g, ' ')}</span>}
                  <span className="text-[10px] text-white/15 capitalize">{pred.type.replace(/_/g, ' ')}</span>
                  {(pred.severity_if_true as number) >= 4 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold" style={{ background: '#ef444415', color: '#ef4444' }}>SEV {pred.severity_if_true}</span>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-[11px] text-white/15 py-8 text-center">No high-confidence predictions active</div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  8. COMPARATIVE ANALYSIS                                       */}
      {/* ============================================================= */}
      <div className="grid grid-cols-3 gap-4">
        <div className="trend-card trend-fade-up trend-stagger-8">
          <SectionHeader title="Week-over-Week" icon="📅" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="text-[10px] text-white/20 mb-1.5 uppercase tracking-wider">This Week</div>
              <div className="text-[24px] font-bold text-white tracking-tight trend-count-up"><AnimatedNumber value={ca.this_week.total} /></div>
              <div className="text-[11px] text-red-400/50 mt-0.5 font-mono">{ca.this_week.critical} critical</div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.03]">
              <div className="text-[10px] text-white/15 mb-1.5 uppercase tracking-wider">Last Week</div>
              <div className="text-[24px] font-bold text-white/40 tracking-tight trend-count-up"><AnimatedNumber value={ca.last_week.total} /></div>
              <div className="text-[11px] text-white/15 mt-0.5 font-mono">{ca.last_week.critical} critical</div>
            </div>
          </div>
          <div className="space-y-2 pt-3 border-t border-white/[0.04]">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-white/25">Weekly</span>
              <Delta value={ca.week_change_pct} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-white/25">Period ({days}d)</span>
              <Delta value={ca.period_change_pct} />
            </div>
          </div>
        </div>

        <div className="trend-card trend-fade-up trend-stagger-9">
          <SectionHeader title="Anomaly Detection" subtitle={`σ-threshold: ${ca.anomaly_threshold}/day`} icon="🔍" />
          <div className="text-[10px] text-white/15 mb-3 font-mono">μ={ca.mean_daily} · σ={ca.stddev_daily}</div>
          {ca.anomaly_days.length > 0 ? (
            <div className="space-y-1.5">
              {ca.anomaly_days.slice(0, 5).map((ad, ai2) => (
                <div key={ad.date} className={`flex items-center justify-between trend-table-row trend-slide-in trend-stagger-${ai2 + 1}`}>
                  <span className="text-[12px] text-white/50 font-mono">{ad.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/40 font-mono">{ad.count}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
                      style={{ background: '#ef444418', color: '#ef4444', boxShadow: '0 0 10px #ef444410' }}>
                      {ad.sigma}σ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-white/15 py-6 text-center">No anomalies detected</div>
          )}
        </div>

        <div className="trend-card trend-fade-up trend-stagger-10">
          <SectionHeader title="Regional Movement" subtitle="Largest changes vs prior period" icon="🌍" />
          <div className="space-y-1.5">
            {ca.region_comparison.slice(0, 6).map((rc, ri) => (
              <div key={rc.region} className={`flex items-center justify-between trend-table-row trend-slide-in trend-stagger-${ri + 1}`}>
                <span className="text-[11px] text-white/40 truncate max-w-[100px]">{rc.region.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/20 font-mono">{rc.prior}→{rc.current}</span>
                  <Delta value={rc.change_pct} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  9. EVENT VELOCITY                                             */}
      {/* ============================================================= */}
      <div className="trend-card trend-fade-up trend-stagger-10">
        <SectionHeader title="Event Velocity (48h)" subtitle="Hourly ingestion rate with σ-based anomaly detection" icon="⚡" />
        <div className="grid grid-cols-[1fr_180px] gap-6">
          <div>
            <div className="flex items-end gap-[2px]" style={{ height: 64 }}>
              {vp.hourly_velocity.map((h, hi) => {
                const max = Math.max(vp.peak_hourly, 1)
                const ht = Math.max(2, Math.round((h.count / max) * 64))
                const isAnomaly = h.count > vp.anomaly_threshold
                return (
                  <div key={h.hour} title={`${h.hour}: ${h.count} events`}
                    className="cursor-default rounded-t trend-bar-grow"
                    style={{
                      flex: 1, height: ht, minWidth: 2,
                      background: isAnomaly
                        ? 'linear-gradient(to top, #ef444460, #ef4444)'
                        : 'linear-gradient(to top, rgba(59,130,246,0.15), rgba(59,130,246,0.5))',
                      boxShadow: isAnomaly ? '0 0 8px #ef444430' : 'none',
                      animationDelay: `${hi * 8}ms`,
                    }} />
                )
              })}
            </div>
            <div className="flex items-center gap-5 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'rgba(59,130,246,0.5)' }} />
                <span className="text-[10px] text-white/25">Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-[3px] bg-red-500" />
                <span className="text-[10px] text-white/25">Anomaly ({">"}{Math.round(vp.anomaly_threshold)}/hr)</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Current Rate', value: vp.current_rate, unit: '/hr', color: '#3b82f6' },
              { label: 'Average', value: vp.avg_hourly, unit: '/hr', color: 'rgba(255,255,255,0.5)' },
              { label: 'Peak (48h)', value: vp.peak_hourly, unit: '/hr', color: '#f97316' },
            ].map((stat, si) => (
              <div key={stat.label} className={`trend-slide-in trend-stagger-${si + 1}`}>
                <div className="text-[10px] text-white/20 mb-0.5">{stat.label}</div>
                <div className="text-[20px] font-bold tracking-tight" style={{ color: stat.color }}>
                  <AnimatedNumber value={stat.value} /><span className="text-[11px] text-white/20 ml-1 font-normal">{stat.unit}</span>
                </div>
              </div>
            ))}
            {vp.anomalies.length > 0 && (
              <div className="text-[10px] px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: '#ef444412', color: '#ef4444' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 trend-pulse" />
                {vp.anomalies.length} spike{vp.anomalies.length > 1 ? 's' : ''} detected
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/*  FORECAST SIGNALS + COUNTRY RISK                               */}
      {/* ============================================================= */}
      <div className="grid grid-cols-2 gap-4">
        <div className="trend-card trend-fade-up trend-stagger-9">
          <SectionHeader title="Forecast Signals" subtitle="Active intelligence signals" icon="📡" />
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 trend-scrollbar">
            {data.forecast_signals.length > 0 ? data.forecast_signals.slice(0, 12).map((sig, si) => (
              <div key={si} className={`flex items-center justify-between trend-table-row trend-slide-in trend-stagger-${Math.min(si + 1, 10)}`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 trend-pulse"
                    style={{ background: SIGNAL_COLORS[sig.signal_type] ?? '#64748b', boxShadow: `0 0 6px ${SIGNAL_COLORS[sig.signal_type] ?? '#64748b'}40` }} />
                  <span className="text-[12px] text-white/40 font-mono font-semibold">{sig.country_code}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold"
                    style={{ background: `${SIGNAL_COLORS[sig.signal_type] ?? '#64748b'}12`, color: SIGNAL_COLORS[sig.signal_type] ?? '#64748b' }}>
                    {sig.signal_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-[11px] text-white/30 font-mono">{Math.round(sig.confidence * 100)}%</span>
              </div>
            )) : (
              <div className="text-[11px] text-white/15 py-6 text-center">No active forecast signals</div>
            )}
          </div>
        </div>

        <div className="trend-card trend-fade-up trend-stagger-10">
          <SectionHeader title="Country Risk Scores" subtitle="Composite risk assessment" icon="🛡️" />
          <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1 trend-scrollbar">
            {data.country_risks.map((cr, ci) => {
              const color = cr.risk_score >= 70 ? '#ef4444' : cr.risk_score >= 40 ? '#f97316' : cr.risk_score >= 20 ? '#eab308' : '#22c55e'
              const trendColor2 = cr.trend === 'rising' ? '#ef4444' : cr.trend === 'falling' ? '#22c55e' : '#475569'
              return (
                <div key={cr.country_code} className={`flex items-center justify-between trend-table-row trend-slide-in trend-stagger-${Math.min(ci + 1, 10)}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-white/50 font-mono font-semibold w-8">{cr.country_code}</span>
                    <div className="w-16 h-[5px] bg-white/[0.04] rounded-full overflow-hidden">
                      <div className="h-full rounded-full trend-width-grow" style={{ background: `linear-gradient(90deg, ${color}80, ${color})`, width: `${cr.risk_score}%`, animationDelay: `${ci * 50}ms` }} />
                    </div>
                    <span className="text-[12px] font-bold font-mono" style={{ color }}>{cr.risk_score}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/15 font-mono">{cr.event_count_7d}/7d</span>
                    <span className="text-[10px] font-semibold uppercase flex items-center gap-1" style={{ color: trendColor2 }}>
                      {cr.trend === 'rising' ? '▲' : cr.trend === 'falling' ? '▼' : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
            {data.country_risks.length === 0 && <div className="text-[11px] text-white/15 py-6 text-center">No country risk data</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
