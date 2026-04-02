export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Live Wire — CONFLICTRADAR',
  description: 'Public live feed of global conflict and geopolitical events. Updated every 15 minutes.',
}

async function getPublicEvents() {
  try {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('events')
      .select('id,title,event_type,severity,country_code,region,occurred_at,source')
      .eq('status', 'pending')
      .order('occurred_at', { ascending: false })
      .limit(50)
    return data ?? []
  } catch {
    return []
  }
}

const SEVERITY_COLORS: Record<number, string> = {
  5: '#FF4444', 4: '#FF8800', 3: '#FFCC00', 2: '#00AAFF', 1: '#888888',
}
const SEVERITY_LABELS: Record<number, string> = {
  5: 'CRITICAL', 4: 'HIGH', 3: 'MEDIUM', 2: 'LOW', 1: 'INFO',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default async function WirePage() {
  const events = await getPublicEvents()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="border-b sticky top-0 z-10" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-bold tracking-widest mono" style={{ color: 'var(--primary)' }}>CONFLICTRADAR</span>
            <span className="mx-2 text-xs" style={{ color: 'var(--border)' }}>|</span>
            <span className="text-sm mono" style={{ color: 'var(--text-muted)' }}>LIVE WIRE</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs mono" style={{ color: 'var(--alert-green)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--alert-green)' }} />
              LIVE
            </div>
            <a href="/sign-up" className="px-4 py-1.5 rounded text-xs font-bold mono tracking-widest"
              style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
              ACCESS FULL INTEL →
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Banner */}
        <div className="mb-6 p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <p className="text-sm mono" style={{ color: 'var(--text-muted)' }}>
            Public preview — last 50 events. <a href="/sign-up" style={{ color: 'var(--primary)' }}>Sign up free</a> for full access: forecasts, alerts, vessel tracking, AI analysis, and more.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📡</div>
            <p className="mono text-sm" style={{ color: 'var(--text-muted)' }}>
              Intel feed initializing — first ingest runs in &lt;15 minutes
            </p>
            <a href="/sign-up" className="inline-block mt-4 px-6 py-2 rounded mono text-sm font-bold"
              style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
              Get Notified When Live
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(e => (
              <div key={e.id} className="p-4 rounded border hover:border-primary/40 transition-colors"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="flex items-start gap-3">
                  <span
                    className="text-xs mono font-bold mt-0.5 shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      color: SEVERITY_COLORS[e.severity] ?? '#888',
                      backgroundColor: `${SEVERITY_COLORS[e.severity] ?? '#888'}22`,
                    }}
                  >
                    {SEVERITY_LABELS[e.severity] ?? 'INFO'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {e.title}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs mono" style={{ color: 'var(--text-muted)' }}>
                      {e.country_code && <span>{e.country_code}</span>}
                      {e.region && <span>{e.region}</span>}
                      <span>{e.source?.toUpperCase()}</span>
                      <span>{timeAgo(e.occurred_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 p-8 rounded border text-center" style={{ borderColor: 'var(--primary)', backgroundColor: 'rgba(0,255,136,0.03)' }}>
          <h2 className="text-xl font-bold tracking-widest mono mb-2" style={{ color: 'var(--primary)' }}>
            FULL INTELLIGENCE ACCESS
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Forecasts, alerts, vessel & flight tracking, AI-powered analysis, and mission workbench.
          </p>
          <a href="/sign-up" className="inline-block px-8 py-3 rounded font-bold mono tracking-widest text-sm"
            style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
            START FREE TRIAL
          </a>
        </div>
      </div>
    </div>
  )
}
