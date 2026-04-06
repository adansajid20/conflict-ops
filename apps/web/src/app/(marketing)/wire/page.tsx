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

const SEVERITY_COLORS: Record<number, { bg: string; text: string }> = {
  5: { bg: 'bg-red-500/10', text: 'text-red-400' },
  4: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  3: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  2: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  1: { bg: 'bg-gray-500/10', text: 'text-gray-400' },
}

const SEVERITY_LABELS: Record<number, string> = {
  5: 'CRITICAL',
  4: 'HIGH',
  3: 'MEDIUM',
  2: 'LOW',
  1: 'INFO',
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
    <div className="min-h-screen" style={{ background: '#070B11' }}>
      {/* Header Navigation */}
      <div className="border-b sticky top-0 z-10" style={{ borderColor: 'rgba(255, 255, 255, 0.06)', background: 'rgba(7, 11, 17, 0.95)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold tracking-tight text-white">CONFLICTRADAR</div>
            <div className="w-px h-5" style={{ background: 'rgba(255, 255, 255, 0.06)' }} />
            <div className="text-sm font-medium text-white/50">Live Wire</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-white/60 tracking-wide">LIVE</span>
              </div>
            </div>
            <a
              href="/sign-up"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white/90 transition-all duration-200"
              style={{
                background: 'rgba(96, 165, 250, 0.1)',
                border: '1px solid rgba(96, 165, 250, 0.2)',
              }}
            >
              Sign Up
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Global Events Feed</h1>
          <p className="text-white/50 text-lg">Real-time monitoring of international conflict and geopolitical developments</p>
        </div>

        {/* Info Banner */}
        <div className="mb-8 p-6 rounded-2xl border" style={{ borderColor: 'rgba(255, 255, 255, 0.06)', background: 'rgba(255, 255, 255, 0.02)' }}>
          <p className="text-sm text-white/60 leading-relaxed">
            Public preview showing the last 50 events.{' '}
            <a href="/sign-up" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">
              Sign up free
            </a>{' '}
            for full access: forecasts, alerts, vessel tracking, AI analysis, and more.
          </p>
        </div>

        {/* Events List or Empty State */}
        {events.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-6 opacity-50">📡</div>
            <p className="text-lg text-white/50 mb-2 font-medium">Intel feed initializing</p>
            <p className="text-white/40 mb-8">First events will appear in less than 15 minutes</p>
            <a
              href="/sign-up"
              className="inline-block px-8 py-3 rounded-lg font-semibold text-white/90 transition-all duration-200"
              style={{
                background: 'rgba(96, 165, 250, 0.15)',
                border: '1px solid rgba(96, 165, 250, 0.3)',
              }}
            >
              Get Notified When Live
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => {
              const severityConfig = SEVERITY_COLORS[e.severity] ?? { bg: 'bg-gray-500/10', text: 'text-gray-400' }
              const severityLabel = SEVERITY_LABELS[e.severity] || 'INFO'

              return (
                <div
                  key={e.id}
                  className="group p-5 rounded-2xl border transition-all duration-200 hover:border-white/10 hover:bg-white/[0.03]"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.06)', background: 'rgba(255, 255, 255, 0.02)' }}
                >
                  <div className="flex items-start gap-4">
                    {/* Severity Badge */}
                    <div className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold text-xs tracking-wide ${severityConfig.bg} ${severityConfig.text}`}>
                      {severityLabel}
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white leading-relaxed mb-2">{e.title}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-white/40">
                        {e.country_code && (
                          <span className="px-2 py-1 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                            {e.country_code}
                          </span>
                        )}
                        {e.region && (
                          <span className="px-2 py-1 rounded" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                            {e.region}
                          </span>
                        )}
                        {e.source && <span>{e.source.toUpperCase()}</span>}
                        <span className="ml-auto">{timeAgo(e.occurred_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Sign Up CTA Section */}
        <div className="mt-16 p-8 rounded-2xl border text-center" style={{ borderColor: 'rgba(96, 165, 250, 0.2)', background: 'rgba(96, 165, 250, 0.05)' }}>
          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">Unlock Full Intelligence Access</h2>
          <p className="text-white/60 text-base mb-8 max-w-md mx-auto">
            Get real-time alerts, predictive forecasts, vessel & flight tracking, AI-powered analysis, and dedicated mission support.
          </p>
          <a
            href="/sign-up"
            className="inline-block px-8 py-3 rounded-lg font-semibold text-white/90 transition-all duration-200"
            style={{
              background: 'rgba(96, 165, 250, 0.2)',
              border: '1px solid rgba(96, 165, 250, 0.3)',
            }}
          >
            Start Free Trial
          </a>
        </div>
      </div>
    </div>
  )
}
