'use client'

import { useEffect, useState, useMemo } from 'react'

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
const TREND_LABELS: Record<string, { label: string; color: string }> = {
  escalating: { label: 'Escalating', color: '#ef4444' },
  de_escalating: { label: 'De-escalating', color: '#22c55e' },
  stable: { label: 'Stable', color: '#64748b' },
}
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
/*  Micro-components                                                   */
/* ------------------------------------------------------------------ */
function Sparkline({ data, color = '#3b82f6', height = 28, width = 100 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length === 0) return null
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * width},${height - (v / max) * height}`).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function MiniBar({ values, max, colors }: { values: number[]; max: number; colors: string[] }) {
  return (
    <div className="flex items-end gap-px" style={{ height: 24 }}>
      {values.map((v, i) => (
        <div key={i} style={{ width: 3, height: Math.max(1, Math.round((v / Math.max(max, 1)) * 24)), background: colors[i % colors.length], borderRadius: 1 }} />
      ))}
    </div>
  )
}

function Delta({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-white/30 text-xs">—</span>
  const up = value > 0
  return (
    <span className={`text-xs font-medium ${up ? 'text-red-400' : 'text-emerald-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}{suffix}
    </span>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-[11px] text-white/30 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/[0.015] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.025] transition-colors ${className}`}>
      {children}
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ background: color, width: `${pct}%` }} />
    </div>
  )
}

function EscalationBadge({ level }: { level: number }) {
  const color = ESC_LEVEL_COLORS[Math.min(level, 5) - 1] ?? '#64748b'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}20`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
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
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/v1/trends?days=${days}`)
      .then(r => r.json())
      .then(d => { setData(d as TrendsData); setLoading(false) })
      .catch(() => setLoading(false))
  }, [days])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-white/40 text-sm">Loading intelligence trends…</span>
      </div>
    </div>
  )
  if (!data) return null

  const { command_strip: cs, daily_volume: dv, escalation_timeline: et, casualty_tracker: ct, attack_patterns: ap, attack_trend_lines: atl, region_threat_matrix: rtm, actor_intel: ai, prediction_panel: pp, comparative_analysis: ca, velocity_panel: vp } = data

  const trendInfo = TREND_LABELS[ca.trend] ?? { label: 'Stable', color: '#64748b' }

  return (
    <div className="space-y-5">
      {/* ============================================================= */}
      {/*  HEADER                                                        */}
      {/* ============================================================= */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">Intelligence Trends</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" style={{ background: `${trendInfo.color}20`, color: trendInfo.color }}>
              {trendInfo.label}
            </span>
          </div>
          <p className="text-[12px] text-white/30 mt-1">
            {cs.total_events.toLocaleString()} events · {days}-day window · Generated {new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-all ${days === d ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/[0.03] text-white/40 border border-white/[0.05] hover:text-white/60 hover:bg-white/[0.05]'}`}>
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
          { label: 'Total Events', value: cs.total_events.toLocaleString(), change: cs.events_change_pct, spark: cs.daily_sparkline, color: '#3b82f6' },
          { label: 'Fatalities', value: cs.total_fatalities.toLocaleString(), change: cs.fatalities_change_pct, spark: cs.fatality_sparkline, color: '#ef4444' },
          { label: 'Displacement Signals', value: cs.displacement_events.toLocaleString(), change: cs.displacement_change_pct, spark: null, color: '#a78bfa' },
          { label: 'Active Conflicts', value: cs.active_conflicts.toString(), change: null, spark: null, color: '#f97316' },
          { label: 'Escalation Index', value: cs.escalation_index.toFixed(2), change: cs.escalation_change_pct, spark: null, color: '#eab308' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <div className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-2">{kpi.label}</div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</div>
                {kpi.change !== null && <div className="mt-1"><Delta value={kpi.change} /></div>}
              </div>
              {kpi.spark && <Sparkline data={kpi.spark} color={kpi.color} />}
            </div>
          </Card>
        ))}
      </div>

      {/* ============================================================= */}
      {/*  2. ESCALATION TIMELINE + EVENT VOLUME                         */}
      {/* ============================================================= */}
      <div className="grid grid-cols-[1.5fr_1fr] gap-4">
        {/* Event Volume Chart */}
        <Card>
          <SectionHeader title="Event Volume by Severity" subtitle={`Daily breakdown over ${days} days`} />
          <div className="overflow-x-auto">
            <div className="flex items-end gap-0.5" style={{ height: 100, minWidth: Math.max(dv.length * 10, 200) }}>
              {dv.map(day => {
                const max = Math.max(...dv.map(d => d.total), 1)
                return (
                  <div key={day.date} title={`${day.date}: ${day.total} events, ${day.fatalities} fatalities`}
                    className="flex flex-col justify-end cursor-default" style={{ width: Math.max(Math.floor(600 / Math.max(dv.length, 1)), 4) }}>
                    {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                      const h = Math.round((day[sev] / max) * 100)
                      return h > 0 ? <div key={sev} style={{ height: h, background: SEV_COLORS[sev], borderRadius: 1 }} /> : null
                    })}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex gap-4 mt-3">
            {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
              <div key={sev} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: SEV_COLORS[sev] }} />
                <span className="text-[11px] text-white/40 capitalize">{sev}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Escalation Levels */}
        <Card>
          <SectionHeader title="Escalation Levels" subtitle="Active country monitoring" />
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
            {et.slice(0, 12).map(entry => (
              <div key={entry.country_code} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono text-white/70 w-7">{entry.country_code}</span>
                  <EscalationBadge level={entry.level} />
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div className="text-[11px] text-white/30">{entry.event_count} events</div>
                  {entry.fatality_estimate > 0 && (
                    <div className="text-[11px] text-red-400/70">{entry.fatality_estimate} est. fatalities</div>
                  )}
                  {entry.signals.length > 0 && entry.signals[0] && (
                    <span className="w-2 h-2 rounded-full" style={{ background: SIGNAL_COLORS[entry.signals[0]!.signal_type] ?? '#64748b' }}
                      title={entry.signals[0]!.signal_type} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ============================================================= */}
      {/*  3. CASUALTY & IMPACT TRACKER                                  */}
      {/* ============================================================= */}
      <Card>
        <SectionHeader title="Casualty & Impact Tracker" subtitle="Fatality estimates and humanitarian indicators from event data" />
        <div className="grid grid-cols-4 gap-5">
          {/* Fatality KPIs */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-3">Overview</div>
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold text-red-400">{ct.total_fatalities.toLocaleString()}</div>
                <div className="text-[11px] text-white/30">Est. fatalities ({days}d)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-purple-400">{ct.displacement_events}</div>
                <div className="text-[11px] text-white/30">Displacement signals</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-400">{ct.humanitarian_events}</div>
                <div className="text-[11px] text-white/30">Humanitarian reports</div>
              </div>
            </div>
          </div>

          {/* By Region */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-3">By Region</div>
            <div className="space-y-2">
              {ct.by_region.slice(0, 6).map(row => (
                <div key={row.region}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[11px] text-white/60 truncate max-w-[120px]">{row.region.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-red-400/70 font-mono">{row.count}</span>
                  </div>
                  <ProgressBar value={row.count} max={ct.by_region[0]?.count ?? 1} color="#ef4444" />
                </div>
              ))}
            </div>
          </div>

          {/* By Country */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-3">By Country</div>
            <div className="space-y-2">
              {ct.by_country.slice(0, 6).map(row => (
                <div key={row.country_code}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[11px] text-white/60 font-mono">{row.country_code}</span>
                    <span className="text-[11px] text-red-400/70 font-mono">{row.count}</span>
                  </div>
                  <ProgressBar value={row.count} max={ct.by_country[0]?.count ?? 1} color="#f97316" />
                </div>
              ))}
            </div>
          </div>

          {/* By Attack Type */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-3">By Attack Type</div>
            <div className="space-y-2">
              {ct.by_type.slice(0, 6).map(row => (
                <div key={row.event_type}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[11px] text-white/60 truncate max-w-[120px]">{EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}</span>
                    <span className="text-[11px] text-red-400/70 font-mono">{row.count}</span>
                  </div>
                  <ProgressBar value={row.count} max={ct.by_type[0]?.count ?? 1} color="#eab308" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fatality Timeline */}
        {ct.daily_fatalities.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/[0.05]">
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-3">Daily Fatality Estimates</div>
            <div className="flex items-end gap-0.5" style={{ height: 48 }}>
              {ct.daily_fatalities.map(d => {
                const max = Math.max(...ct.daily_fatalities.map(x => x.fatalities), 1)
                const h = Math.max(1, Math.round((d.fatalities / max) * 48))
                return (
                  <div key={d.date} title={`${d.date}: ${d.fatalities} fatalities`}
                    className="cursor-default rounded-t"
                    style={{ flex: 1, height: h, background: d.fatalities > 0 ? '#ef4444' : 'rgba(255,255,255,0.03)', minWidth: 2 }} />
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================= */}
      {/*  4. ATTACK PATTERN ANALYSIS                                    */}
      {/* ============================================================= */}
      <Card>
        <SectionHeader title="Attack Pattern Analysis" subtitle="Event type breakdown with trend comparison" />
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          {/* Table */}
          <div>
            <div className="grid grid-cols-[1fr_60px_60px_60px_70px_60px] gap-2 mb-2 text-[10px] uppercase tracking-wider text-white/25">
              <div>Type</div><div className="text-right">Count</div><div className="text-right">Critical</div>
              <div className="text-right">Fatal</div><div className="text-right">Countries</div><div className="text-right">Δ</div>
            </div>
            <div className="space-y-1">
              {ap.slice(0, 10).map(row => (
                <div key={row.event_type} className="grid grid-cols-[1fr_60px_60px_60px_70px_60px] gap-2 py-1.5 border-b border-white/[0.03] items-center">
                  <span className="text-[12px] text-white/70 truncate">{EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}</span>
                  <span className="text-[12px] text-white/60 text-right font-mono">{row.count}</span>
                  <span className="text-[12px] text-red-400/70 text-right font-mono">{row.critical}</span>
                  <span className="text-[12px] text-red-400/60 text-right font-mono">{row.fatalities}</span>
                  <span className="text-[12px] text-white/40 text-right font-mono">{row.countries_affected}</span>
                  <div className="text-right"><Delta value={row.change_pct} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Trend lines for top types */}
          <div className="space-y-4">
            <div className="text-[10px] uppercase tracking-wider text-white/25 mb-2">Trend Lines (Top Types)</div>
            {Object.entries(atl).slice(0, 4).map(([type, points]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-white/50">{EVENT_TYPE_LABELS[type] ?? type}</span>
                  <span className="text-[11px] text-white/30 font-mono">{points.reduce((s, p) => s + p.count, 0)}</span>
                </div>
                <Sparkline data={points.map(p => p.count)} color={type === 'armed_conflict' ? '#ef4444' : type === 'airstrike' ? '#f97316' : type === 'civil_unrest' ? '#eab308' : '#3b82f6'} width={280} height={24} />
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ============================================================= */}
      {/*  5. REGIONAL THREAT MATRIX                                     */}
      {/* ============================================================= */}
      <Card>
        <SectionHeader title="Regional Threat Matrix" subtitle="Multi-dimensional threat assessment by region" />
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[1fr_70px_70px_70px_70px_70px_70px_70px_80px] gap-2 mb-2 text-[10px] uppercase tracking-wider text-white/25">
            <div>Region</div><div className="text-right">Events</div><div className="text-right">Critical</div>
            <div className="text-right">Fatalities</div><div className="text-right">Escalation</div>
            <div className="text-right">Displace</div><div className="text-right">Types</div>
            <div className="text-right">Countries</div><div className="text-right">Threat Score</div>
          </div>
          <div className="space-y-0.5">
            {rtm.map(row => {
              const scoreColor = row.threat_score >= 70 ? '#ef4444' : row.threat_score >= 40 ? '#f97316' : row.threat_score >= 20 ? '#eab308' : '#22c55e'
              return (
                <div key={row.region} className="grid grid-cols-[1fr_70px_70px_70px_70px_70px_70px_70px_80px] gap-2 py-2 border-b border-white/[0.03] items-center hover:bg-white/[0.02] rounded">
                  <span className="text-[12px] text-white/70 truncate">{row.region.replace(/_/g, ' ')}</span>
                  <span className="text-[12px] text-white/60 text-right font-mono">{row.events}</span>
                  <span className="text-[12px] text-red-400/70 text-right font-mono">{row.critical}</span>
                  <span className="text-[12px] text-red-400/60 text-right font-mono">{row.fatalities}</span>
                  <span className="text-[12px] text-orange-400/60 text-right font-mono">{row.escalation_events}</span>
                  <span className="text-[12px] text-purple-400/60 text-right font-mono">{row.displacement_events}</span>
                  <span className="text-[12px] text-white/40 text-right font-mono">{row.attack_types}</span>
                  <span className="text-[12px] text-white/40 text-right font-mono">{row.countries}</span>
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-12 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: scoreColor, width: `${row.threat_score}%` }} />
                    </div>
                    <span className="text-[12px] font-bold font-mono" style={{ color: scoreColor }}>{row.threat_score}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* ============================================================= */}
      {/*  6. ACTOR INTELLIGENCE                                         */}
      {/* ============================================================= */}
      <Card>
        <SectionHeader title="Actor Intelligence" subtitle="Key actors extracted from event data — frequency, severity, regional activity" />
        <div className="grid grid-cols-[1fr_1fr] gap-6">
          {/* Top actors table */}
          <div>
            <div className="grid grid-cols-[1fr_55px_55px_55px_55px_50px] gap-2 mb-2 text-[10px] uppercase tracking-wider text-white/25">
              <div>Actor</div><div className="text-right">Events</div><div className="text-right">Sev</div>
              <div className="text-right">Fatal</div><div className="text-right">Regions</div><div className="text-right">Trend</div>
            </div>
            <div className="space-y-0.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
              {ai.slice(0, 15).map((actor, idx) => (
                <div key={actor.name} className="grid grid-cols-[1fr_55px_55px_55px_55px_50px] gap-2 py-1.5 border-b border-white/[0.03] items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-white/20 w-4 text-right flex-shrink-0">{idx + 1}</span>
                    <span className="text-[12px] text-white/70 truncate">{actor.name}</span>
                    {actor.event_types.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/30 flex-shrink-0">{actor.event_types[0]}</span>
                    )}
                  </div>
                  <span className="text-[12px] text-white/60 text-right font-mono">{actor.event_count}</span>
                  <span className="text-[12px] text-right font-mono" style={{ color: actor.avg_severity >= 4 ? '#ef4444' : actor.avg_severity >= 3 ? '#f97316' : '#eab308' }}>
                    {actor.avg_severity.toFixed(1)}
                  </span>
                  <span className="text-[12px] text-red-400/60 text-right font-mono">{actor.fatalities}</span>
                  <span className="text-[12px] text-white/40 text-right font-mono">{actor.regions.length}</span>
                  <div className="text-right"><Delta value={actor.trending} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Actor types & trending */}
          <div className="space-y-5">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/25 mb-3">Most Active Regions (Top Actors)</div>
              {(() => {
                const regionCounts = new Map<string, number>()
                for (const actor of ai.slice(0, 10)) {
                  for (const r of actor.regions) {
                    regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
                  }
                }
                return [...regionCounts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([region, count]) => (
                    <div key={region} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                      <span className="text-[11px] text-white/50">{region.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-white/30 font-mono">{count} actors</span>
                    </div>
                  ))
              })()}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/25 mb-3">Trending Actors</div>
              {ai.filter(a => a.trending > 50).slice(0, 5).map(actor => (
                <div key={actor.name} className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                  <span className="text-[12px] text-white/70">{actor.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-white/30 font-mono">{actor.event_count} events</span>
                    <Delta value={actor.trending} />
                  </div>
                </div>
              ))}
              {ai.filter(a => a.trending > 50).length === 0 && (
                <div className="text-[11px] text-white/20">No significant trending actors this period</div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================================= */}
      {/*  7. PREDICTION CORRELATION PANEL                               */}
      {/* ============================================================= */}
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <Card>
          <SectionHeader title="Prediction Accuracy" subtitle="Forecast vs actual outcomes" />
          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{pp.accuracy_pct != null ? `${pp.accuracy_pct}%` : 'N/A'}</div>
              <div className="text-[10px] text-white/25 mt-1 uppercase tracking-wider">Accuracy</div>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-3">
              {[
                { label: 'Confirmed', count: pp.confirmed, color: '#22c55e' },
                { label: 'Active', count: pp.active, color: '#f97316' },
                { label: 'Denied', count: pp.denied, color: '#ef4444' },
                { label: 'Expired', count: pp.expired, color: '#475569' },
              ].map(row => (
                <div key={row.label} className="text-center">
                  <div className="text-lg font-bold" style={{ color: row.color }}>{row.count}</div>
                  <div className="text-[10px] text-white/25">{row.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* By prediction type */}
          <div className="text-[10px] uppercase tracking-wider text-white/25 mb-2">By Type</div>
          <div className="space-y-2">
            {pp.by_type.map(row => (
              <div key={row.type} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-[11px] text-white/60 capitalize">{row.type.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-white/30 font-mono">{row.total} total</span>
                  {row.accuracy !== null && (
                    <span className="text-[11px] font-mono" style={{ color: row.accuracy >= 60 ? '#22c55e' : row.accuracy >= 40 ? '#eab308' : '#ef4444' }}>
                      {row.accuracy}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="High-Confidence Predictions" subtitle="Active forecasts with ≥70% confidence" />
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {pp.high_confidence.length > 0 ? pp.high_confidence.map(pred => (
              <div key={pred.id} className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.03]">
                <div className="flex items-start justify-between">
                  <span className="text-[12px] text-white/70 flex-1 mr-2 line-clamp-2">{pred.title}</span>
                  <span className="text-[12px] font-bold font-mono flex-shrink-0" style={{ color: (pred.probability as number) >= 0.85 ? '#ef4444' : '#f97316' }}>
                    {Math.round((pred.probability as number) * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {pred.region && <span className="text-[10px] text-white/25">{pred.region.replace(/_/g, ' ')}</span>}
                  <span className="text-[10px] text-white/20 capitalize">{pred.type.replace(/_/g, ' ')}</span>
                  {(pred.severity_if_true as number) >= 4 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Sev {pred.severity_if_true}</span>
                  )}
                </div>
              </div>
            )) : (
              <div className="text-[11px] text-white/20 py-4 text-center">No high-confidence predictions active</div>
            )}
          </div>
        </Card>
      </div>

      {/* ============================================================= */}
      {/*  8. COMPARATIVE ANALYSIS                                       */}
      {/* ============================================================= */}
      <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
        {/* Week-over-week */}
        <Card>
          <SectionHeader title="Week-over-Week" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-white/25 mb-1">This Week</div>
              <div className="text-2xl font-bold text-white">{ca.this_week.total}</div>
              <div className="text-[11px] text-red-400/60 mt-0.5">{ca.this_week.critical} critical</div>
            </div>
            <div>
              <div className="text-[10px] text-white/25 mb-1">Last Week</div>
              <div className="text-2xl font-bold text-white/50">{ca.last_week.total}</div>
              <div className="text-[11px] text-white/20 mt-0.5">{ca.last_week.critical} critical</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-[11px] text-white/30">Weekly change</span>
            <Delta value={ca.week_change_pct} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-white/30">Period change</span>
            <Delta value={ca.period_change_pct} />
          </div>
        </Card>

        {/* Anomaly Detection */}
        <Card>
          <SectionHeader title="Anomaly Detection" subtitle={`Threshold: ${ca.anomaly_threshold} events/day (μ=${ca.mean_daily}, σ=${ca.stddev_daily})`} />
          {ca.anomaly_days.length > 0 ? (
            <div className="space-y-2">
              {ca.anomaly_days.slice(0, 5).map(ad => (
                <div key={ad.date} className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                  <span className="text-[12px] text-white/60 font-mono">{ad.date}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/50 font-mono">{ad.count} events</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold">{ad.sigma}σ</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-white/20 py-4 text-center">No anomalies detected this period</div>
          )}
        </Card>

        {/* Regional Changes */}
        <Card>
          <SectionHeader title="Regional Movement" subtitle="Largest changes vs prior period" />
          <div className="space-y-2">
            {ca.region_comparison.slice(0, 6).map(rc => (
              <div key={rc.region} className="flex items-center justify-between py-1 border-b border-white/[0.03]">
                <span className="text-[11px] text-white/50 truncate max-w-[110px]">{rc.region.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/30 font-mono">{rc.prior} → {rc.current}</span>
                  <Delta value={rc.change_pct} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ============================================================= */}
      {/*  9. EVENT VELOCITY & ANOMALY DETECTION                         */}
      {/* ============================================================= */}
      <Card>
        <SectionHeader title="Event Velocity (48h)" subtitle="Hourly ingestion rate with anomaly flags" />
        <div className="grid grid-cols-[1fr_200px] gap-5">
          <div>
            <div className="flex items-end gap-px" style={{ height: 60 }}>
              {vp.hourly_velocity.map(h => {
                const max = Math.max(vp.peak_hourly, 1)
                const ht = Math.max(1, Math.round((h.count / max) * 60))
                const isAnomaly = h.count > vp.anomaly_threshold
                return (
                  <div key={h.hour} title={`${h.hour}: ${h.count} events`}
                    className="cursor-default rounded-t"
                    style={{ flex: 1, height: ht, background: isAnomaly ? '#ef4444' : 'rgba(59,130,246,0.4)', minWidth: 2 }} />
                )
              })}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500/40" />
                <span className="text-[10px] text-white/30">Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-[10px] text-white/30">Anomaly ({">"}{Math.round(vp.anomaly_threshold)}/hr)</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-white/25 mb-0.5">Current Rate</div>
              <div className="text-xl font-bold text-blue-400">{vp.current_rate}<span className="text-[11px] text-white/30 ml-1">/hr</span></div>
            </div>
            <div>
              <div className="text-[10px] text-white/25 mb-0.5">Average</div>
              <div className="text-lg font-bold text-white/60">{vp.avg_hourly}<span className="text-[11px] text-white/30 ml-1">/hr</span></div>
            </div>
            <div>
              <div className="text-[10px] text-white/25 mb-0.5">Peak (48h)</div>
              <div className="text-lg font-bold text-orange-400">{vp.peak_hourly}<span className="text-[11px] text-white/30 ml-1">/hr</span></div>
            </div>
            {vp.anomalies.length > 0 && (
              <div>
                <div className="text-[10px] text-red-400/70 mb-1">{vp.anomalies.length} spike{vp.anomalies.length > 1 ? 's' : ''} detected</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ============================================================= */}
      {/*  FORECAST SIGNALS & COUNTRY RISK                               */}
      {/* ============================================================= */}
      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <Card>
          <SectionHeader title="Forecast Signals" subtitle="Active intelligence signals" />
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
            {data.forecast_signals.length > 0 ? data.forecast_signals.slice(0, 12).map((sig, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: SIGNAL_COLORS[sig.signal_type] ?? '#64748b' }} />
                  <span className="text-[11px] text-white/50 font-mono">{sig.country_code}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium"
                    style={{ background: `${SIGNAL_COLORS[sig.signal_type] ?? '#64748b'}15`, color: SIGNAL_COLORS[sig.signal_type] ?? '#64748b' }}>
                    {sig.signal_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <span className="text-[11px] text-white/40 font-mono">{Math.round(sig.confidence * 100)}%</span>
              </div>
            )) : (
              <div className="text-[11px] text-white/20 py-4 text-center">No active forecast signals</div>
            )}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Country Risk Scores" subtitle="Composite risk assessment" />
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
            {data.country_risks.map(cr => {
              const color = cr.risk_score >= 70 ? '#ef4444' : cr.risk_score >= 40 ? '#f97316' : cr.risk_score >= 20 ? '#eab308' : '#22c55e'
              const trendColor = cr.trend === 'rising' ? '#ef4444' : cr.trend === 'falling' ? '#22c55e' : '#64748b'
              return (
                <div key={cr.country_code} className="flex items-center justify-between py-1.5 border-b border-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-white/60 font-mono w-7">{cr.country_code}</span>
                    <div className="w-16 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ background: color, width: `${cr.risk_score}%` }} />
                    </div>
                    <span className="text-[12px] font-bold font-mono" style={{ color }}>{cr.risk_score}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-white/25">{cr.event_count_7d} events/7d</span>
                    <span className="text-[10px] font-medium uppercase" style={{ color: trendColor }}>
                      {cr.trend === 'rising' ? '▲' : cr.trend === 'falling' ? '▼' : '—'} {cr.trend}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
