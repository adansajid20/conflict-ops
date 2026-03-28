'use client'

import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Database, RefreshCw, Server, Shield, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Health = any

function timeAgo(input?: string | null) {
  if (!input) return 'never'
  const d = Date.now() - new Date(input).getTime()
  const m = Math.floor(d / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ok ? '#22C55E' : '#EF4444' }} />
}

// Freshness badge
function FreshnessBadge({ lastIngestAt }: { lastIngestAt: string | null }) {
  if (!lastIngestAt) return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(100,116,139,0.2)', color: '#64748B' }}>Unknown</span>
  const mins = (Date.now() - new Date(lastIngestAt).getTime()) / 60000
  if (mins < 30) return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>Fresh</span>
  if (mins < 120) return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>Delayed</span>
  return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>Limited</span>
}

export default function DoctorPage() {
  const DatabaseIcon = Database as React.ElementType
  const ServerIcon = Server as React.ElementType
  const ShieldIcon = Shield as React.ElementType
  const ActivityIcon = Activity as React.ElementType
  const RefreshCwIcon = RefreshCw as React.ElementType
  const ToggleLeftIcon = ToggleLeft as React.ElementType
  const ToggleRightIcon = ToggleRight as React.ElementType
  const ChevronDownIcon = ChevronDown as React.ElementType
  const ChevronUpIcon = ChevronUp as React.ElementType
  const AlertTriangleIcon = AlertTriangle as React.ElementType

  const [health, setHealth] = useState<Health | null>(null)
  const [recentEvents, setRecentEvents] = useState<Health[]>([])
  const [ingestResult, setIngestResult] = useState<Health | null>(null)
  const [safeMode, setSafeMode] = useState(false)
  const [showIngestOutput, setShowIngestOutput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const [healthRes, eventsRes] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/v1/events?limit=10&window=24h', { cache: 'no-store' }),
      ])
      const h = await healthRes.json()
      const e = await eventsRes.json()
      setHealth(h)
      setSafeMode(h.safe_mode)
      setRecentEvents(e.data ?? [])
    } catch (err) {
      setError(String(err))
    }
  }

  useEffect(() => { void load() }, [])

  const runAction = async (url: string, body?: unknown, headers?: Record<string, string>) => {
    setLoading(true)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    return json
  }

  const internalSecret = process.env['NEXT_PUBLIC_INTERNAL_SECRET'] ?? 'codev1_3dc26d7b4fb024484b5d8a6d3a4887f0'

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            System Doctor
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
              Admin Only
            </span>
            {health && (
              <FreshnessBadge lastIngestAt={health.ingest?.last_success_at ?? null} />
            )}
          </div>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
        >
          <RefreshCwIcon size={14} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border px-4 py-3 flex items-center gap-2"
          style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#F87171' }}>
          <AlertTriangleIcon size={14} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Health cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        {[
          { icon: DatabaseIcon, label: 'Database', ok: !!health?.db_ok, meta: `${health?.latency_ms ?? 0}ms` },
          { icon: ServerIcon,   label: 'Redis',    ok: !!health?.redis_ok, meta: health?.redis_ok ? 'Connected' : 'Error' },
          { icon: ShieldIcon,   label: 'Auth',     ok: !!health?.auth_ok, meta: health?.auth_ok ? 'OK' : 'Missing key' },
          { icon: ActivityIcon, label: 'Ingest',   ok: !!health?.ingest?.ok, meta: `Last: ${timeAgo(health?.ingest?.last_success_at)}` },
        ].map((card, idx) => {
          const Icon = card.icon
          return (
            <div key={idx} className="rounded-xl border p-4"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <div className="mb-3 flex items-center justify-between">
                <Icon size={18} style={{ color: 'var(--primary)' }} />
                <StatusDot ok={card.ok} />
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{card.label}</div>
              <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{card.meta}</div>
            </div>
          )
        })}
      </div>

      {/* KPIs row */}
      {health && (
        <div className="grid gap-3 sm:grid-cols-3 mb-6">
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{health.events?.total?.toLocaleString() ?? '—'}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total events in DB</div>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{health.events?.inserted_24h?.toLocaleString() ?? '—'}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Inserted last 24h</div>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {health.ingest?.sources_live ?? '—'}/{health.ingest?.sources_total ?? '—'}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Sources live</div>
          </div>
        </div>
      )}

      {/* Source health table */}
      <div className="rounded-xl border mb-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Source Health
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last Seen</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {(health?.enabledSources ?? health?.sources?.detail ?? []).map((src: { name: string; ok: boolean; last_seen_at?: string | null }) => (
                <tr key={src.name} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                    {src.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <StatusDot ok={src.ok} />
                      <span style={{ color: src.ok ? '#22C55E' : '#EF4444' }}>{src.ok ? 'Live' : 'Stale'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {timeAgo(src.last_seen_at)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void runAction('/api/v1/admin/run-ingest', undefined, { 'x-internal-secret': internalSecret }).then(setIngestResult)}
                      className="rounded border px-2 py-1 text-xs transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '' }}
                    >
                      Trigger
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual controls */}
      <div className="rounded-xl border p-4 mb-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Manual Controls</div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void runAction('/api/v1/admin/run-ingest', undefined, { 'x-internal-secret': internalSecret })
              .then((json) => { setIngestResult(json); setShowIngestOutput(true) })}
            className="rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            Run Full Ingest
          </button>
          <button
            onClick={() => void runAction('/api/v1/admin/cleanup').then(setIngestResult)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            Run Cleanup
          </button>
          <button
            onClick={() => void runAction('/api/v1/admin/clear-cache').then(setIngestResult)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            Clear Cache
          </button>
          <button
            onClick={() => void runAction('/api/v1/admin/safe-mode', { enabled: !safeMode }).then(() => { setSafeMode(!safeMode); void load() })}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {safeMode ? <ToggleRightIcon size={18} /> : <ToggleLeftIcon size={18} />} Safe Mode {safeMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {ingestResult && (
          <div className="mt-4">
            <button
              onClick={() => setShowIngestOutput(v => !v)}
              className="inline-flex items-center gap-2 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              {showIngestOutput ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
              Output
            </button>
            {showIngestOutput && (
              <pre className="mt-3 overflow-auto rounded-lg p-4 text-xs" style={{ background: '#03130a', color: '#86EFAC', maxHeight: '300px' }}>
                {JSON.stringify(ingestResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Degraded reasons */}
      {health?.degraded_reasons?.length > 0 && (
        <div className="rounded-xl border p-4 mb-6" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: '#F59E0B' }}>⚠ Degraded</div>
          <ul className="text-xs space-y-1" style={{ color: '#F59E0B' }}>
            {health.degraded_reasons.map((r: string) => <li key={r}>· {r}</li>)}
          </ul>
        </div>
      )}

      {/* Recent events */}
      <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Recent Events (24h sample)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Sev</th>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Score</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event: Health) => (
                <tr key={event.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {event.source}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text-primary)' }}>
                    {String(event.title ?? '').slice(0, 60)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {event.severity ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {timeAgo(event.occurred_at)}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {event._relevance_score !== undefined ? event._relevance_score.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {loading && (
        <div className="mt-4 text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Running…
        </div>
      )}
    </div>
  )
}
