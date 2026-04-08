'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface AlertItem {
  id: string
  alert_id?: string | null
  title: string
  body?: string | null
  description?: string | null
  severity?: number | string | null
  channel?: string | null
  event_id?: string | null
  prediction_id?: string | null
  created_at: string
  read?: boolean | null
  ack_status?: string | null
  ack_at?: string | null
  ack_by?: string | null
  ack_note?: string | null
  dedupe_key?: string | null
  metadata?: Record<string, unknown> | null
}

interface UserRule {
  id: string
  name: string
  regions?: string[] | null
  severities?: string[] | null
  keywords?: string[] | null
  frequency?: string | null
  active?: boolean
  last_triggered_at?: string | null
  trigger_count?: number
  created_at?: string
  rule_definition?: Record<string, unknown> | null
  escalation_policy?: Record<string, unknown> | null
  delivery_email?: string | null
  delivery_webhook?: string | null
  tags?: string[] | null
}

interface AlertStats {
  total: number
  unread: number
  last_24h: number
  severity_breakdown: { critical: number; high: number; medium: number; low: number }
  hourly_rate: number
}

type Filter = 'all' | 'critical' | 'high' | 'medium' | 'unread'
type AckAction = 'acknowledged' | 'investigating' | 'resolved' | 'false_positive'

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function timeAgo(input?: string | null): string {
  if (!input) return '—'
  const diff = Math.max(0, Date.now() - new Date(input).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const SEV_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  '4': { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  '5': { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  '3': { label: 'HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' },
  '2': { label: 'MEDIUM', color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
  '1': { label: 'LOW', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
}

function getSev(value?: number | string | null) {
  const n = String(Math.min(5, Math.max(1, Number(value ?? 1))))
  return SEV_CONFIG[n] ?? SEV_CONFIG['1']!
}

const ACK_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pending', color: '#f59e0b', icon: '●' },
  acknowledged: { label: 'Acknowledged', color: '#3b82f6', icon: '✓' },
  investigating: { label: 'Investigating', color: '#a855f7', icon: '◎' },
  resolved: { label: 'Resolved', color: '#22c55e', icon: '✓✓' },
  false_positive: { label: 'False Positive', color: '#6b7280', icon: '✕' },
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [rules, setRules] = useState<UserRule[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ackNoteId, setAckNoteId] = useState<string | null>(null)
  const [ackNoteText, setAckNoteText] = useState('')
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data Loading ──
  const load = useCallback(async () => {
    try {
      const [alertsRes, rulesRes, statsRes] = await Promise.all([
        fetch('/api/v1/alerts?limit=300', { cache: 'no-store' }),
        fetch('/api/v1/alerts?type=rules', { cache: 'no-store' }),
        fetch('/api/v1/alerts?type=stats', { cache: 'no-store' }),
      ])
      const alertsJson = await alertsRes.json() as { data?: AlertItem[] }
      const rulesJson = await rulesRes.json() as { data?: UserRule[] }
      const statsJson = await statsRes.json() as { data?: AlertStats }
      setAlerts(alertsJson.data ?? [])
      setRules(rulesJson.data ?? [])
      setStats(statsJson.data ?? null)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    refreshRef.current = setInterval(() => void load(), 30000)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [load])

  // ── Filtering ──
  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filter === 'all') return true
      if (filter === 'unread') return !a.read
      const sev = Number(a.severity ?? 1)
      if (filter === 'critical') return sev >= 4
      if (filter === 'high') return sev === 3
      if (filter === 'medium') return sev === 2
      return true
    })
  }, [alerts, filter])

  const counts = useMemo(() => ({
    all: alerts.length,
    unread: alerts.filter(a => !a.read).length,
    critical: alerts.filter(a => Number(a.severity ?? 0) >= 4).length,
    high: alerts.filter(a => { const s = Number(a.severity ?? 0); return s === 3 }).length,
    medium: alerts.filter(a => { const s = Number(a.severity ?? 0); return s === 2 }).length,
  }), [alerts])

  // Group alerts by dedupe_key or alert_id for clustering
  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, AlertItem[]>()
    for (const alert of filtered) {
      const key = alert.alert_id ?? alert.id
      const existing = groups.get(key) ?? []
      existing.push(alert)
      groups.set(key, existing)
    }
    // Return as flat list but with group counts
    return filtered.map(alert => {
      const key = alert.alert_id ?? alert.id
      const group = groups.get(key) ?? [alert]
      return { ...alert, groupCount: group.length }
    })
  }, [filtered])

  // ── Actions ──
  const markRead = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
    await fetch('/api/v1/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alertIds: [id], read: true }) })
  }

  const markAllRead = async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    await fetch('/api/v1/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true, read: true }) })
  }

  const dismissAlert = async (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/v1/alerts?id=${id}`, { method: 'DELETE' })
  }

  const setAckStatus = async (id: string, status: AckAction, note?: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ack_status: status, ack_at: new Date().toISOString() } : a))
    const body: Record<string, unknown> = { alertIds: [id], ack_status: status }
    if (note) body.ack_note = note
    await fetch('/api/v1/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setAckNoteId(null)
    setAckNoteText('')
  }

  const deleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/v1/alerts?id=${id}`, { method: 'DELETE' })
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full" style={{ background: '#070B11' }}>

      {/* ════════════ STATS BAR ════════════ */}
      <div className="px-6 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-[16px] font-bold text-white tracking-tight">Alert Center</h1>
            <p className="text-[10px] text-white/25 mt-0.5">Intelligence alerting & acknowledgment</p>
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="flex items-center gap-3 ml-auto">
              <StatCard label="24h Alerts" value={stats.last_24h} color="#3b82f6" />
              <StatCard label="Unread" value={stats.unread} color={stats.unread > 0 ? '#ef4444' : '#22c55e'} pulse={stats.unread > 0} />
              <StatCard label="Critical" value={stats.severity_breakdown.critical} color="#ef4444" />
              <StatCard label="Rate/hr" value={stats.hourly_rate} color="#a855f7" />
            </div>
          )}
        </div>
      </div>

      {/* ════════════ MAIN LAYOUT ════════════ */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* ════════════ LEFT — ALERT FEED ════════════ */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.05] min-h-[50vh] lg:min-h-0">

          {/* Filter bar */}
          <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.04]">
            <div className="flex gap-1">
              {(['all', 'critical', 'high', 'medium', 'unread'] as const).map(tab => {
                const active = filter === tab
                const count = counts[tab]
                const tabColor = tab === 'critical' ? '#ef4444' : tab === 'high' ? '#f97316' : tab === 'medium' ? '#eab308' : tab === 'unread' ? '#a855f7' : '#3b82f6'
                return (
                  <button key={tab} onClick={() => setFilter(tab)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5"
                    style={{
                      background: active ? `${tabColor}12` : 'transparent',
                      color: active ? tabColor : 'rgba(255,255,255,0.25)',
                      border: active ? `1px solid ${tabColor}25` : '1px solid transparent',
                    }}>
                    {tab}
                    {count > 0 && (
                      <span className="text-[8px] px-1 py-0.5 rounded-md min-w-[16px] text-center"
                        style={{ background: active ? `${tabColor}20` : 'rgba(255,255,255,0.04)', color: active ? tabColor : 'rgba(255,255,255,0.2)' }}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void load()} className="text-[10px] text-white/25 hover:text-white/50 px-2 py-1 rounded-md hover:bg-white/[0.03] transition">↻</button>
              {counts.unread > 0 && (
                <button onClick={() => void markAllRead()}
                  className="text-[10px] text-blue-400/60 hover:text-blue-400 px-2 py-1 rounded-md hover:bg-blue-500/[0.06] border border-blue-500/10 transition">
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Alert list */}
          <div className="flex-1 overflow-y-auto cr-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : groupedAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <p className="text-[13px] text-white/60 font-medium mb-1">All clear</p>
                <p className="text-[11px] text-white/25 max-w-[260px]">
                  {filter === 'all' ? 'Configure alert rules in Settings to start receiving intelligence notifications.' : `No ${filter} alerts right now.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {groupedAlerts.map(alert => {
                  const sev = getSev(alert.severity)
                  const isExpanded = expandedId === alert.id
                  const isUnread = !alert.read
                  const ackInfo = ACK_CONFIG[alert.ack_status ?? 'pending'] ?? ACK_CONFIG.pending!
                  const meta = alert.metadata as Record<string, unknown> | null
                  const matchedCount = (meta?.matched_count as number) ?? 0
                  const triggerReason = (meta?.trigger_reason as string) ?? ''

                  return (
                    <div key={alert.id}
                      className="group relative cursor-pointer transition-colors hover:bg-white/[0.015]"
                      style={{ borderLeft: `3px solid ${isUnread ? sev.color : 'transparent'}` }}
                      onClick={() => {
                        setExpandedId(prev => prev === alert.id ? null : alert.id)
                        if (isUnread) void markRead(alert.id)
                      }}>
                      <div className="px-5 py-3.5">
                        {/* Main row */}
                        <div className="flex items-start gap-3">
                          <div className="mt-1.5 flex-shrink-0">
                            <div className="w-2.5 h-2.5 rounded-full" style={{
                              backgroundColor: sev.color,
                              boxShadow: isUnread ? `0 0 8px ${sev.color}60` : 'none',
                              opacity: isUnread ? 1 : 0.4,
                            }} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                                style={{ color: sev.color, background: sev.bg }}>{sev.label}</span>
                              {/* Ack status badge */}
                              {alert.ack_status && alert.ack_status !== 'pending' && (
                                <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                                  style={{ color: ackInfo.color, borderColor: `${ackInfo.color}40`, background: `${ackInfo.color}10` }}>
                                  {ackInfo.icon} {ackInfo.label}
                                </span>
                              )}
                              {/* Trigger reason badge */}
                              {triggerReason === 'escalation_change' && (
                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/15">
                                  ESCALATION
                                </span>
                              )}
                              {/* Matched count */}
                              {matchedCount > 1 && (
                                <span className="text-[8px] text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded">
                                  {matchedCount} events
                                </span>
                              )}
                              {alert.channel && alert.channel !== 'in_app' && (
                                <span className="text-[8px] text-white/15 uppercase tracking-wider">{alert.channel}</span>
                              )}
                            </div>
                            <p className={`text-[12px] leading-snug ${isUnread ? 'text-white font-medium' : 'text-white/60'}`}>
                              {alert.title}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-white/15 font-mono">{timeAgo(alert.created_at)}</span>
                            <button onClick={e => { e.stopPropagation(); void dismissAlert(alert.id) }}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Expanded detail + acknowledgment */}
                        {isExpanded && (
                          <div className="mt-3 ml-5 pl-3 border-l-2 transition-all" style={{ borderColor: `${sev.color}30` }}>
                            <p className="text-[11px] text-white/40 leading-relaxed mb-3">
                              {alert.body || alert.description || 'No additional details available.'}
                            </p>

                            {/* Acknowledgment actions */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <span className="text-[9px] text-white/20 uppercase tracking-wider mr-1">Acknowledge:</span>
                              {(['acknowledged', 'investigating', 'resolved', 'false_positive'] as AckAction[]).map(action => {
                                const cfg = ACK_CONFIG[action]!
                                const isActive = alert.ack_status === action
                                return (
                                  <button key={action}
                                    onClick={e => { e.stopPropagation(); void setAckStatus(alert.id, action) }}
                                    className={`text-[9px] font-medium px-2 py-1 rounded-md border transition-all ${
                                      isActive
                                        ? 'opacity-100'
                                        : 'opacity-60 hover:opacity-100'
                                    }`}
                                    style={{
                                      color: cfg.color,
                                      borderColor: isActive ? cfg.color : `${cfg.color}30`,
                                      background: isActive ? `${cfg.color}15` : 'transparent',
                                    }}>
                                    {cfg.icon} {cfg.label}
                                  </button>
                                )
                              })}
                            </div>

                            {/* Ack note */}
                            {ackNoteId === alert.id ? (
                              <div className="flex items-center gap-2 mb-3" onClick={e => e.stopPropagation()}>
                                <input value={ackNoteText} onChange={e => setAckNoteText(e.target.value)}
                                  placeholder="Add a note..."
                                  className="flex-1 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] text-white placeholder:text-white/15"
                                  onKeyDown={e => { if (e.key === 'Enter') void setAckStatus(alert.id, (alert.ack_status as AckAction) ?? 'acknowledged', ackNoteText) }}
                                />
                                <button onClick={() => void setAckStatus(alert.id, (alert.ack_status as AckAction) ?? 'acknowledged', ackNoteText)}
                                  className="text-[9px] text-blue-400 hover:text-blue-300">Save</button>
                              </div>
                            ) : (
                              <button onClick={e => { e.stopPropagation(); setAckNoteId(alert.id); setAckNoteText(alert.ack_note ?? '') }}
                                className="text-[9px] text-white/20 hover:text-white/40 mb-3 transition">
                                {alert.ack_note ? `Note: ${alert.ack_note}` : '+ Add note'}
                              </button>
                            )}

                            {/* Links */}
                            <div className="flex items-center gap-3">
                              {alert.event_id && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    sessionStorage.setItem('cr_open_event', alert.event_id!)
                                    window.location.href = '/feed'
                                  }}
                                  className="text-[9px] text-blue-400/60 hover:text-blue-400 transition">
                                  View source event →
                                </button>
                              )}
                              {alert.ack_at && (
                                <span className="text-[9px] text-white/15">Ack&apos;d {timeAgo(alert.ack_at)}</span>
                              )}
                              <span className="text-[9px] text-white/10 font-mono ml-auto">{alert.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-[9px] text-white/15">
              {filtered.length} of {alerts.length} alerts · Auto-refresh 30s
            </span>
            <span className="text-[9px] text-white/10 font-mono">
              {counts.critical > 0 && <span style={{ color: '#ef4444' }}>{counts.critical}C</span>}
              {counts.critical > 0 && ' · '}
              {counts.high > counts.critical && <span style={{ color: '#f97316' }}>{counts.high - counts.critical}H</span>}
            </span>
          </div>
        </div>

        {/* ════════════ RIGHT — RULES & INSIGHTS SIDEBAR ════════════ */}
        <div className="w-full lg:w-[400px] flex-shrink-0 flex flex-col lg:h-full bg-[#060A10]">

          {/* Configure CTA */}
          <div className="px-5 pt-5 pb-4">
            <a href="/settings/alerts"
              className="group flex items-center gap-3 w-full p-4 rounded-xl transition-all
                bg-gradient-to-r from-blue-600/10 to-indigo-600/10
                border border-blue-500/20 hover:border-blue-500/40
                hover:from-blue-600/15 hover:to-indigo-600/15">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0
                group-hover:bg-blue-500/25 transition-all">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-white group-hover:text-blue-300 transition">Create Alert Rule</p>
                <p className="text-[10px] text-white/35 mt-0.5">Simple · Advanced · Expert modes</p>
              </div>
              <svg className="w-4 h-4 text-white/20 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </a>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* Severity breakdown mini chart */}
          {stats && stats.last_24h > 0 && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">24h Breakdown</p>
              <div className="flex gap-1.5 h-2 rounded-full overflow-hidden bg-white/[0.03]">
                {stats.severity_breakdown.critical > 0 && (
                  <div className="bg-red-500/60 rounded-full transition-all" style={{ flex: stats.severity_breakdown.critical }} />
                )}
                {stats.severity_breakdown.high > 0 && (
                  <div className="bg-orange-500/60 rounded-full transition-all" style={{ flex: stats.severity_breakdown.high }} />
                )}
                {stats.severity_breakdown.medium > 0 && (
                  <div className="bg-yellow-500/60 rounded-full transition-all" style={{ flex: stats.severity_breakdown.medium }} />
                )}
                {stats.severity_breakdown.low > 0 && (
                  <div className="bg-blue-500/60 rounded-full transition-all" style={{ flex: stats.severity_breakdown.low }} />
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3 text-[9px]">
                  <span style={{ color: '#ef4444' }}>{stats.severity_breakdown.critical} crit</span>
                  <span style={{ color: '#f97316' }}>{stats.severity_breakdown.high} high</span>
                  <span style={{ color: '#eab308' }}>{stats.severity_breakdown.medium} med</span>
                  <span style={{ color: '#3b82f6' }}>{stats.severity_breakdown.low} low</span>
                </div>
              </div>
            </div>
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          {/* Active rules */}
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
              Active Rules ({rules.filter(r => r.active !== false).length}/{rules.length})
            </p>
          </div>

          <div className="flex-1 overflow-y-auto cr-scrollbar px-5 pb-5">
            {rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-[12px] text-white/50 font-medium mb-1">No rules configured</p>
                <p className="text-[10px] text-white/20 max-w-[220px] leading-relaxed">
                  Create your first rule to start receiving intelligence alerts with acknowledgment tracking.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 mt-2">
                {rules.map(rule => {
                  const r = rule as unknown as Record<string, unknown>
                  const regions = (r.regions as string[]) ?? []
                  const severities = (r.severities as string[]) ?? []
                  const keywords = (r.keywords as string[]) ?? []
                  const tags = (r.tags as string[]) ?? []
                  const freq = (r.frequency as string) ?? 'instant'
                  const triggerCount = (r.trigger_count as number) ?? 0
                  const lastTriggered = (r.last_triggered_at as string) ?? null
                  const hasAdvanced = !!rule.rule_definition
                  const hasEscalation = !!rule.escalation_policy
                  const hasWebhook = !!rule.delivery_webhook

                  return (
                    <div key={rule.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 group hover:bg-white/[0.03] transition">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rule.active !== false ? '#22c55e' : '#555' }} />
                          <p className="text-[12px] text-white font-semibold truncate">{rule.name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[9px] text-white/20">{freq}</span>
                          {hasAdvanced && <span className="text-[7px] text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded">ADV</span>}
                          {hasEscalation && <span className="text-[7px] text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded">ESC</span>}
                          {hasWebhook && <span className="text-[7px] text-cyan-400 bg-cyan-500/10 px-1 py-0.5 rounded">WH</span>}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {severities.map(s => (
                          <span key={s} className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                            ${s === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                              : s === 'high' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/15'
                              : s === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/15'}`}>{s}</span>
                        ))}
                        {regions.map(reg => (
                          <span key={reg} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/35 border border-white/[0.06]">
                            {reg.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {keywords.map(k => (
                          <span key={k} className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/15">{k}</span>
                        ))}
                        {tags.map(t => (
                          <span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15">#{t}</span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                        <span className="text-[9px] text-white/20">
                          {triggerCount}× triggered · {lastTriggered ? timeAgo(lastTriggered) : 'never'}
                        </span>
                        <button onClick={() => void deleteRule(rule.id)}
                          className="opacity-0 group-hover:opacity-100 text-[9px] text-red-400/50 hover:text-red-400 transition">
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          <div className="px-5 py-2.5 border-t border-white/[0.04]">
            <p className="text-[8px] text-white/10 text-center uppercase tracking-widest">
              {rules.length} Rules · Engine v2 · 3min cycle
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════
function StatCard({ label, value, color, pulse }: { label: string; value: number; color: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02]">
      {pulse && <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />}
      <div>
        <div className="text-[14px] font-bold font-mono" style={{ color }}>{value}</div>
        <div className="text-[8px] text-white/20 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}
