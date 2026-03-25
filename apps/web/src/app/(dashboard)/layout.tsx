import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SidebarStatus } from '@/components/layout/SidebarStatus'
import { FreshnessBanner } from '@/components/layout/FreshnessBanner'
import { ensureUserProvisioned } from '@/lib/user/provision'

export const dynamic = 'force-dynamic'

const NAV_ITEMS = [
  { href: '/overview',          label: 'OVERVIEW',    icon: '◈', section: 'main' },
  { href: '/feed',              label: 'INTEL FEED',  icon: '▤', section: 'main' },
  { href: '/map',               label: 'MAP',         icon: '⊞', section: 'main' },
  { href: '/alerts',            label: 'ALERTS',      icon: '⚠', section: 'main' },
  { href: '/missions',          label: 'MISSIONS',    icon: '◉', section: 'main' },
  { href: '/workbench',         label: 'WORKBENCH',   icon: '⊡', section: 'analysis' },
  { href: '/tracking',          label: 'TRACKING',    icon: '⊙', section: 'analysis' },
  { href: '/markets',           label: 'MARKETS',     icon: '◷', section: 'analysis' },
  { href: '/geoverify',         label: 'GEOVERIFY',   icon: '⊛', section: 'analysis' },
  { href: '/travel',            label: 'TRAVEL RISK', icon: '⊲', section: 'analysis' },
  { href: '/usage',             label: 'USAGE',       icon: '◷', section: 'settings' },
  { href: '/settings/billing',  label: 'BILLING',     icon: '○', section: 'settings' },
  { href: '/settings/api',      label: 'API KEYS',    icon: '⊢', section: 'settings' },
  { href: '/settings/org',      label: 'ORG',         icon: '⊕', section: 'settings' },
  { href: '/settings/webhooks', label: 'WEBHOOKS',    icon: '⇢', section: 'settings' },
  { href: '/admin',             label: 'DOCTOR',      icon: '⊗', section: 'settings' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Auto-provision user in DB — works even without Clerk webhook configured
  try {
    await ensureUserProvisioned(userId)
  } catch (e) {
    console.error('[layout] user provision failed:', e)
    // Don't block the user — let them in, individual pages handle missing data
  }

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
        <aside className="w-56 flex flex-col border-r shrink-0"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <Link href="/overview" style={{ textDecoration: 'none' }}>
              <div className="text-lg font-bold tracking-widest uppercase font-mono" style={{ color: 'var(--primary)' }}>
                CONFLICT OPS
              </div>
              <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                INTELLIGENCE PLATFORM
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-2 overflow-y-auto">
            {(['main', 'analysis', 'settings'] as const).map(section => (
              <div key={section} className="mb-2">
                <div className="px-3 pt-3 pb-1 text-xs font-mono tracking-widest"
                  style={{ color: 'var(--border)' }}>
                  {section === 'main' ? 'INTELLIGENCE' : section === 'analysis' ? 'ANALYSIS' : 'SETTINGS'}
                </div>
                {NAV_ITEMS.filter(i => i.section === section).map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded text-xs font-mono tracking-wider transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                    <span style={{ color: 'var(--primary)', width: 14, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <SidebarStatus />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto flex flex-col min-w-0">
          <FreshnessBanner />
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
