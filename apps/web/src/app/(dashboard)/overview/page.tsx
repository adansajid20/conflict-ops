export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'

async function getDashboardStats() {
  try {
    const supabase = createServiceClient()
    const h24 = new Date(Date.now() - 24 * 3600000).toISOString()
    const h168 = new Date(Date.now() - 7 * 24 * 3600000).toISOString()
    const h3 = new Date(Date.now() - 3 * 3600000).toISOString()

    const [e24h, e7d, alerts, missions, lastIngest, recentEvents, activeSources] = await Promise.allSettled([
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', h24),
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', h168),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('read', false),
      supabase.from('missions').select('id', { count: 'exact', head: true }),
      supabase.from('events').select('ingested_at').order('ingested_at', { ascending: false }).limit(1).single(),
      supabase.from('events')
        .select('id,title,event_type,severity,country_code,region,occurred_at,source')
        .order('occurred_at', { ascending: false })
        .limit(8),
      supabase.from('events').select('source').gte('ingested_at', h3),
    ])

    const distinctSources = activeSources.status === 'fulfilled'
      ? new Set((activeSources.value.data ?? []).map((r: { source: string }) => r.source)).size
      : 0

    return {
      events24h: e24h.status === 'fulfilled' ? (e24h.value.count ?? 0) : 0,
      events7d: e7d.status === 'fulfilled' ? (e7d.value.count ?? 0) : 0,
      activeAlerts: alerts.status === 'fulfilled' ? (alerts.value.count ?? 0) : 0,
      openMissions: missions.status === 'fulfilled' ? (missions.value.count ?? 0) : 0,
      lastIngestAt: lastIngest.status === 'fulfilled' ? lastIngest.value.data?.ingested_at ?? null : null,
      recentEvents: recentEvents.status === 'fulfilled' ? (recentEvents.value.data ?? []) : [],
      sourcesOnline: distinctSources,
    }
  } catch {
    return { events24h: 0, events7d: 0, activeAlerts: 0, openMissions: 0, lastIngestAt: null, recentEvents: [], sourcesOnline: 0 }
  }
}

const SEV_COLOR: Record<number, string> = { 5: '#FF4444', 4: '#FF8800', 3: '#FFCC00', 2: '#3B82F6', 1: '#888' }
const SEV_LABEL: Record<number, string> = { 5: 'CRIT', 4: 'HIGH', 3: 'MED', 2: 'LOW', 1: 'INFO' }
const SOURCES = ['gdelt', 'reliefweb', 'gdacs', 'unhcr', 'nasa-eonet']

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

function formatIngestTime(iso: string | null) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const ageMs = Date.now() - d.getTime()
  const m = Math.floor(ageMs / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Onboarding is optional — don't block access to the dashboard
  // Users can access everything; onboarding CTA shows in the UI if they have no org

  const stats = await getDashboardStats()
  const isFirstRun = stats.events24h === 0 && stats.events7d === 0
  const isStale = stats.lastIngestAt
    ? (Date.now() - new Date(stats.lastIngestAt).getTime()) > 2 * 3600 * 1000
    : false

  const STAT_CARDS = [
    { label: 'EVENTS 24H',     value: stats.events24h,  color: 'var(--accent-blue)', icon: '◈', href: '/feed?w=24h' },
    { label: 'EVENTS 7D',      value: stats.events7d,   color: 'var(--primary)',     icon: '◷', href: '/feed?w=7d' },
    { label: 'ACTIVE ALERTS',  value: stats.activeAlerts, color: 'var(--alert-amber)', icon: '⚠', href: '/alerts' },
    { label: 'OPEN MISSIONS',  value: stats.openMissions, color: 'var(--accent-purple)', icon: '◉', href: '/missions' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase font-mono" style={{ color: 'var(--text-primary)' }}>
            SITUATION OVERVIEW
          </h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
            AS OF {new Date().toISOString().replace('T', ' ').slice(0, 19)}Z
            {stats.lastIngestAt && ` · LAST INGEST ${formatIngestTime(stats.lastIngestAt)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isStale && (
            <span className="text-xs font-mono px-2 py-1 rounded"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: 'var(--alert-amber)', border: '1px solid rgba(245,158,11,0.2)' }}>
              ⌛ DATA STALE
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs font-mono"
            style={{ color: stats.sourcesOnline > 0 ? 'var(--alert-green)' : 'var(--text-muted)' }}>
            <span className={`status-dot ${stats.sourcesOnline > 0 ? 'green' : ''}`}
              style={stats.sourcesOnline === 0 ? { backgroundColor: 'var(--text-disabled)' } : undefined} />
            {stats.sourcesOnline > 0 ? `${stats.sourcesOnline}/5 FEEDS LIVE` : 'FEEDS UNKNOWN'}
          </div>
        </div>
      </div>

      {/* First run banner */}
      {isFirstRun && (
        <div className="mb-6 p-4 rounded-lg border flex items-start gap-3"
          style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary-dim)' }}>
          <span style={{ color: 'var(--primary)', fontSize: 20 }}>📡</span>
          <div>
            <p className="text-sm font-mono font-bold" style={{ color: 'var(--primary)' }}>INTEL FEED INITIALIZING</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              First ingest fires within 15 minutes via Inngest.
              Sources: GDELT, ReliefWeb, GDACS, UNHCR, NASA EONET.
            </p>
            <div className="flex gap-3 mt-3">
              <Link href="/admin" className="text-xs font-mono px-3 py-1 rounded"
                style={{ backgroundColor: 'var(--primary)', color: '#000', fontWeight: 700 }}>
                RUN INGEST NOW →
              </Link>
              <Link href="/wire" className="text-xs font-mono" style={{ color: 'var(--primary)' }}>
                View public wire feed →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map(c => (
          <Link key={c.label} href={c.href}
            className="rounded-lg border p-4 flex flex-col gap-1 transition-colors hover:border-opacity-60"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', textDecoration: 'none' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono tracking-widest" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
              <span style={{ color: c.color, opacity: 0.7 }}>{c.icon}</span>
            </div>
            <div className="text-3xl font-bold font-mono count-up" style={{ color: c.color }}>{c.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent events */}
        <div className="lg:col-span-2 rounded-lg border"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-mono tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>
              RECENT EVENTS
            </span>
            <Link href="/feed" className="text-xs font-mono" style={{ color: 'var(--primary)' }}>
              ALL EVENTS →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {stats.recentEvents.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-3xl mb-3" style={{ opacity: 0.3 }}>◈</div>
                <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                  No events yet — feeds initializing
                </p>
                <Link href="/wire" className="text-xs font-mono mt-2 block" style={{ color: 'var(--primary)' }}>
                  View public wire →
                </Link>
              </div>
            ) : (
              stats.recentEvents.map((e: {
                id: string; title: string; severity: number;
                country_code: string | null; source: string; occurred_at: string
              }) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                  <span className="text-xs font-mono font-bold shrink-0 px-1.5 py-0.5 rounded"
                    style={{
                      color: SEV_COLOR[e.severity] ?? '#888',
                      backgroundColor: `${SEV_COLOR[e.severity] ?? '#888'}18`,
                      minWidth: 38, textAlign: 'center',
                    }}>
                    {SEV_LABEL[e.severity] ?? 'INFO'}
                  </span>
                  <p className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{e.title}</p>
                  <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-disabled)' }}>
                    {e.country_code && `${e.country_code} · `}{timeAgo(e.occurred_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Quick actions */}
          <div className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-mono tracking-widest font-bold mb-3" style={{ color: 'var(--text-muted)' }}>
              QUICK ACTIONS
            </div>
            <div className="flex flex-col gap-1.5">
              {[
                { href: '/missions', label: '+ NEW MISSION',   icon: '◉' },
                { href: '/map',      label: 'OPEN MAP',        icon: '⊞' },
                { href: '/feed',     label: 'INTEL FEED',      icon: '▤' },
                { href: '/workbench',label: 'WORKBENCH',       icon: '⊡' },
                { href: '/alerts',   label: 'ALERTS',          icon: '⚠' },
                { href: '/admin',    label: 'DOCTOR MODE',     icon: '⊗' },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-2 px-3 py-2 rounded text-xs font-mono tracking-wider border transition-colors hover:bg-white/5"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', textDecoration: 'none' }}>
                  <span style={{ color: 'var(--primary)' }}>{a.icon}</span>
                  {a.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div className="rounded-lg border p-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs font-mono tracking-widest font-bold mb-3" style={{ color: 'var(--text-muted)' }}>
              DATA SOURCES
            </div>
            {SOURCES.map(src => {
              const live = stats.sourcesOnline > 0
              return (
                <div key={src} className="flex items-center justify-between py-1">
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {src.toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-mono"
                    style={{ color: live ? 'var(--alert-green)' : 'var(--text-disabled)' }}>
                    <span className={`status-dot ${live ? 'green' : ''}`}
                      style={!live ? { backgroundColor: 'var(--text-disabled)' } : undefined} />
                    {live ? 'LIVE' : 'UNKNOWN'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
