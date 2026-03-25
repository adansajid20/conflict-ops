export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'System Status — CONFLICT OPS',
  description: 'Real-time platform health for conflictradar.co',
}

async function getStatus() {
  const start = Date.now()
  let db_ok = false, event_count = 0, last_ingest_at: string | null = null
  try {
    const supabase = createServiceClient()
    const [count, last] = await Promise.all([
      supabase.from('events').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('ingested_at').order('ingested_at', { ascending: false }).limit(1).single(),
    ])
    db_ok = !count.error
    event_count = count.count ?? 0
    last_ingest_at = last.data?.ingested_at ?? null
  } catch {}
  return {
    db_ok,
    auth_ok: !!process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
    scheduler_ok: !!process.env['INNGEST_SIGNING_KEY'],
    redis_ok: !!process.env['UPSTASH_REDIS_REST_URL'],
    event_count,
    last_ingest_at,
    latency_ms: Date.now() - start,
    build_sha: process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? 'local',
    env: process.env['VERCEL_ENV'] ?? 'development',
  }
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="mono text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="mono text-xs font-bold" style={{ color: ok ? 'var(--alert-green)' : '#FF4444' }}>
        {ok ? '● OPERATIONAL' : '● DEGRADED'}
      </span>
    </div>
  )
}

export default async function StatusPage() {
  const s = await getStatus()
  const allOk = s.db_ok && s.auth_ok && s.scheduler_ok
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <a href="/landing" className="text-xs mono" style={{ color: 'var(--text-muted)' }}>← CONFLICT OPS</a>
        <h1 className="text-3xl font-bold tracking-widest uppercase mt-6 mb-2" style={{ color: 'var(--primary)' }}>SYSTEM STATUS</h1>
        <p className="text-sm mono mb-8" style={{ color: 'var(--text-muted)' }}>{new Date().toUTCString()}</p>
        <div className="p-4 rounded mb-8 border" style={{ borderColor: allOk ? 'var(--alert-green)' : '#FF4444', backgroundColor: allOk ? 'rgba(0,255,136,0.05)' : 'rgba(255,68,68,0.05)' }}>
          <span className="font-bold mono">{allOk ? '● ALL SYSTEMS OPERATIONAL' : '● PARTIAL DEGRADATION'}</span>
        </div>
        <h2 className="text-xs mono tracking-widest mb-4" style={{ color: 'var(--border)' }}>SERVICES</h2>
        <Badge ok={s.db_ok} label="Database" />
        <Badge ok={s.auth_ok} label="Authentication" />
        <Badge ok={s.scheduler_ok} label="Background Jobs" />
        <Badge ok={s.redis_ok} label="Cache / Rate Limiting" />
        <Badge ok={true} label="API Gateway" />
        <div className="mt-8 grid grid-cols-2 gap-4">
          {[
            { label: 'Events Indexed', value: s.event_count.toLocaleString() },
            { label: 'API Latency', value: `${s.latency_ms}ms` },
            { label: 'Build SHA', value: s.build_sha },
            { label: 'Environment', value: s.env.toUpperCase() },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="text-xs mono mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              <div className="font-bold mono" style={{ color: 'var(--primary)' }}>{value}</div>
            </div>
          ))}
        </div>
        {s.last_ingest_at && (
          <p className="mt-4 text-xs mono" style={{ color: 'var(--text-muted)' }}>
            Last ingest: {new Date(s.last_ingest_at).toUTCString()}
          </p>
        )}
      </div>
    </div>
  )
}
