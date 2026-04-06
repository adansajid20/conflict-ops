'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

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

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-white">Doctor + Self-Healing</h1>
          <p className="mt-1 text-sm text-white/50">
            Automated platform checks every 2 minutes. Last update: {formatTimeAgo(doctorRun?.last_updated ?? null)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white">
            <span className="inline-flex items-center gap-2">Refresh</span>
          </button>
          <button
            onClick={() => void runAction({ action: 'run_now' })}
            disabled={running}
            className="rounded-lg px-3 py-2 text-sm font-medium bg-blue-500 text-white"
            style={{ opacity: running ? 0.7 : 1 }}
          >
            <span className="inline-flex items-center gap-2">{running ? 'Running…' : 'Run Now'}</span>
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {(['dashboard', 'runbook'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className="rounded-lg border px-3 py-2 text-sm capitalize border-white/[0.05] text-white"
            style={{
              background: tab === value ? 'rgba(59,130,246,0.12)' : 'transparent',
            }}
          >
            {value}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border px-4 py-3 text-sm border-red-500/35 text-red-300 bg-red-500/8">
          {error}
        </div>
      ) : null}

      {tab === 'dashboard' ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(doctorRun?.checks ?? []).map((check) => (
              <div key={check.name} className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">{check.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-xs uppercase" style={{ background: `${statusColors[check.status]}22`, color: statusColors[check.status] }}>{check.status}</span>
                </div>
                <div className="text-xl font-semibold text-white">{String(check.value)}</div>
                <div className="mt-1 text-xs text-white/30">{check.threshold}</div>
                <div className="mt-3 text-sm text-white/50">{check.message}</div>
                <div className="mt-3 text-xs text-white/30">Updated {formatTimeAgo(doctorRun?.last_updated ?? null)}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
              <div className="mb-4 text-sm font-semibold text-white">Recommendations</div>
              <div className="space-y-3">
                {recommendations.map((entry) => (
                  <div key={entry.pattern} className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{entry.pattern}</div>
                      <span className="text-xs" style={{ color: entry.auto_healable ? '#22C55E' : '#94A3B8' }}>{entry.auto_healable ? 'auto-healable' : 'manual'}</span>
                    </div>
                    <div className="mt-2 text-sm text-white/50">{entry.diagnosis}</div>
                    <div className="mt-2 text-xs text-white/30">{entry.recommended_action}</div>
                  </div>
                ))}
                {recommendations.length === 0 ? <div className="text-sm text-white/30">No recommendations right now. A rare moment of peace.</div> : null}
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
              <div className="mb-4 text-sm font-semibold text-white">Manual Controls</div>
              <div className="space-y-2">
                <button onClick={() => void runAction({ action: 'safe_mode', enabled: true })} disabled={running} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white">Activate Safe Mode</button>
                <button onClick={() => void runAction({ action: 'pause_heavy_lane' })} disabled={running} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white">Pause Heavy Lane</button>
                <button onClick={() => void runAction({ action: 'flush_cache' })} disabled={running} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white">Flush Cache</button>
                <button onClick={() => void runAction({ action: 'open_circuit_breaker', source: 'gdelt' })} disabled={running} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white">Open Circuit Breaker</button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
            <div className="mb-4 text-sm font-semibold text-white">Auto-actions log</div>
            <div className="space-y-3">
              {autoActions.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/[0.05] bg-white/[0.03] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-white">{String(entry.metadata['action'] ?? 'auto_heal')}</div>
                    <div className="text-xs text-white/30">{formatTimeAgo(entry.created_at)}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/50">{String(entry.metadata['message'] ?? '')}</div>
                  <div className="mt-1 text-xs text-white/30">Target: {entry.resource_id ?? 'platform'}</div>
                </div>
              ))}
              {!loading && autoActions.length === 0 ? <div className="text-sm text-white/30">No self-heal actions recorded yet.</div> : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30">
                  <th className="px-4 py-3 text-left">Pattern</th>
                  <th className="px-4 py-3 text-left">Symptoms</th>
                  <th className="px-4 py-3 text-left">Diagnosis</th>
                  <th className="px-4 py-3 text-left">Recommended action</th>
                  <th className="px-4 py-3 text-left">Auto-healable</th>
                </tr>
              </thead>
              <tbody>
                {runbook.map((entry) => (
                  <tr key={entry.pattern} className="border-t border-white/[0.05]">
                    <td className="px-4 py-3 font-medium text-white">{entry.pattern}</td>
                    <td className="px-4 py-3 text-white/50">{entry.symptoms.join(', ')}</td>
                    <td className="px-4 py-3 text-white/50">{entry.diagnosis}</td>
                    <td className="px-4 py-3 text-white/50">{entry.recommended_action}</td>
                    <td className="px-4 py-3"><span className="rounded-full px-2 py-0.5 text-xs" style={{ background: entry.auto_healable ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)', color: entry.auto_healable ? '#22C55E' : '#94A3B8' }}>{entry.auto_healable ? 'Yes' : 'No'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? <div className="mt-6 text-sm text-white/30">Loading doctor state…</div> : null}
    </div>
  )
}
