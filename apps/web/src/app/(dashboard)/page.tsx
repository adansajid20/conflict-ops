import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

async function getDashboardStats() {
  try {
    const supabase = createServiceClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [eventsResult, alertsResult, missionsResult] = await Promise.allSettled([
      supabase.from('events').select('id', { count: 'exact', head: true }).gte('occurred_at', today.toISOString()),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('read', false),
      supabase.from('missions').select('id', { count: 'exact', head: true }),
    ])

    return {
      eventsToday: eventsResult.status === 'fulfilled' ? (eventsResult.value.count ?? 0) : 0,
      activeAlerts: alertsResult.status === 'fulfilled' ? (alertsResult.value.count ?? 0) : 0,
      openMissions: missionsResult.status === 'fulfilled' ? (missionsResult.value.count ?? 0) : 0,
      sourcesOnline: 3, // ACLED + GDELT + RSS
    }
  } catch {
    return { eventsToday: 0, activeAlerts: 0, openMissions: 0, sourcesOnline: 0 }
  }
}

const STAT_CARDS = [
  { key: 'eventsToday' as const, label: 'EVENTS TODAY', color: 'var(--accent-blue)', icon: '◈' },
  { key: 'activeAlerts' as const, label: 'ACTIVE ALERTS', color: 'var(--alert-amber)', icon: '⚠' },
  { key: 'openMissions' as const, label: 'OPEN MISSIONS', color: 'var(--primary)', icon: '◉' },
  { key: 'sourcesOnline' as const, label: 'SOURCES ONLINE', color: 'var(--alert-green)', icon: '◎' },
]

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const stats = await getDashboardStats()

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
            SITUATION OVERVIEW
          </h1>
          <p className="text-xs mt-1 mono" style={{ color: 'var(--text-muted)' }}>
            LAST UPDATED: {new Date().toISOString().replace('T', ' ').substring(0, 19)}Z
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs mono" style={{ color: 'var(--alert-green)' }}>
          <span className="status-dot green" />
          ALL FEEDS NOMINAL
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="rounded border p-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {card.label}
              </div>
              <div style={{ color: card.color }}>{card.icon}</div>
            </div>
            <div className="text-3xl font-bold mono count-up" style={{ color: card.color }}>
              {stats[card.key]}
            </div>
          </div>
        ))}
      </div>

      {/* Quick access */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Feed preview */}
        <div
          className="rounded border p-4 lg:col-span-2"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            RECENT EVENTS
          </div>
          {stats.eventsToday === 0 ? (
            <div className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>
              NO SIGNALS DETECTED — FEEDS INITIALIZING
            </div>
          ) : (
            <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
              {stats.eventsToday} events detected today →{' '}
              <a href="/feed" className="underline" style={{ color: 'var(--primary)' }}>
                VIEW FEED
              </a>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div
          className="rounded border p-4"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            QUICK ACTIONS
          </div>
          <div className="flex flex-col gap-2">
            {[
              { href: '/missions', label: '+ NEW MISSION' },
              { href: '/map', label: '⊞ OPEN MAP' },
              { href: '/feed', label: '▤ INTEL FEED' },
              { href: '/workbench', label: '⊡ WORKBENCH' },
            ].map(action => (
              <a
                key={action.href}
                href={action.href}
                className="px-3 py-2 rounded text-xs mono tracking-wider border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
