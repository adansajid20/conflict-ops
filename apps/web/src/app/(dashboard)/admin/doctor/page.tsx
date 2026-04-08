'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, RefreshCw, Zap, Settings, Clock } from 'lucide-react'

type DoctorStatus = 'ok' | 'warn' | 'error'

type DoctorCheck = {
  name: string
  status: DoctorStatus
  value: number | string
  threshold: string
  message: string
  details?: Record<string, unknown>
}

type AutoAction = {
  id: string
  created_at: string
  resource_id: string | null
  metadata: Record<string, unknown>
}

type RunbookEntry = {
  pattern: string
  symptoms: string[]
  diagnosis: string
  recommended_action: string
  auto_healable: boolean
}

type DoctorRun = {
  checks: DoctorCheck[]
  actions: Array<{ action: string; target: string; status: string; message: string }>
  last_updated: string
}

const statusColors: Record<DoctorStatus, string> = {
  ok: '#22C55E',
  warn: '#F59E0B',
  error: '#EF4444',
}

function formatTimeAgo(value?: string | null): string {
  if (!value) return 'never'
  const diffMinutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  const hours = Math.floor(diffMinutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function normalize(text: string): string {
  return text.toLowerCase()
}

function findRecommendations(checks: DoctorCheck[], runbook: RunbookEntry[]): RunbookEntry[] {
  const badChecks = checks.filter((check) => check.status !== 'ok')
  const matched = runbook.filter((entry) => {
    const haystack = `${entry.pattern} ${entry.symptoms.join(' ')} ${entry.diagnosis}`.toLowerCase()
    return badChecks.some((check) => haystack.includes(normalize(check.name)) || normalize(check.message).split(' ').some((token) => token.length > 5 && haystack.includes(token)))
  })
  return matched.length > 0 ? matched : runbook.filter((entry) => entry.auto_healable).slice(0, Math.min(3, runbook.length))
}

export default function DoctorPage() {
  const [doctorRun, setDoctorRun] = useState<DoctorRun | null>(null)
  const [autoActions, setAutoActions] = useState<AutoAction[]>([])
  const [runbook, setRunbook] = useState<RunbookEntry[]>([])
  const [tab, setTab] = useState<'dashboard' | 'runbook'>('dashboard')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [doctorRes, runbookRes] = await Promise.all([
        fetch('/api/v1/admin/doctor', { cache: 'no-store' }),
        fetch('/api/v1/admin/doctor?runbook=true', { cache: 'no-store' }),
      ])
      const doctorJson = await doctorRes.json() as { success: boolean; data?: { last_run: DoctorRun | null; auto_actions: AutoAction[] }; error?: string }
      const runbookJson = await runbookRes.json() as { success: boolean; data?: RunbookEntry[]; error?: string }

      if (!doctorJson.success) throw new Error(doctorJson.error ?? 'Failed to load doctor data')
      if (!runbookJson.success) throw new Error(runbookJson.error ?? 'Failed to load runbook')

      setDoctorRun(doctorJson.data?.last_run ?? null)
      setAutoActions(doctorJson.data?.auto_actions ?? [])
      setRunbook(runbookJson.data ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load doctor dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => { void load() }, 30_000)
    return () => window.clearInterval(interval)
  }, [load])

  const runAction = useCallback(async (body: Record<string, unknown>) => {
    setRunning(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/admin/doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await response.json() as { success: boolean; data?: DoctorRun; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Doctor action failed')
      if (body['action'] === 'run_now' && json.data) {
        setDoctorRun(json.data)
      }
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Doctor action failed')
    } finally {
      setRunning(false)
    }
  }, [load])

  const recommendations = useMemo(() => findRecommendations(doctorRun?.checks ?? [], runbook), [doctorRun, runbook])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
      },
    },
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-7xl mx-auto"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="h-8 w-8 text-blue-400" />
              <h1 className="text-4xl md:text-5xl font-bold text-white">Doctor + Self-Healing</h1>
            </div>
            <p className="text-base text-white/60">
              Automated platform checks every 2 minutes. Last update: <span className="text-white">{formatTimeAgo(doctorRun?.last_updated ?? null)}</span>
            </p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void load()}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-white/[0.05] border border-white/10 text-white font-semibold hover:bg-white/[0.08] transition-all duration-200"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void runAction({ action: 'run_now' })}
              disabled={running}
              className="flex items-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all duration-200"
            >
              {running ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run Now
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto">

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-8 flex gap-3 border-b border-white/[0.05] pb-6"
      >
        {(['dashboard', 'runbook'] as const).map((value) => (
          <motion.button
            key={value}
            onClick={() => setTab(value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-lg font-semibold text-sm capitalize transition-all duration-200 ${
              tab === value
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {value}
          </motion.button>
        ))}
      </motion.div>

      {/* Error */}
      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 backdrop-blur-sm flex items-start gap-3"
        >
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </motion.div>
      ) : null}

      {/* Dashboard Tab */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={tab === 'dashboard' ? 'visible' : 'hidden'}
        className="space-y-8"
      >
        {tab === 'dashboard' && (
          <>
            {/* Health Checks */}
            <motion.div variants={containerVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {(doctorRun?.checks ?? []).map((check) => (
                <motion.div key={check.name} variants={itemVariants}>
                  <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/20">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{
                      background: `linear-gradient(135deg, ${statusColors[check.status]}15, ${statusColors[check.status]}05)`
                    }} />
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">{check.name}</h3>
                        <motion.span
                          animate={{ opacity: 1 }}
                          className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                          style={{ background: `${statusColors[check.status]}20`, color: statusColors[check.status] }}
                        >
                          {check.status}
                        </motion.span>
                      </div>

                      <div className="text-2xl font-bold text-white mb-1">{String(check.value)}</div>
                      <div className="text-xs text-white/40 mb-3">{check.threshold}</div>
                      <p className="text-sm text-white/60 mb-4">{check.message}</p>
                      <div className="text-xs text-white/30 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Updated {formatTimeAgo(doctorRun?.last_updated ?? null)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Recommendations and Controls */}
            <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
              {/* Recommendations */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                    Recommendations
                  </h3>

                  <div className="space-y-3">
                    {recommendations.map((entry) => (
                      <motion.div
                        key={entry.pattern}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4 hover:border-white/[0.15] hover:bg-white/[0.05] transition-all"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="font-medium text-white">{entry.pattern}</div>
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{
                            color: entry.auto_healable ? '#22C55E' : '#94A3B8',
                            background: entry.auto_healable ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)'
                          }}>
                            {entry.auto_healable ? 'Auto-heal' : 'Manual'}
                          </span>
                        </div>
                        <p className="text-sm text-white/60 mb-2">{entry.diagnosis}</p>
                        <p className="text-xs text-white/40">{entry.recommended_action}</p>
                      </motion.div>
                    ))}
                    {recommendations.length === 0 && (
                      <div className="text-center py-6 text-sm text-white/30 flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        All systems healthy. No recommendations.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual Controls */}
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Settings className="h-5 w-5 text-blue-400" />
                    Controls
                  </h3>

                  <div className="space-y-2">
                    {[
                      { action: 'safe_mode', label: 'Safe Mode', icon: '🛡️' },
                      { action: 'pause_heavy_lane', label: 'Pause Heavy', icon: '⏸️' },
                      { action: 'flush_cache', label: 'Flush Cache', icon: '🗑️' },
                      { action: 'open_circuit_breaker', label: 'Circuit Break', icon: '⚡' },
                    ].map((ctrl) => (
                      <motion.button
                        key={ctrl.action}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => void runAction({ action: ctrl.action, source: ctrl.action === 'open_circuit_breaker' ? 'gdelt' : undefined })}
                        disabled={running}
                        className="w-full flex items-center gap-2 px-4 py-3 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white text-sm font-medium hover:bg-white/[0.08] hover:border-white/[0.15] disabled:opacity-50 transition-all"
                      >
                        <span className="text-base">{ctrl.icon}</span>
                        {ctrl.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Auto-Actions Log */}
            <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-6">Auto-Actions Log</h3>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {autoActions.map((entry, index) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-medium text-white text-sm">{String(entry.metadata['action'] ?? 'auto_heal')}</div>
                        <div className="text-xs text-white/40">{formatTimeAgo(entry.created_at)}</div>
                      </div>
                      {entry.metadata['message'] ? (
                        <p className="text-xs text-white/60 mb-2">{String(entry.metadata['message'])}</p>
                      ) : null}
                      <p className="text-xs text-white/30">Target: <span className="text-white/50">{entry.resource_id ?? 'platform'}</span></p>
                    </motion.div>
                  ))}
                  {!loading && autoActions.length === 0 && (
                    <div className="text-center py-8 text-sm text-white/30 flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      No self-heal actions yet.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Runbook Tab */}
      {tab === 'runbook' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative z-10 p-8">
            <h2 className="text-lg font-semibold text-white mb-6">Doctor Runbook</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.05]">
                    <th className="px-6 py-4 text-left font-semibold">Pattern</th>
                    <th className="px-6 py-4 text-left font-semibold">Symptoms</th>
                    <th className="px-6 py-4 text-left font-semibold">Diagnosis</th>
                    <th className="px-6 py-4 text-left font-semibold">Recommended Action</th>
                    <th className="px-6 py-4 text-left font-semibold">Auto-Healable</th>
                  </tr>
                </thead>
                <tbody>
                  {runbook.map((entry, index) => (
                    <motion.tr
                      key={entry.pattern}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.01 }}
                      className="border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-white">{entry.pattern}</td>
                      <td className="px-6 py-4 text-white/60 text-xs">{entry.symptoms.join(', ')}</td>
                      <td className="px-6 py-4 text-white/60">{entry.diagnosis}</td>
                      <td className="px-6 py-4 text-white/60">{entry.recommended_action}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{
                          background: entry.auto_healable ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                          color: entry.auto_healable ? '#22C55E' : '#94A3B8'
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {entry.auto_healable ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 text-center text-sm text-white/30 flex items-center justify-center gap-2"
        >
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading doctor state…
        </motion.div>
      )}
      </div>
    </div>
  )
}
