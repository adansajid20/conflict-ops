export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'System Status — CONFLICT OPS',
  description: 'Real-time platform health and operational status for conflictradar.co',
}

type HealthData = {
  ok: boolean
  build_sha: string
  env: string
  db_ok: boolean
  auth_ok: boolean
  scheduler_ok: boolean
  redis_ok: boolean
  last_ingest_at: string | null
  event_count: number
  last_error: string | null
  latency_ms: number
  timestamp: string
}

async function getHealth(): Promise<HealthData | null> {
  try {
    const res = await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://conflictradar.co'}/api/health`, {
      cache: 'no-store',
    })
    return res.json()
  } catch {
    return null
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="mono text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: ok ? 'var(--alert-green)' : '#FF4444' }}
        />
        <span className="mono text-xs font-bold" style={{ color: ok ? 'var(--alert-green)' : '#FF4444' }}>
          {ok ? 'OPERATIONAL' : 'DEGRADED'}
        </span>
      </div>
    </div>
  )
}

export default async function StatusPage() {
  const health = await getHealth()

  const allOk = health ? health.db_ok && health.auth_ok && health.scheduler_ok : false

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-8">
          <a href="/landing" className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
            ← CONFLICT OPS
          </a>
        </div>

        <h1 className="text-3xl font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--primary)' }}>
          SYSTEM STATUS
        </h1>
        <p className="text-sm mono mb-8" style={{ color: 'var(--text-muted)' }}>
          {health?.timestamp ? new Date(health.timestamp).toUTCString() : 'Loading...'}
        </p>

        {/* Overall */}
        <div
          className="p-4 rounded mb-8 border"
          style={{
            backgroundColor: allOk ? 'rgba(0,255,136,0.05)' : 'rgba(255,68,68,0.05)',
            borderColor: allOk ? 'var(--alert-green)' : '#FF4444',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: allOk ? 'var(--alert-green)' : '#FF4444' }}
            />
            <span className="font-bold tracking-widest mono">
              {allOk ? 'ALL SYSTEMS OPERATIONAL' : 'PARTIAL DEGRADATION'}
            </span>
          </div>
        </div>

        {/* Services */}
        <div className="mb-8">
          <h2 className="text-xs mono tracking-widest mb-4" style={{ color: 'var(--border)' }}>SERVICES</h2>
          <StatusBadge ok={health?.db_ok ?? false} label="Database" />
          <StatusBadge ok={health?.auth_ok ?? false} label="Authentication" />
          <StatusBadge ok={health?.scheduler_ok ?? false} label="Background Jobs" />
          <StatusBadge ok={health?.redis_ok ?? false} label="Cache / Rate Limiting" />
          <StatusBadge ok={!!health} label="API Gateway" />
        </div>

        {/* Metrics */}
        <div className="mb-8">
          <h2 className="text-xs mono tracking-widest mb-4" style={{ color: 'var(--border)' }}>METRICS</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Events Indexed', value: health?.event_count?.toLocaleString() ?? '—' },
              { label: 'API Latency', value: health ? `${health.latency_ms}ms` : '—' },
              { label: 'Build SHA', value: health?.build_sha ?? '—' },
              { label: 'Environment', value: health?.env?.toUpperCase() ?? '—' },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="text-xs mono mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                <div className="font-bold mono" style={{ color: 'var(--primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {health?.last_ingest_at && (
          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
            Last ingest: {new Date(health.last_ingest_at).toUTCString()}
          </div>
        )}

        {health?.last_error && (
          <div className="mt-4 p-3 rounded border text-xs mono" style={{ borderColor: '#FF4444', color: '#FF4444' }}>
            Last error: {health.last_error}
          </div>
        )}
      </div>
    </div>
  )
}
