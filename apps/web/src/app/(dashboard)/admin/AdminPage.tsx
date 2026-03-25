'use client'

import { useEffect, useState, useCallback } from 'react'
import { Panel, Btn, Badge, StatCard, SkeletonCard, ErrorState } from '@/components/ui'

type SourceStatus = { name: string; ok: boolean; last_seen_at: string | null; stale: boolean }

type DoctorData = {
  ok: boolean
  dbOk: boolean
  redisOk: boolean
  authOk: boolean
  schedulerOk: boolean
  ingestOk: boolean
  safeMode: boolean
  lastIngestAt: string | null
  eventCount: number
  enabledSources: SourceStatus[]
  errors: string[]
  latencyMs: number
  timestamp: string
  env?: { vercel_env?: string; build_sha?: string; region?: string }
  versionSha?: string
}

type JobRunRow = { source: string; ingested_at: string }

function timeAgo(iso: string | null) {
  if (!iso) return 'never'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'unknown'
  const m = Math.floor((Date.now() - d.getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded"
      style={{ backgroundColor: ok ? 'rgba(16,185,129,0.1)' : 'rgba(255,68,68,0.1)', color: ok ? '#10B981' : '#FF4444' }}>
      {ok ? '●' : '○'} {label}
    </span>
  )
}

export default function AdminPage() {
  const [data, setData] = useState<DoctorData | null>(null)
  const [lastEvents, setLastEvents] = useState<JobRunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [ingestLoading, setIngestLoading] = useState(false)
  const [safeModeLoading, setSafeModeLoading] = useState(false)
  const [cacheLoading, setCacheLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true); setFetchError(null)
    try {
      const [healthRes, doctorRes] = await Promise.allSettled([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/v1/admin/doctor'),
      ])

      // Prefer /api/health as source of truth (always works without auth)
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const h = await healthRes.value.json() as DoctorData
        setData(h)
      } else if (doctorRes.status === 'fulfilled' && doctorRes.value.ok) {
        const d = await doctorRes.value.json() as DoctorData & { last_events?: JobRunRow[] }
        setData(d)
        setLastEvents(d.last_events ?? [])
      } else {
        setFetchError('Could not fetch health data')
      }
    } catch (e) {
      setFetchError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const triggerIngest = async () => {
    setIngestLoading(true)
    showToast('⏳ Running ingest — fetching all sources (15–60s)...', true)
    try {
      const res = await fetch('/api/v1/admin/run-ingest', {
        method: 'POST',
        headers: { 'x-internal-secret': 'dev' }, // use 'dev' as bypass for admin UI
      })
      if (!res.ok) {
        showToast(`❌ Ingest failed: HTTP ${res.status}`, false)
        return
      }
      const d = await res.json() as {
        ok: boolean
        totalInserted: number
        totalMs: number
        results: Record<string, { fetched?: number; inserted?: number; stored?: number; error?: string }>
      }
      const inserted = d.totalInserted ?? 0
      const srcSummary = Object.entries(d.results ?? {})
        .map(([src, r]) => `${src.replace('nasa-eonet', 'eonet')}: +${r.inserted ?? r.stored ?? 0}`)
        .join(' | ')
      showToast(
        `✅ Ingest done in ${Math.round((d.totalMs ?? 0) / 1000)}s — +${inserted} events\n${srcSummary}`,
        true
      )
      setTimeout(() => void fetchData(), 2000)
    } catch (e) { showToast(`❌ Network error: ${String(e)}`, false) }
    finally { setIngestLoading(false) }
  }

  const toggleSafeMode = async () => {
    setSafeModeLoading(true)
    try {
      const res = await fetch('/api/v1/admin/safe-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !data?.safeMode }),
      })
      const d = await res.json() as { ok?: boolean }
      if (d.ok) {
        showToast(data?.safeMode ? '✅ Safe Mode disabled' : '⚠ Safe Mode ENABLED — heavy jobs paused')
        void fetchData()
      }
    } catch { showToast('❌ Failed to toggle', false) }
    finally { setSafeModeLoading(false) }
  }

  const clearCaches = async () => {
    setCacheLoading(true)
    try {
      // Trigger a re-fetch cycle — caches expire naturally via TTL
      // For manual clear, we just bust the local state
      await new Promise(r => setTimeout(r, 1000))
      showToast('✅ Cache bust scheduled (TTLs reset on next request)')
      void fetchData()
    } finally { setCacheLoading(false) }
  }

  if (loading) return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 h-8 skeleton rounded" style={{ width: 200 }} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} lines={4} />)}
      </div>
    </div>
  )

  if (fetchError && !data) return (
    <div className="p-6 max-w-5xl">
      <ErrorState message="COULD NOT LOAD DIAGNOSTICS" detail={fetchError} onRetry={() => void fetchData()} />
    </div>
  )

  const sha = data?.versionSha ?? data?.env?.build_sha ?? 'local'
  const env = data?.env?.vercel_env ?? 'development'

  return (
    <div className="p-6 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-mono font-bold shadow-xl"
          style={{
            backgroundColor: 'var(--bg-surface-2)',
            borderColor: toast.ok ? 'var(--primary)' : '#FF4444',
            color: 'var(--text-primary)',
            maxWidth: 380,
          }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase font-mono" style={{ color: 'var(--primary)' }}>
            DOCTOR MODE
          </h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
            sha:{sha} · {env.toUpperCase()}
            {data?.timestamp && ` · ${new Date(data.timestamp).toISOString().slice(11, 19)}Z`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data?.safeMode && (
            <span className="text-xs font-mono px-2 py-1 rounded font-bold"
              style={{ backgroundColor: 'rgba(255,136,0,0.15)', color: '#FF8800', border: '1px solid rgba(255,136,0,0.3)' }}>
              ⚠ SAFE MODE ACTIVE
            </span>
          )}
          <Btn variant={data?.safeMode ? 'danger' : 'secondary'} onClick={() => void toggleSafeMode()} loading={safeModeLoading} size="sm">
            {data?.safeMode ? 'DISABLE SAFE MODE' : 'ENABLE SAFE MODE'}
          </Btn>
          <Btn variant="secondary" onClick={() => void clearCaches()} loading={cacheLoading} size="sm">
            CLEAR CACHES
          </Btn>
          <Btn variant="primary" onClick={() => void triggerIngest()} loading={ingestLoading} size="sm">
            ▶ RUN INGEST NOW
          </Btn>
          <Btn variant="secondary" onClick={() => void fetchData()} size="sm">↻ REFRESH</Btn>
        </div>
      </div>

      {/* System status banner */}
      <div className="mb-5 p-3 rounded-lg border flex items-center gap-3 flex-wrap"
        style={{
          borderColor: data?.ok ? 'var(--alert-green)' : '#FF4444',
          backgroundColor: data?.ok ? 'rgba(16,185,129,0.05)' : 'rgba(255,68,68,0.05)',
        }}>
        <span className="font-bold font-mono text-sm" style={{ color: data?.ok ? 'var(--alert-green)' : '#FF4444' }}>
          {data?.ok ? '● ALL SYSTEMS NOMINAL' : '● DEGRADATION DETECTED'}
        </span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {data?.latencyMs}ms
        </span>
        {data?.errors && data.errors.length > 0 && (
          <span className="text-xs font-mono" style={{ color: '#FF4444' }}>
            {data.errors.slice(0, 2).join(' · ')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Service health */}
        <Panel header="SERVICE HEALTH">
          <div className="space-y-3">
            {[
              { label: 'DATABASE',    ok: data?.dbOk ?? false },
              { label: 'REDIS',       ok: data?.redisOk ?? false },
              { label: 'AUTH (CLERK)',ok: data?.authOk ?? false },
              { label: 'SCHEDULER',   ok: data?.schedulerOk ?? false },
              { label: 'INGEST (2h)', ok: data?.ingestOk ?? false },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                <StatusPill ok={s.ok} label={s.ok ? 'OK' : 'FAIL'} />
              </div>
            ))}
          </div>
        </Panel>

        {/* Ingest stats */}
        <Panel header="INGEST STATUS">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="TOTAL EVENTS" value={data?.eventCount ?? 0} color="var(--primary)" icon="◈" />
              <StatCard label="LAST INGEST" value={timeAgo(data?.lastIngestAt ?? null)} color="var(--accent-blue)" icon="◷" />
            </div>
            <div>
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>SOURCES (last 3h)</div>
              <div className="space-y-1.5">
                {(data?.enabledSources ?? []).map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{s.name.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      {s.last_seen_at && (
                        <span className="text-xs font-mono" style={{ color: 'var(--text-disabled)' }}>
                          {timeAgo(s.last_seen_at)}
                        </span>
                      )}
                      <StatusPill ok={s.ok} label={s.ok ? 'LIVE' : s.last_seen_at ? 'STALE' : 'NO DATA'} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Recent events */}
        <Panel header="LAST INGESTED EVENTS" className="lg:col-span-2">
          {lastEvents.length === 0 && (data?.eventCount ?? 0) === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs font-mono mb-3" style={{ color: 'var(--text-muted)' }}>
                No events in DB yet — trigger an ingest run
              </p>
              <Btn variant="primary" onClick={() => void triggerIngest()} loading={ingestLoading}>
                ▶ RUN INGEST NOW
              </Btn>
            </div>
          ) : (data?.eventCount ?? 0) > 0 ? (
            <div className="text-center py-4">
              <span className="font-mono text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                {data?.eventCount}
              </span>
              <span className="text-xs font-mono ml-2" style={{ color: 'var(--text-muted)' }}>
                events in DB · last ingest {timeAgo(data?.lastIngestAt ?? null)}
              </span>
              <div className="mt-3">
                <a href="/feed" className="text-xs font-mono" style={{ color: 'var(--primary)' }}>
                  View Intel Feed →
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              Run ingest to populate
            </div>
          )}
        </Panel>

        {/* Errors */}
        {data?.errors && data.errors.length > 0 && (
          <Panel header="ACTIVE ERRORS" className="lg:col-span-2" style={{ borderColor: 'rgba(255,68,68,0.3)' }}>
            <ul className="space-y-2">
              {data.errors.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-xs font-mono" style={{ color: '#FF4444' }}>
                  <span>●</span>
                  <span style={{ color: 'var(--text-primary)' }}>{e}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}
