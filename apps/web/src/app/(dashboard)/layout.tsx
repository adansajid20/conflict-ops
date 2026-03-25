import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const NAV_ITEMS = [
  { href: '/overview',      label: 'OVERVIEW',    icon: '◈', section: 'main' },
  { href: '/feed',          label: 'INTEL FEED',  icon: '▤', section: 'main' },
  { href: '/map',           label: 'MAP',         icon: '⊞', section: 'main' },
  { href: '/alerts',        label: 'ALERTS',      icon: '⚠', section: 'main' },
  { href: '/missions',      label: 'MISSIONS',    icon: '◉', section: 'main' },
  { href: '/workbench',     label: 'WORKBENCH',   icon: '⊡', section: 'analysis' },
  { href: '/tracking',      label: 'TRACKING',    icon: '⊙', section: 'analysis' },
  { href: '/markets',       label: 'MARKETS',     icon: '◷', section: 'analysis' },
  { href: '/geoverify',     label: 'GEOVERIFY',   icon: '⊛', section: 'analysis' },
  { href: '/travel',        label: 'TRAVEL RISK', icon: '⊲', section: 'analysis' },
  { href: '/usage',            label: 'USAGE',     icon: '◷', section: 'settings' },
  { href: '/settings/billing', label: 'BILLING',  icon: '○', section: 'settings' },
  { href: '/settings/api',     label: 'API KEYS', icon: '⊢', section: 'settings' },
  { href: '/settings/org',     label: 'ORG',      icon: '⊕', section: 'settings' },
  { href: '/settings/webhooks',label: 'WEBHOOKS', icon: '⇢', section: 'settings' },
  { href: '/admin',            label: 'DOCTOR',   icon: '⊗', section: 'settings' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Classification Banner */}
      <div className="classification-banner flex items-center justify-between">
        <span>CONFLICT OPS // UNCLASSIFIED // OPERATOR USE ONLY</span>
        <span className="mono text-xs">
          {new Date().toISOString().replace('T', ' ').substring(0, 19)}Z
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className="w-56 flex flex-col border-r"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Logo */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div
              className="text-lg font-bold tracking-widest uppercase"
              style={{ color: 'var(--primary)' }}
            >
              CONFLICT OPS
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              INTELLIGENCE PLATFORM
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 overflow-y-auto">
            {(['main','analysis','settings'] as const).map(section => (
              <div key={section}>
                <div className="px-3 pt-3 pb-1 text-xs mono tracking-widest" style={{ color: 'var(--border)' }}>
                  {section === 'main' ? 'INTELLIGENCE' : section === 'analysis' ? 'ANALYSIS' : 'SETTINGS'}
                </div>
                {NAV_ITEMS.filter(i => i.section === section).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded text-sm font-mono tracking-wider transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <span style={{ color: 'var(--primary)' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {/* Status bar */}
          <div
            className="p-3 border-t text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <div className="flex items-center gap-2">
              <span className="status-dot green" />
              <span className="mono">ALL SYSTEMS NOMINAL</span>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Bottom status bar */}
      <div
        className="h-6 border-t flex items-center px-4 gap-6 text-xs mono"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <span>SYS TIME: <span style={{ color: 'var(--text-primary)' }}>{new Date().toISOString().substring(11, 19)}Z</span></span>
        <span>ACTIVE FEEDS: <span style={{ color: 'var(--alert-green)' }}>LOADING...</span></span>
        <span>EVENTS TODAY: <span style={{ color: 'var(--text-primary)' }}>—</span></span>
      </div>
    </div>
  )
}
