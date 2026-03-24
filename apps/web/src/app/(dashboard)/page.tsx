import { auth } from '@clerk/nextjs/server'

async function getDashboardStats() {
  // Will be replaced with real Supabase queries in Phase 2
  return {
    eventsToday: 0,
    activeAlerts: 0,
    openMissions: 0,
    sourcesOnline: 0,
    lastUpdated: new Date().toISOString(),
  }
}

const STAT_CARDS = [
  { key: 'eventsToday', label: 'EVENTS TODAY', color: 'var(--accent-blue)' },
  { key: 'activeAlerts', label: 'ACTIVE ALERTS', color: 'var(--alert-amber)' },
  { key: 'openMissions', label: 'OPEN MISSIONS', color: 'var(--primary)' },
  { key: 'sourcesOnline', label: 'SOURCES ONLINE', color: 'var(--alert-green)' },
] as const

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) return null

  const stats = await getDashboardStats()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1
          className="text-xl font-bold tracking-widest uppercase mono"
          style={{ color: 'var(--text-primary)' }}
        >
          SITUATION OVERVIEW
        </h1>
        <p className="text-xs mt-1 mono" style={{ color: 'var(--text-muted)' }}>
          LAST UPDATED: {new Date().toISOString().replace('T', ' ').substring(0, 19)}Z
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="rounded border p-4"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              {card.label}
            </div>
            <div className="text-3xl font-bold mono count-up" style={{ color: card.color }}>
              {stats[card.key]}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state — feed not yet connected */}
      <div
        className="rounded border p-12 text-center"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="text-4xl mb-4">◉</div>
        <div
          className="text-sm font-bold tracking-widest uppercase mono mb-2"
          style={{ color: 'var(--primary)' }}
        >
          NO INTELLIGENCE SIGNALS DETECTED
        </div>
        <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          DATA FEEDS INITIALIZING. CREATE A MISSION TO BEGIN MONITORING.
        </div>
        <div className="mt-6 flex gap-3 justify-center">
          <a
            href="/missions"
            className="px-4 py-2 rounded text-xs font-bold tracking-wider uppercase mono border transition-colors hover:bg-white/5"
            style={{
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
            }}
          >
            + CREATE MISSION
          </a>
          <a
            href="/feed"
            className="px-4 py-2 rounded text-xs font-bold tracking-wider uppercase mono border transition-colors hover:bg-white/5"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-muted)',
            }}
          >
            VIEW FEED
          </a>
        </div>
      </div>
    </div>
  )
}
