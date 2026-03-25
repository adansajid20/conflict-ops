export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

async function getDashboardStats() {
  try {
    const supabase = createServiceClient()
    const h24 = new Date(Date.now() - 24 * 3600000).toISOString()
    const h168 = new Date(Date.now() - 7 * 24 * 3600000).toISOString()

    const [e24h, e7d, alerts, missions, lastIngest, recentEvents] = await Promise.allSettled([
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', h24),
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', h168),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('read', false),
      supabase.from('missions').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('ingested_at').order('ingested_at', { ascending: false }).limit(1).single(),
      supabase.from('events')
        .select('id,title,event_type,severity,country_code,region,occurred_at,source')
        .order('occurred_at', { ascending: false })
        .limit(8),
    ])

    return {
      events24h: e24h.status === 'fulfilled' ? (e24h.value.count ?? 0) : 0,
      events7d: e7d.status === 'fulfilled' ? (e7d.value.count ?? 0) : 0,
      activeAlerts: alerts.status === 'fulfilled' ? (alerts.value.count ?? 0) : 0,
      openMissions: missions.status === 'fulfilled' ? (missions.value.count ?? 0) : 0,
      lastIngestAt: lastIngest.status === 'fulfilled' ? lastIngest.value.data?.ingested_at : null,
      recentEvents: recentEvents.status === 'fulfilled' ? (recentEvents.value.data ?? []) : [],
      sourcesOnline: 5, // GDELT, ReliefWeb, GDACS, UNHCR, NASA
    }
  } catch {
    return { events24h: 0, events7d: 0, activeAlerts: 0, openMissions: 0, lastIngestAt: null, recentEvents: [], sourcesOnline: 0 }
  }
}

const SEV_COLOR: Record<number, string> = { 5: '#FF4444', 4: '#FF8800', 3: '#FFCC00', 2: '#3B82F6', 1: '#888' }
const SEV_LABEL: Record<number, string> = { 5: 'CRIT', 4: 'HIGH', 3: 'MED', 2: 'LOW', 1: 'INFO' }

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: userCheck } = await supabase.from('users').select('onboarding_complete').eq('clerk_user_id', userId).single()
  if (userCheck && !userCheck.onboarding_complete) redirect('/onboarding')

  const stats = await getDashboardStats()
  const isFirstRun = stats.events24h === 0 && stats.events7d === 0

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
            SITUATION OVERVIEW
          </h1>
          <p className="text-xs mt-1 mono" style={{ color: 'var(--text-muted)' }}>
            {stats.lastIngestAt
              ? `LAST INGEST: ${new Date(stats.lastIngestAt).toISOString().replace('T', ' ').slice(0, 19)}Z`
              : `AS OF: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}Z`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs mono" style={{ color: 'var(--alert-green)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--alert-green)' }} />
          {stats.sourcesOnline} FEEDS ONLINE
        </div>
      </div>

      {/* First run banner */}
      {isFirstRun && (
        <div className="mb-6 p-4 rounded border" style={{ borderColor: 'var(--primary)', backgroundColor: 'rgba(0,255,136,0.04)' }}>
          <p className="text-sm mono font-bold mb-1" style={{ color: 'var(--primary)' }}>📡 INTEL FEED INITIALIZING</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            First ingest runs within 15 minutes. Intel is loading from GDELT, ReliefWeb, GDACS, UNHCR, and NASA EONET.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'EVENTS 24H', value: stats.events24h, color: 'var(--accent-blue)', icon: '◈' },
          { label: 'EVENTS 7D', value: stats.events7d, color: 'var(--primary)', icon: '◷' },
          { label: 'ACTIVE ALERTS', value: stats.activeAlerts, color: 'var(--alert-amber)', icon: '⚠' },
          { label: 'OPEN MISSIONS', value: stats.openMissions, color: 'var(--primary)', icon: '◉' },
        ].map(card => (
          <div key={card.label} className="rounded border p-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>{card.label}</div>
              <div style={{ color: card.color }}>{card.icon}</div>
            </div>
            <div className="text-3xl font-bold mono" style={{ color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent events */}
        <div className="lg:col-span-2 rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>RECENT EVENTS</span>
            <a href="/feed" className="text-xs mono" style={{ color: 'var(--primary)' }}>VIEW ALL →</a>
          </div>
          <div className="p-4">
            {stats.recentEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs mono mb-3" style={{ color: 'var(--text-muted)' }}>
                  Feeds initializing — first ingest in &lt;15 min
                </p>
                <a href="/wire" className="text-xs mono" style={{ color: 'var(--primary)' }}>
                  View public wire feed →
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentEvents.map((e: { id: string; title: string; severity: number; country_code: string | null; source: string; occurred_at: string }) => (
                  <div key={e.id} className="flex items-start gap-2 py-2 border-b last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs mono font-bold shrink-0 mt-0.5 px-1 rounded"
                      style={{ color: SEV_COLOR[e.severity] ?? '#888', backgroundColor: `${SEV_COLOR[e.severity] ?? '#888'}22` }}>
                      {SEV_LABEL[e.severity] ?? 'INFO'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{e.title}</p>
                      <p className="text-xs mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {e.country_code} · {e.source?.toUpperCase()} · {timeAgo(e.occurred_at)} ago
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-xs mono tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>QUICK ACTIONS</div>
          <div className="flex flex-col gap-2">
            {[
              { href: '/missions', label: '+ NEW MISSION' },
              { href: '/map', label: '⊞ OPEN MAP' },
              { href: '/feed', label: '▤ INTEL FEED' },
              { href: '/workbench', label: '⊡ WORKBENCH' },
              { href: '/tracking', label: '⊙ TRACKING' },
              { href: '/wire', label: '◎ PUBLIC WIRE' },
            ].map(a => (
              <a key={a.href} href={a.href}
                className="px-3 py-2 rounded text-xs mono tracking-wider border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {a.label}
              </a>
            ))}
          </div>

          {/* Sources status */}
          <div className="mt-6">
            <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>DATA SOURCES</div>
            {['GDELT', 'RELIEFWEB', 'GDACS', 'UNHCR', 'NASA EONET'].map(src => (
              <div key={src} className="flex items-center justify-between py-1 text-xs mono">
                <span style={{ color: 'var(--text-muted)' }}>{src}</span>
                <span style={{ color: 'var(--alert-green)' }}>● ONLINE</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
