'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface AlertItem {
  id: string
  title: string
  body?: string | null
  description?: string | null
  severity?: number | string | null
  channel?: string | null
  event_id?: string | null
  created_at: string
  read?: boolean | null
}

interface PIR {
  id: string
  name: string
  conditions?: Array<{ type: string; value: string | number }>
  active?: boolean
  last_triggered_at?: string | null
  priority?: number
  created_at?: string
}

interface UserRule {
  id: string
  name: string
  alert_type: string
  config: Record<string, unknown>
  channels?: string[]
  active?: boolean
  last_triggered?: string | null
  trigger_count?: number
  created_at?: string
}

type Filter = 'all' | 'critical' | 'high' | 'medium' | 'unread'
// Condition type removed — PIR creation moved to Settings

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
  '4': { label: 'Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  '3': { label: 'High', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' },
  '2': { label: 'Medium', color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
  '1': { label: 'Low', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
}
function getSev(value?: number | string | null) {
  const n = String(Math.min(4, Math.max(1, Number(value ?? 1))))
  return SEV_CONFIG[n] ?? SEV_CONFIG['1']!
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function AlertsPage() {
  // ── State ──
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [pirs, setPirs] = useState<PIR[]>([])
  const [rules, setRules] = useState<UserRule[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'pir' | 'rules'>('pir')
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // PIR form removed — creation is in Settings only

  // ── Data Loading ──
  const load = useCallback(async () => {
    try {
      const [alertsRes, pirRes, rulesRes] = await Promise.all([
        fetch('/api/v1/alerts?limit=200', { cache: 'no-store' }),
        fetch('/api/v1/pir', { cache: 'no-store' }),
        fetch('/api/v1/alerts?type=rules', { cache: 'no-store' }),
      ])
      const alertsJson = await alertsRes.json() as { data?: AlertItem[] }
      const pirJson = await pirRes.json() as { data?: PIR[] }
      const rulesJson = await rulesRes.json() as { data?: UserRule[] }
      setAlerts(alertsJson.data ?? [])
      setPirs(pirJson.data ?? [])
      setRules(rulesJson.data ?? [])
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
    return alerts.filter((a) => {
      if (filter === 'all') return true
      if (filter === 'unread') return !a.read
      const sev = Number(a.severity ?? 1)
      if (filter === 'critical') return sev >= 4
      if (filter === 'high') return sev >= 3
      if (filter === 'medium') return sev >= 2
      return true
    })
  }, [alerts, filter])

  const counts = useMemo(() => ({
    all: alerts.length,
    unread: alerts.filter(a => !a.read).length,
    critical: alerts.filter(a => Number(a.severity ?? 0) >= 4).length,
    high: alerts.filter(a => Number(a.severity ?? 0) >= 3).length,
    medium: alerts.filter(a => Number(a.severity ?? 0) >= 2).length,
  }), [alerts])

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

  const deletePir = async (id: string) => {
    setPirs(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/v1/pir?id=${id}`, { method: 'DELETE' })
  }

  const deleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/v1/alerts?id=${id}`, { method: 'DELETE' })
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex h-full" style={{ background: '#070B11' }}>

      {/* ════════════ LEFT — ALERT FEED ════════════ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.05]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h1 className="text-[15px] font-bold tracking-wide text-white">Alert Center</h1>
              {counts.unread > 0 && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {counts.unread} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void load()}
                className="text-[10px] text-white/30 hover:text-white/60 px-2 py-1 rounded-md hover:bg-white/[0.03] transition">
                ↻ Refresh
              </button>
              {counts.unread > 0 && (
                <button onClick={() => void markAllRead()}
                  className="text-[10px] text-blue-400/70 hover:text-blue-400 px-2.5 py-1 rounded-md hover:bg-blue-500/[0.06] border border-blue-500/10 transition">
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['all', 'critical', 'high', 'medium', 'unread'] as const).map((tab) => {
              const active = filter === tab
              const count = counts[tab]
              const tabColor = tab === 'critical' ? '#ef4444' : tab === 'high' ? '#f97316' : tab === 'medium' ? '#eab308' : tab === 'unread' ? '#a855f7' : '#3b82f6'
              return (
                <button key={tab} onClick={() => setFilter(tab)}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5"
                  style={{
                    background: active ? `${tabColor}12` : 'transparent',
                    color: active ? tabColor : 'rgba(255,255,255,0.3)',
                    border: active ? `1px solid ${tabColor}25` : '1px solid transparent',
                  }}>
                  {tab}
                  {count > 0 && (
                    <span className="text-[8px] px-1 py-0.5 rounded-md min-w-[16px] text-center"
                      style={{ background: active ? `${tabColor}20` : 'rgba(255,255,255,0.05)', color: active ? tabColor : 'rgba(255,255,255,0.25)' }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto cr-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="text-[13px] text-white/60 font-medium mb-1">No alerts</p>
              <p className="text-[11px] text-white/25 max-w-[240px]">
                {filter === 'all' ? 'Set up PIRs or alert rules to start receiving intelligence notifications.' : `No ${filter} alerts right now. Try a different filter.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {filtered.map((alert) => {
                const sev = getSev(alert.severity)
                const isExpanded = expandedId === alert.id
                const isUnread = !alert.read
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
                        {/* Severity dot */}
                        <div className="mt-1.5 flex-shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full" style={{
                            backgroundColor: sev.color,
                            boxShadow: isUnread ? `0 0 8px ${sev.color}60` : 'none',
                            opacity: isUnread ? 1 : 0.4,
                          }} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                              style={{ color: sev.color, background: sev.bg }}>{sev.label}</span>
                            {alert.channel && alert.channel !== 'in_app' && (
                              <span className="text-[8px] text-white/20 uppercase tracking-wider">{alert.channel}</span>
                            )}
                          </div>
                          <p className={`text-[12px] leading-snug ${isUnread ? 'text-white font-medium' : 'text-white/60'}`}>
                            {alert.title}
                          </p>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] text-white/20 font-mono">{timeAgo(alert.created_at)}</span>
                          <button onClick={(e) => { e.stopPropagation(); void dismissAlert(alert.id) }}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="mt-3 ml-5 pl-3 border-l-2 transition-all"
                          style={{ borderColor: `${sev.color}30` }}>
                          <p className="text-[11px] text-white/40 leading-relaxed">
                            {alert.body || alert.description || 'No additional details available for this alert.'}
                          </p>
                          <div className="flex items-center gap-3 mt-3">
                            {alert.event_id && (
                              <a href={`/feed?event=${alert.event_id}`}
                                className="text-[9px] text-blue-400/60 hover:text-blue-400 transition">
                                View source event →
                              </a>
                            )}
                            <span className="text-[9px] text-white/15 font-mono">ID: {alert.id.slice(0, 8)}</span>
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

        {/* Footer stats */}
        <div className="px-6 py-3 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-[9px] text-white/20">
            {filtered.length} of {alerts.length} alerts · Auto-refresh 30s
          </span>
          <span className="text-[9px] text-white/15 font-mono">
            {counts.critical > 0 && <span style={{ color: '#ef4444' }}>{counts.critical} critical</span>}
            {counts.critical > 0 && counts.high > counts.critical && ' · '}
            {counts.high > counts.critical && <span style={{ color: '#f97316' }}>{counts.high - counts.critical} high</span>}
          </span>
        </div>
      </div>

      {/* ════════════ RIGHT — CONFIGURATION SIDEBAR ════════════ */}
      <div className="w-[380px] flex-shrink-0 flex flex-col h-full bg-[#060A10]">

        {/* Configure Alerts CTA */}
        <div className="px-5 pt-5 pb-4">
          <a href="/settings/alerts"
            className="group flex items-center gap-3 w-full p-4 rounded-xl transition-all
              bg-gradient-to-r from-blue-600/10 to-indigo-600/10
              border border-blue-500/20 hover:border-blue-500/40
              hover:from-blue-600/15 hover:to-indigo-600/15">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0
              group-hover:bg-blue-500/25 transition-all">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-white group-hover:text-blue-300 transition">Configure Alerts</p>
              <p className="text-[10px] text-white/35 mt-0.5">Create and manage alert rules in Settings</p>
            </div>
            <svg className="w-4 h-4 text-white/20 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Sidebar header with tabs */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            {(['pir', 'rules'] as const).map(tab => (
              <button key={tab} onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all
                  ${sidebarTab === tab ? 'bg-white/[0.06] text-white shadow-sm' : 'text-white/30 hover:text-white/50'}`}>
                {tab === 'pir' ? 'Intel Requirements' : 'Alert Rules'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto cr-scrollbar p-5">

          {/* ── PIR TAB ── */}
          {sidebarTab === 'pir' && (
            <>
              {pirs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-white/40 mb-1">No PIRs configured</p>
                  <p className="text-[9px] text-white/20 max-w-[200px]">
                    Priority Intelligence Requirements help focus your alert pipeline on what matters most.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Active PIRs ({pirs.length})</p>
                  <div className="flex flex-col gap-2">
                    {pirs.map((pir) => (
                      <div key={pir.id} className="rounded-xl border border-indigo-500/10 bg-indigo-500/[0.03] p-3.5 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ background: pir.active !== false ? '#818cf8' : '#555' }} />
                              <p className="text-[11px] text-white font-semibold truncate">{pir.name}</p>
                            </div>
                            <p className="text-[9px] text-white/25 leading-relaxed">
                              {(pir.conditions ?? []).map(c => `${c.type}: ${c.value}`).join(' · ') || 'No conditions'}
                            </p>
                          </div>
                          <button onClick={() => void deletePir(pir.id)}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
                          <span className="text-[9px] text-white/20">
                            Last triggered: {pir.last_triggered_at ? timeAgo(pir.last_triggered_at) : 'never'}
                          </span>
                          <span className={`text-[8px] font-semibold uppercase tracking-wider ${pir.active !== false ? 'text-indigo-400' : 'text-white/20'}`}>
                            {pir.active !== false ? 'Active' : 'Paused'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── RULES TAB ── */}
          {sidebarTab === 'rules' && (
            <>
              {rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-white/40 mb-1">No alert rules configured</p>
                  <p className="text-[9px] text-white/20 max-w-[200px]">
                    Head to Settings to create alert rules that auto-match against incoming events.
                  </p>
                  <a href="/settings/alerts"
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/15 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Create Rule
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Active Rules ({rules.length})</p>
                    <a href="/settings/alerts"
                      className="text-[9px] text-blue-400/60 hover:text-blue-400 transition flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add Rule
                    </a>
                  </div>
                  {rules.map((rule) => (
                    <div key={rule.id} className="rounded-xl border border-cyan-500/10 bg-cyan-500/[0.03] p-3.5 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/15">
                              {rule.alert_type}
                            </span>
                            <p className="text-[11px] text-white font-semibold truncate">{rule.name}</p>
                          </div>
                          <p className="text-[9px] text-white/25">
                            Channels: {(rule.channels ?? ['in_app']).join(', ')} · Triggered {rule.trigger_count ?? 0}×
                          </p>
                        </div>
                        <button onClick={() => void deleteRule(rule.id)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
                        <span className="text-[9px] text-white/20">Last: {rule.last_triggered ? timeAgo(rule.last_triggered) : 'never'}</span>
                        <span className={`text-[8px] font-semibold uppercase tracking-wider ${rule.active !== false ? 'text-cyan-400' : 'text-white/20'}`}>
                          {rule.active !== false ? 'Active' : 'Paused'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="px-5 py-3 border-t border-white/[0.04]">
          <p className="text-[8px] text-white/15 text-center uppercase tracking-widest">
            {pirs.length} PIRs · {rules.length} Rules · Evaluated every 5min
          </p>
        </div>
      </div>
    </div>
  )
}
