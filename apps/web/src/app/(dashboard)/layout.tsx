'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SidebarStatus } from '@/components/layout/SidebarStatus'
import { FreshnessBanner } from '@/components/layout/FreshnessBanner'
import { safeTimeAgo } from '@/types/intel-item'
import { useHealthStatus } from '@/hooks/useHealthStatus'

export const dynamic = 'force-dynamic'

type NavItem = {
  href: string
  label: string
  icon: string
  section: 'core' | 'labs' | 'admin'
  beta?: boolean
}

const NAV_ITEMS: NavItem[] = [
  // INTELLIGENCE — always visible
  { href: '/overview',          label: 'OVERVIEW',    icon: '◈', section: 'core' },
  { href: '/feed',              label: 'INTEL FEED',  icon: '▤', section: 'core' },
  { href: '/map',               label: 'MAP',         icon: '⊞', section: 'core' },
  { href: '/alerts',            label: 'ALERTS',      icon: '⚠', section: 'core' },
  // LABS — collapsible, beta
  { href: '/missions',          label: 'MISSIONS',    icon: '◉', section: 'labs', beta: true },
  { href: '/workbench',         label: 'WORKBENCH',   icon: '⊡', section: 'labs', beta: true },
  { href: '/tracking',          label: 'TRACKING',    icon: '⊙', section: 'labs', beta: true },
  { href: '/markets',           label: 'MARKETS',     icon: '◷', section: 'labs', beta: true },
  { href: '/geoverify',         label: 'GEOVERIFY',   icon: '⊛', section: 'labs', beta: true },
  { href: '/travel',            label: 'TRAVEL RISK', icon: '⊲', section: 'labs', beta: true },
  // ADMIN — collapsible
  { href: '/admin',             label: 'DOCTOR',      icon: '⊗', section: 'admin' },
  { href: '/settings/org',      label: 'ORG',         icon: '⊕', section: 'admin' },
  { href: '/settings/api',      label: 'API KEYS',    icon: '⊢', section: 'admin' },
  { href: '/settings/webhooks', label: 'WEBHOOKS',    icon: '⇢', section: 'admin' },
  { href: '/settings/billing',  label: 'BILLING',     icon: '○', section: 'admin' },
]

function NavSection({
  title,
  items,
  currentPath,
  collapsible = false,
  defaultOpen = true,
  storageKey,
  badge,
}: {
  title: string
  items: NavItem[]
  currentPath: string
  collapsible?: boolean
  defaultOpen?: boolean
  storageKey?: string
  badge?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) setOpen(stored === 'true')
    } catch { /* ignore */ }
  }, [storageKey])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (storageKey) {
      try { localStorage.setItem(storageKey, String(next)) } catch { /* ignore */ }
    }
  }

  return (
    <div className="mb-1">
      <div
        className={`flex items-center justify-between px-3 pt-3 pb-1 ${collapsible ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={collapsible ? toggle : undefined}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xs mono tracking-widest" style={{ color: 'var(--border)', fontSize: 9 }}>
            {title}
          </span>
          {badge && (
            <span className="text-xs px-1 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.2)', color: '#A78BFA', fontSize: 8 }}>
              {badge}
            </span>
          )}
        </div>
        {collapsible && (
          <span className="text-xs" style={{ color: 'var(--border)' }}>{open ? '▾' : '▸'}</span>
        )}
      </div>

      {open && items.map(item => {
        const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded text-xs font-mono tracking-wider transition-colors hover:bg-white/5"
            style={{
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              backgroundColor: isActive ? 'rgba(0,255,136,0.08)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)', width: 14, textAlign: 'center', fontSize: 12 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {item.beta && (
              <sup style={{ color: '#A78BFA', fontSize: 8, marginLeft: 'auto' }}>β</sup>
            )}
          </Link>
        )
      })}
    </div>
  )
}

function StatusBar() {
  const { health } = useHealthStatus(120_000)
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().substring(11, 19))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const sourcesOk = health?.enabledSources?.filter(s => s.ok).length ?? 0
  const sourcesTotal = health?.enabledSources?.length ?? 5

  return (
    <div
      className="h-6 border-t flex items-center px-4 gap-4 text-xs mono shrink-0"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-muted)', fontSize: 10 }}
    >
      <span>TIME: <span style={{ color: 'var(--text-primary)' }}>{time}Z</span></span>
      <span>FEEDS: <span style={{ color: sourcesOk > 0 ? 'var(--alert-green)' : 'var(--alert-amber)' }}>
        {health ? `${sourcesOk}/${sourcesTotal}` : '—'}
      </span></span>
      <span>EVENTS: <span style={{ color: 'var(--text-primary)' }}>{health?.eventCount ?? '—'}</span></span>
      <span>INGEST: <span style={{ color: 'var(--text-muted)' }}>{health ? safeTimeAgo(health.lastIngestAt) : '—'}</span></span>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Trigger user provisioning on mount (non-blocking)
  useEffect(() => {
    fetch('/api/v1/me').catch(() => { /* best effort */ })
  }, [])

  const coreItems = NAV_ITEMS.filter(i => i.section === 'core')
  const labsItems = NAV_ITEMS.filter(i => i.section === 'labs')
  const adminItems = NAV_ITEMS.filter(i => i.section === 'admin')

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Classification Banner */}
      <div className="classification-banner flex items-center justify-between shrink-0">
        <span>CONFLICT OPS // UNCLASSIFIED // OPERATOR USE ONLY</span>
        <span className="mono text-xs">
          {new Date().toISOString().replace('T', ' ').substring(0, 19)}Z
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex flex-col border-r shrink-0"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          {/* Logo */}
          <div className="p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
            <Link href="/overview" style={{ textDecoration: 'none' }}>
              <div className="text-base font-bold tracking-widest uppercase font-mono" style={{ color: 'var(--primary)' }}>
                CONFLICT OPS
              </div>
              <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                INTELLIGENCE PLATFORM
              </div>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-1 overflow-y-auto">
            <NavSection
              title="INTELLIGENCE"
              items={coreItems}
              currentPath={pathname ?? ''}
            />
            <NavSection
              title="LABS"
              items={labsItems}
              currentPath={pathname ?? ''}
              collapsible
              defaultOpen={false}
              storageKey="nav_labs_open"
              badge="β"
            />
            <NavSection
              title="ADMIN"
              items={adminItems}
              currentPath={pathname ?? ''}
              collapsible
              defaultOpen={false}
              storageKey="nav_admin_open"
            />
          </nav>

          <SidebarStatus />
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto flex flex-col min-w-0">
          <FreshnessBanner />
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>

      <StatusBar />
    </div>
  )
}
