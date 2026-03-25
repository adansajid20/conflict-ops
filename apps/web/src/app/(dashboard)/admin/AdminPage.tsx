'use client'

import { useEffect, useState, useCallback } from 'react'

type DoctorData = {
  ok: boolean
  checks: Record<string, { ok: boolean; latency_ms: number; detail?: string }>
  safe_mode: boolean
  last_events: Array<{ ingested_at: string; source: string }>
  source_counts_24h: Record<string, number>
  env: { vercel_env: string; build_sha: string; region: string }
  total_latency_ms: number
  timestamp: string
}

export default function AdminPage() {
  const [data, setData] = useState<DoctorData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ingestLoading, setIngestLoading] = useState(false)
  const [safeModeLoading, setSafeModeLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchDoctor = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/doctor')
      if (res.ok) setData(await res.json() as DoctorData)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchDoctor() }, [fetchDoctor])

  const handleIngestNow = async () => {
    setIngestLoading(true)
    try {
      const res = await fetch('/api/v1/admin/ingest-now', { method: 'POST' })
      const d = await res.json() as { ok?: boolean; message?: string; error?: string }
      showToast(d.ok ? `✅ ${d.message}` : `❌ ${d.error}`)
      if (d.ok) setTimeout(() => void fetchDoctor(), 5000)
    } catch { showToast('❌ Network error') }
    finally { setIngestLoading(false) }
  }

  const handleSafeMode = async (enabled: boolean) => {
    setSafeModeLoading(true)
    try {
      const res = await fetch('/api/v1/admin/safe-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const d = await res.json() as { ok?: boolean }
      if (d.ok) {
        showToast(enabled ? '⚠️ Safe Mode ENABLED — heavy jobs paused' : '✅ Safe Mode disabled')
        void fetchDoctor()
      }
    } catch { showToast('❌ Failed to toggle safe mode') }
    finally { setSafeModeLoading(false) }
  }

  if (loading) return (
    <div className="p-6 text-xs mono" style={{ color: 'var(--text-muted)' }}>
      RUNNING DIAGNOSTICS...
    </div>
  )

  return (
    <div className="p-6 max-w-5xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded border text-sm mono font-bold shadow-lg"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--primary)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--primary)' }}>
            DOCTOR MODE
          </h1>
          <p className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>
            SYSTEM DIAGNOSTICS — {data?.timestamp ? new Date(data.timestamp).toISOString().slice(0, 19) + 'Z' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          {/* Safe mode toggle */}
          <button
            onClick={() => void handleSafeMode(!data?.safe_mode)}
            disabled={safeModeLoading}
            className="px-4 py-2 rounded text-xs mono font-bold border transition-colors"
            style={{
              borderColor: data?.safe_mode ? '#FF4444' : 'var(--border)',
              color: data?.safe_mode ? '#FF4444' : 'var(--text-muted)',
              backgroundColor: data?.safe_mode ? 'rgba(255,68,68,0.1)' : 'transparent',
            }}>
            {data?.safe_mode ? '⚠ SAFE MODE ON' : '○ SAFE MODE OFF'}
          </button>
          <button
            onClick={() => void handleIngestNow()}
            disabled={ingestLoading}
            className="px-4 py-2 rounded text-xs mono font-bold"
            style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
            {ingestLoading ? 'TRIGGERING...' : '▶ RUN INGEST NOW'}
          </button>
          <button onClick={() => { setLoading(true); void fetchDoctor() }}
            className="px-4 py-2 rounded text-xs mono border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Safe mode banner */}
      {data?.safe_mode && (
        <div className="mb-6 p-4 rounded border" style={{ borderColor: '#FF4444', backgroundColor: 'rgba(255,68,68,0.05)' }}>
          <p className="text-sm mono font-bold" style={{ color: '#FF4444' }}>
            ⚠ SAFE MODE ACTIVE — Heavy processing paused. All reads from cache. Auto-expires in 1h.
          </p>
        </div>
      )}

      {/* Overall status */}
      <div className="mb-6 p-4 rounded border"
        style={{ borderColor: data?.ok ? 'var(--alert-green)' : '#FF4444', backgroundColor: data?.ok ? 'rgba(0,255,136,0.04)' : 'rgba(255,68,68,0.04)' }}>
        <span className="font-bold mono text-sm" style={{ color: data?.ok ? 'var(--alert-green)' : '#FF4444' }}>
          {data?.ok ? '● ALL SYSTEMS NOMINAL' : '● DEGRADATION DETECTED'} — {data?.total_latency_ms}ms
        </span>
        <span className="ml-4 text-xs mono" style={{ color: 'var(--text-muted)' }}>
          {data?.env.vercel_env?.toUpperCase()} · sha:{data?.env.build_sha} · {data?.env.region}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service checks */}
        <div className="rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="px-4 py-3 border-b text-xs mono tracking-widest" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            SERVICE HEALTH
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(data?.checks ?? {}).map(([service, check]) => (
              <div key={service} className="flex items-center justify-between">
                <div>
                  <span className="text-sm mono font-bold" style={{ color: 'var(--text-primary)' }}>
                    {service.toUpperCase()}
                  </span>
                  {check.detail && (
                    <span className="ml-2 text-xs mono" style={{ color: 'var(--text-muted)' }}>{check.detail}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs mono">
                  <span style={{ color: 'var(--text-muted)' }}>{check.latency_ms}ms</span>
                  <span style={{ color: check.ok ? 'var(--alert-green)' : '#FF4444' }}>
                    {check.ok ? '● OK' : '● FAIL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Source stats */}
        <div className="rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="px-4 py-3 border-b text-xs mono tracking-widest" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            SOURCE STATS — LAST 24H
          </div>
          <div className="p-4 space-y-3">
            {Object.keys(data?.source_counts_24h ?? {}).length === 0 ? (
              <p className="text-xs mono text-center py-4" style={{ color: 'var(--text-muted)' }}>
                No events in 24h — ingest may not have run yet
              </p>
            ) : (
              Object.entries(data?.source_counts_24h ?? {}).sort((a, b) => b[1] - a[1]).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className="text-sm mono" style={{ color: 'var(--text-primary)' }}>{source.toUpperCase()}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min((count / 50) * 80, 80)}px`, backgroundColor: 'var(--primary)' }} />
                    <span className="text-xs mono font-bold" style={{ color: 'var(--primary)' }}>{count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Last ingested events */}
        <div className="lg:col-span-2 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="px-4 py-3 border-b text-xs mono tracking-widest" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            LAST 5 INGESTED EVENTS
          </div>
          <div className="p-4">
            {(data?.last_events ?? []).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs mono mb-3" style={{ color: 'var(--text-muted)' }}>No events yet — run ingest to populate</p>
                <button onClick={() => void handleIngestNow()} disabled={ingestLoading}
                  className="px-6 py-2 rounded text-xs mono font-bold"
                  style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
                  ▶ RUN INGEST NOW
                </button>
              </div>
            ) : (
              <table className="w-full text-xs mono">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="text-left pb-2">SOURCE</th>
                    <th className="text-left pb-2">INGESTED AT</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.last_events.map((e, i) => (
                    <tr key={i} style={{ color: 'var(--text-primary)' }}>
                      <td className="py-1 pr-4">{e.source?.toUpperCase()}</td>
                      <td className="py-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(e.ingested_at).toISOString().replace('T', ' ').slice(0, 19) + 'Z'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
