'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, AlertTriangle, CheckCircle2, Clock, Mail, Webhook,
  Plus, X, Search, Filter, TrendingUp, Zap, MoreVertical,
} from 'lucide-react'

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
type StatusFilter = 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive'
type SortBy = 'newest' | 'severity' | 'status'
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

const SEV_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; glow: string }> = {
  '4': { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', glow: 'rgba(239,68,68,0.4)' },
  '5': { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', glow: 'rgba(239,68,68,0.4)' },
  '3': { label: 'HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', glow: 'rgba(249,115,22,0.4)' },
  '2': { label: 'MEDIUM', color: '#eab308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', glow: 'rgba(234,179,8,0.4)' },
  '1': { label: 'LOW', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', glow: 'rgba(59,130,246,0.4)' },
}

function getSev(value?: number | string | null) {
  const n = String(Math.min(5, Math.max(1, Number(value ?? 1))))
  return SEV_CONFIG[n] ?? SEV_CONFIG['1']!
}

const ACK_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'New', color: '#f59e0b', icon: '●' },
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
  const [severityFilter, setSeverityFilter] = useState<Filter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter | 'all'>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
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

  // ── Filtering & Sorting ──
  const filtered = useMemo(() => {
    let result = alerts.filter(a => {
      // Severity filter
      if (severityFilter !== 'all') {
        const sev = Number(a.severity ?? 1)
        if (severityFilter === 'critical' && sev < 4) return false
        if (severityFilter === 'high' && sev !== 3) return false
        if (severityFilter === 'medium' && sev !== 2) return false
        if (severityFilter === 'unread' && a.read) return false
      }
      // Status filter
      if (statusFilter !== 'all') {
        const status = a.ack_status ?? 'pending'
        if (statusFilter === 'new' && status !== 'pending') return false
        if (statusFilter !== 'new' && status !== statusFilter) return false
      }
      // Search
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        return a.title.toLowerCase().includes(search) ||
               (a.body?.toLowerCase() || '').includes(search) ||
               (a.channel?.toLowerCase() || '').includes(search)
      }
      return true
    })

    // Sort
    if (sortBy === 'severity') {
      result.sort((a, b) => Number(b.severity ?? 1) - Number(a.severity ?? 1))
    } else if (sortBy === 'status') {
      const statusOrder = ['pending', 'investigating', 'acknowledged', 'false_positive', 'resolved']
      result.sort((a, b) => statusOrder.indexOf(a.ack_status ?? 'pending') - statusOrder.indexOf(b.ack_status ?? 'pending'))
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    return result
  }, [alerts, severityFilter, statusFilter, searchTerm, sortBy])

  const counts = useMemo(() => ({
    all: alerts.length,
    unread: alerts.filter(a => !a.read).length,
    critical: alerts.filter(a => Number(a.severity ?? 0) >= 4).length,
    high: alerts.filter(a => Number(a.severity ?? 0) === 3).length,
    medium: alerts.filter(a => Number(a.severity ?? 0) === 2).length,
  }), [alerts])

  // ── Actions ──
  const markRead = async (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
    await fetch('/api/v1/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds: [id], read: true })
    })
  }

  const markAllRead = async () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
    await fetch('/api/v1/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true, read: true })
    })
  }

  const dismissAlert = async (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/v1/alerts?id=${id}`, { method: 'DELETE' })
  }

  const setAckStatus = async (id: string, status: AckAction, note?: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ack_status: status, ack_at: new Date().toISOString() } : a))
    const body: Record<string, unknown> = { alertIds: [id], ack_status: status }
    if (note) body.ack_note = note
    await fetch('/api/v1/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setAckNoteId(null)
    setAckNoteText('')
  }

  const deleteRule = async (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/v1/alerts?id=${id}`, { method: 'DELETE' })
  }

  const selected = filtered.find(a => a.id === selectedId)

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full" style={{ background: '#070B11' }}>

      {/* ════════════ TOP STATS BAR ════════════ */}
      <motion.div
        className="px-8 py-6 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <motion.h1
              className="text-2xl font-bold text-white tracking-tight"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              Alert Center
            </motion.h1>
            <motion.p
              className="text-xs text-white/40 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Real-time geopolitical intelligence & ACK tracking
            </motion.p>
          </div>
          <motion.button
            onClick={() => void load()}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Clock className="w-5 h-5" />
          </motion.button>
        </div>

        {/* 5-Card Stats Grid */}
        {stats && (
          <div className="grid grid-cols-5 gap-3">
            <StatCard
              icon={<Bell className="w-4 h-4" />}
              label="Total"
              value={stats.total}
              color="#3b82f6"
              trend={stats.last_24h}
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Unread"
              value={stats.unread}
              color={stats.unread > 0 ? '#ef4444' : '#22c55e'}
              trend={undefined}
            />
            <StatCard
              icon={<Zap className="w-4 h-4" />}
              label="Critical"
              value={stats.severity_breakdown.critical}
              color="#ef4444"
              trend={undefined}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Last 24h"
              value={stats.last_24h}
              color="#a855f7"
              trend={undefined}
            />
            <StatCard
              icon={<Clock className="w-4 h-4" />}
              label="Rate/hour"
              value={stats.hourly_rate}
              color="#06b6d4"
              trend={undefined}
            />
          </div>
        )}
      </motion.div>

      {/* ════════════ FILTER & SORT BAR ════════════ */}
      <motion.div
        className="px-8 py-4 border-b border-white/[0.06] bg-white/[0.01]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {/* Severity Chips */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Severity:</span>
          <div className="flex gap-2">
            {(['all', 'critical', 'high', 'medium', 'unread'] as const).map(sev => {
              const active = severityFilter === sev
              const count = sev === 'all' ? counts.all : counts[sev] ?? 0
              const colors = {
                all: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
                critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                high: { color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
                medium: { color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
                unread: { color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
              }
              const { color, bg } = colors[sev]

              return (
                <motion.button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className="relative px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all"
                  style={{
                    color: active ? color : 'rgba(255,255,255,0.3)',
                    background: active ? bg : 'transparent',
                    border: `1px solid ${active ? color + '40' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {sev}
                  {count > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-60">({count})</span>
                  )}
                  {active && (
                    <motion.div
                      className="absolute inset-0 rounded-lg"
                      style={{ border: `1px solid ${color}` }}
                      layoutId="severity-filter"
                      transition={{ type: 'spring' as const, bounce: 0.2 }}
                    />
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Status Chips */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-white/40 uppercase tracking-wider font-semibold">Status:</span>
          <div className="flex gap-2">
            {(['all', 'new', 'acknowledged', 'investigating', 'resolved', 'false_positive'] as const).map(st => {
              const active = statusFilter === st
              const colors = {
                all: { color: '#3b82f6' },
                new: { color: '#f59e0b' },
                acknowledged: { color: '#3b82f6' },
                investigating: { color: '#a855f7' },
                resolved: { color: '#22c55e' },
                false_positive: { color: '#6b7280' },
              }
              const { color } = colors[st]

              return (
                <motion.button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all"
                  style={{
                    color: active ? color : 'rgba(255,255,255,0.25)',
                    background: active ? color + '15' : 'transparent',
                    border: `1px solid ${active ? color + '40' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {st}
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Search & Sort */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.08] focus:border-white/[0.12] transition-all"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-semibold text-white focus:outline-none focus:bg-white/[0.08] focus:border-white/[0.12] transition-all"
            >
              <option value="newest">Newest</option>
              <option value="severity">By Severity</option>
              <option value="status">By Status</option>
            </select>

            {counts.unread > 0 && (
              <motion.button
                onClick={() => void markAllRead()}
                className="px-4 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-xs font-semibold text-blue-400 hover:bg-blue-500/25 hover:border-blue-500/50 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Mark all read
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ════════════ MAIN LAYOUT (2-COLUMN) ════════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ════════════ LEFT — ALERT LIST ════════════ */}
        <motion.div
          className="flex-1 flex flex-col min-h-0 border-r border-white/[0.06]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {/* Alert Cards */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <Bell className="w-8 h-8 text-blue-500/40" />
                </motion.div>
              </div>
            ) : filtered.length === 0 ? (
              <motion.div
                className="flex flex-col items-center justify-center h-full px-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-white/15" />
                </div>
                <p className="text-sm text-white/60 font-medium text-center">
                  {severityFilter === 'all' && statusFilter === 'all' && !searchTerm
                    ? 'All clear — no alerts'
                    : 'No alerts match your filters'}
                </p>
              </motion.div>
            ) : (
              <AnimatePresence>
                <div className="space-y-px">
                  {filtered.map((alert, idx) => {
                    const sev = getSev(alert.severity)
                    const isSelected = selectedId === alert.id
                    const isUnread = !alert.read
                    const ackInfo = ACK_CONFIG[alert.ack_status ?? 'pending'] ?? ACK_CONFIG.pending!

                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => {
                          setSelectedId(alert.id)
                          if (isUnread) void markRead(alert.id)
                        }}
                        className="group relative cursor-pointer transition-all"
                        style={{
                          background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                          borderLeft: `3px solid ${isUnread ? sev.color : 'transparent'}`,
                        }}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                      >
                        <div className="px-6 py-4">
                          <div className="flex items-start gap-4">
                            {/* Unread Dot */}
                            {isUnread && (
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                                style={{
                                  backgroundColor: sev.color,
                                  boxShadow: `0 0 12px ${sev.color}`,
                                }}
                              />
                            )}
                            {!isUnread && (
                              <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 bg-white/10" />
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span
                                  className="text-[11px] font-bold uppercase tracking-widest px-2 py-1 rounded-md"
                                  style={{ color: sev.color, background: sev.bg }}
                                >
                                  {sev.label}
                                </span>
                                {alert.ack_status && alert.ack_status !== 'pending' && (
                                  <span
                                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md border"
                                    style={{ color: ackInfo.color, borderColor: `${ackInfo.color}40`, background: `${ackInfo.color}10` }}
                                  >
                                    {ackInfo.icon} {ackInfo.label}
                                  </span>
                                )}
                                {alert.channel && alert.channel !== 'in_app' && (
                                  <span className="text-[9px] text-white/25 uppercase tracking-wider">
                                    {alert.channel}
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm leading-snug ${isUnread ? 'text-white font-semibold' : 'text-white/70'}`}>
                                {alert.title}
                              </p>
                              {alert.body && !isSelected && (
                                <p className="text-xs text-white/40 mt-1.5 line-clamp-2">
                                  {alert.body}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-white/30 font-mono whitespace-nowrap">
                                {timeAgo(alert.created_at)}
                              </span>
                              <motion.button
                                onClick={e => {
                                  e.stopPropagation()
                                  void dismissAlert(alert.id)
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <X className="w-4 h-4" />
                              </motion.button>
                            </div>
                          </div>

                          {/* Highlight bar for selected */}
                          {isSelected && (
                            <motion.div
                              className="absolute top-0 right-0 bottom-0 w-1 rounded-l-lg"
                              style={{ background: `linear-gradient(to bottom, ${sev.color}, ${sev.color}00)` }}
                              layoutId="selected-bar"
                              transition={{ type: 'spring' as const, bounce: 0.2 }}
                            />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </AnimatePresence>
            )}
          </div>

          {/* Footer */}
          <motion.div
            className="px-6 py-3 border-t border-white/[0.06] text-xs text-white/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-between">
              <span>{filtered.length} of {alerts.length} alerts</span>
              <span className="text-white/10">Auto-refresh: 30s</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ════════════ RIGHT — DETAIL PANEL ════════════ */}
        <AnimatePresence>
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              transition={{ type: 'spring' as const, bounce: 0.15, duration: 0.5 }}
              className="w-96 border-l border-white/[0.06] bg-gradient-to-b from-white/[0.02] to-transparent flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/[0.06]">
                <motion.button
                  onClick={() => setSelectedId(null)}
                  className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/80 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
                <h2 className="text-lg font-bold text-white pr-8">{selected.title}</h2>
              </div>

              {/* Body Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Metadata */}
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Details</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] text-white/30">Severity</p>
                      <span
                        className="inline-block text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-md mt-1"
                        style={{ color: getSev(selected.severity).color, background: getSev(selected.severity).bg }}
                      >
                        {getSev(selected.severity).label}
                      </span>
                    </div>
                    <div>
                      <p className="text-[11px] text-white/30">Channel</p>
                      <p className="text-sm text-white/70 mt-1">{selected.channel || 'In-App'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-white/30">Created</p>
                      <p className="text-sm text-white/70 mt-1">{new Date(selected.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Alert Body */}
                {selected.body && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Description</p>
                    <p className="text-sm leading-relaxed text-white/60">
                      {selected.body}
                    </p>
                  </div>
                )}

                {/* ACK Workflow */}
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-3">Acknowledge</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['acknowledged', 'investigating', 'resolved', 'false_positive'] as AckAction[]).map(action => {
                      const cfg = ACK_CONFIG[action]!
                      const isActive = selected.ack_status === action
                      return (
                        <motion.button
                          key={action}
                          onClick={() => void setAckStatus(selected.id, action)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-all"
                          style={{
                            color: cfg.color,
                            borderColor: isActive ? cfg.color : `${cfg.color}30`,
                            background: isActive ? `${cfg.color}15` : 'transparent',
                          }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {cfg.icon} {action.split('_').pop()}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                {/* ACK Note */}
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Note</p>
                  {ackNoteId === selected.id ? (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        value={ackNoteText}
                        onChange={e => setAckNoteText(e.target.value)}
                        placeholder="Add context..."
                        className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.05]"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            void setAckStatus(selected.id, (selected.ack_status as AckAction) ?? 'acknowledged', ackNoteText)
                          }
                        }}
                        autoFocus
                      />
                      <motion.button
                        onClick={() => void setAckStatus(selected.id, (selected.ack_status as AckAction) ?? 'acknowledged', ackNoteText)}
                        className="px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-xs font-semibold text-blue-400"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Save
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      onClick={() => {
                        setAckNoteId(selected.id)
                        setAckNoteText(selected.ack_note ?? '')
                      }}
                      className="text-xs text-white/30 hover:text-white/50 transition-colors"
                      whileHover={{ x: 2 }}
                    >
                      {selected.ack_note ? `📝 ${selected.ack_note}` : '+ Add note'}
                    </motion.button>
                  )}
                </div>

                {/* Related & Actions */}
                <div className="space-y-3">
                  {selected.event_id && (
                    <motion.button
                      onClick={() => {
                        sessionStorage.setItem('cr_open_event', selected.event_id!)
                        window.location.href = '/feed'
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 hover:bg-blue-500/15 transition-all"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      View source event
                    </motion.button>
                  )}

                  <motion.button
                    className="w-full px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-400 hover:bg-purple-500/15 transition-all"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    Create alert rule
                  </motion.button>
                </div>

                {/* ACK History */}
                {selected.ack_at && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">History</p>
                    <p className="text-xs text-white/50">
                      Acknowledged {timeAgo(selected.ack_at)} by {selected.ack_by || 'system'}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              className="w-96 border-l border-white/[0.06] flex flex-col items-center justify-center text-center px-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-white/15" />
              </div>
              <p className="text-sm text-white/40">Select an alert to view details</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ════════════ BOTTOM RULES PANEL ════════════ */}
      <motion.div
        className="border-t border-white/[0.06] bg-white/[0.01]"
        initial={{ height: 0 }}
        animate={{ height: showRules ? 'auto' : 0 }}
        transition={{ duration: 0.3 }}
        style={{ overflow: 'hidden' }}
      >
        <div className="max-h-[400px] overflow-y-auto">
          <div className="px-8 py-4">
            <h3 className="text-sm font-bold text-white mb-4">Active Rules</h3>
            {rules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-white/40">No alert rules configured</p>
                <a
                  href="/settings/alerts"
                  className="inline-block mt-3 px-4 py-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-xs font-semibold text-blue-400 hover:bg-blue-500/25 transition-all"
                >
                  Create rule
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {rules.map(rule => (
                  <motion.div
                    key={rule.id}
                    className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-all group"
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold text-white truncate flex-1">{rule.name}</p>
                      <motion.button
                        onClick={() => void deleteRule(rule.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-red-400 transition-all"
                        whileHover={{ scale: 1.1 }}
                      >
                        <X className="w-3 h-3" />
                      </motion.button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {rule.severities?.slice(0, 2).map(s => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">
                          {s}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Toggle Rules Panel */}
      <motion.button
        onClick={() => setShowRules(!showRules)}
        className="w-full px-6 py-2.5 border-t border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] text-xs text-white/40 hover:text-white/60 font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
        whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
      >
        {showRules ? '▼' : '▶'} Alert Rules ({rules.filter(r => r.active !== false).length})
      </motion.button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════
function StatCard({
  icon,
  label,
  value,
  color,
  trend
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  trend?: number
}) {
  return (
    <motion.div
      className="relative p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden group"
      whileHover={{
        scale: 1.02,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderColor: color + '40',
      }}
      transition={{ type: 'spring' as const, bounce: 0.2 }}
    >
      {/* Glow background */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(circle at center, ${color}10, transparent)`,
          filter: 'blur(20px)',
        }}
      />

      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <div style={{ color }}>
            {icon}
          </div>
          <p className="text-[11px] text-white/40 uppercase tracking-wider font-semibold">
            {label}
          </p>
        </div>

        <motion.div
          className="text-2xl font-bold font-mono"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <CountUp value={value} />
        </motion.div>

        {trend !== undefined && trend > 0 && (
          <p className="text-xs text-white/25">
            +{trend} this month
          </p>
        )}
      </div>
    </motion.div>
  )
}

// Animated counter
function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (count < value) {
      timeout = setTimeout(() => {
        const increment = Math.ceil((value - count) / 10)
        setCount(Math.min(count + increment, value))
      }, 30)
    }
    return () => clearTimeout(timeout)
  }, [count, value])

  return <>{count}</>
}
