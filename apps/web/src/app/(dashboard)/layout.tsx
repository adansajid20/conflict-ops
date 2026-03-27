'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  FlaskConical,
  Globe,
  KeyRound,
  LayoutDashboard,
  Plane,
  Radio,
  ScanSearch,
  Shield,
  Stethoscope,
  Target,
  TrendingUp,
  Webhook,
} from 'lucide-react'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { FreshnessBanner } from '@/components/layout/FreshnessBanner'
import { useHealthStatus } from '@/hooks/useHealthStatus'
import { safeTimeAgo } from '@/types/intel-item'

export const dynamic = 'force-dynamic'

type NavItem = {
  href: string
  label: string
  section: 'primary' | 'secondary' | 'settings'
  icon: unknown
  comingSoon?: boolean
}

// Primary nav — these work, show always
const PRIMARY_NAV: NavItem[] = [
  { href: '/overview', label: 'Overview', section: 'primary', icon: LayoutDashboard },
  { href: '/feed', label: 'Intel Feed', section: 'primary', icon: Activity },
  { href: '/tracking', label: 'Live Map', section: 'primary', icon: Radio },
  { href: '/alerts', label: 'Alerts', section: 'primary', icon: Bell },
  { href: '/admin', label: 'Admin', section: 'primary', icon: Stethoscope },
]

// Secondary nav — coming soon or deprioritized
const SECONDARY_NAV: NavItem[] = [
  { href: '/missions', label: 'Missions', section: 'secondary', icon: Target, comingSoon: true },
  { href: '/workbench', label: 'Workbench', section: 'secondary', icon: FlaskConical, comingSoon: true },
  { href: '/markets', label: 'Markets', section: 'secondary', icon: TrendingUp, comingSoon: true },
  { href: '/geoverify', label: 'Geoverify', section: 'secondary', icon: ScanSearch, comingSoon: true },
  { href: '/travel', label: 'Travel Risk', section: 'secondary', icon: Plane, comingSoon: true },
  { href: '/map', label: 'Globe View', section: 'secondary', icon: Globe },
]

// Settings always at bottom
const SETTINGS_NAV: NavItem[] = [
  { href: '/settings/org', label: 'Workspace', section: 'settings', icon: Building2 },
  { href: '/settings/api', label: 'API Keys', section: 'settings', icon: KeyRound },
  { href: '/settings/webhooks', label: 'Webhooks', section: 'settings', icon: Webhook },
  { href: '/settings/billing', label: 'Billing', section: 'settings', icon: CreditCard },
]

function NavLink({ item, pathname, unreadAlerts = 0 }: { item: NavItem; pathname: string; unreadAlerts?: number }) {
  const Icon = item.icon as React.ElementType
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

  if (item.comingSoon) {
    return (
      <div
        className="nav-item"
        style={{ opacity: 0.4, cursor: 'not-allowed', position: 'relative' }}
        title={`${item.label} — coming soon`}
        onClick={e => e.preventDefault()}
      >
        <Icon className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        <span>{item.label}</span>
        <span className="ml-auto text-[9px] mono px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-disabled)', border: '1px solid var(--border)' }}>
          SOON
        </span>
      </div>
    )
  }

  return (
    <Link href={item.href} className={`nav-item transition-colors duration-150 ${active ? 'active' : ''}`} style={{ position: 'relative' }}>
      {active && (
        <motion.span layoutId="nav-active"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--primary)', borderRadius: '0 2px 2px 0' }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
      )}
      <Icon className="h-4 w-4" style={{ color: active ? 'var(--primary-text)' : 'var(--text-muted)' }} />
      <span>{item.label}</span>
      {item.href === '/alerts' && unreadAlerts > 0 && (
        <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] mono"
          style={{ background: 'var(--sev-critical-dim)', color: 'var(--sev-critical)' }}>
          {unreadAlerts}
        </span>
      )}
    </Link>
  )
}

function StatusBar() {
  const { health } = useHealthStatus(120_000)
  const [utcTime, setUtcTime] = useState('')

  useEffect(() => {
    const tick = () => setUtcTime(new Date().toISOString().slice(11, 19))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  const liveFeeds = health?.sources?.live ?? health?.enabledSources?.filter(s => s.ok).length ?? 0
  const totalFeeds = health?.sources?.enabled ?? health?.enabledSources?.length ?? 5
  const totalEvents = health?.events?.total ?? health?.eventCount ?? 0
  const lastIngestAt = health?.ingest?.last_success_at ?? health?.lastIngestAt ?? null

  return (
    <div className="flex h-7 items-center gap-6 border-t px-4 text-[11px]"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div>UTC <span className="mono" style={{ color: 'var(--text-primary)' }}>{utcTime}</span></div>
      <div>FEEDS <span className="mono" style={{ color: liveFeeds > 0 ? 'var(--sev-low)' : 'var(--sev-medium)' }}>{liveFeeds}/{totalFeeds}</span></div>
      <div>EVENTS <motion.span key={totalEvents} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mono" style={{ color: 'var(--text-primary)' }}>{totalEvents}</motion.span></div>
      <div>INGEST <span className="mono" style={{ color: 'var(--text-primary)' }}>{safeTimeAgo(lastIngestAt)}</span></div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const { user } = useUser()
  const { health } = useHealthStatus(60_000)
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    fetch('/api/v1/me').catch(() => undefined)
    fetch('/api/v1/alerts?limit=5&unread=true', { cache: 'no-store' })
      .then(res => res.json())
      .then((json: { data?: unknown[] }) => setUnreadAlerts(json.data?.length ?? 0))
      .catch(() => setUnreadAlerts(0))
  }, [pathname])

  // Auto-open "More" if current path is in secondary nav
  useEffect(() => {
    if (SECONDARY_NAV.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`))) {
      setMoreOpen(true)
    }
  }, [pathname])

  const initials = user?.fullName
    ?.split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'CO'

  const liveFeeds = health?.sources?.live ?? health?.enabledSources?.filter(s => s.ok).length ?? 0

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--bg-base)' }}>
      <CommandPalette />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[240px] shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          {/* Logo */}
          <div className="border-b px-4 py-5" style={{ borderColor: 'var(--border)' }}>
            <Link href="/overview" className="flex items-start gap-3" style={{ textDecoration: 'none' }}>
              <div className="rounded-lg border p-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
                {(() => { const ShieldIcon = Shield as React.ElementType; return <ShieldIcon className="h-4 w-4" style={{ color: 'var(--primary-text)' }} /> })()}
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[0.04em]" style={{ color: 'var(--text-primary)' }}>CONFLICT OPS</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Intelligence Platform</div>
              </div>
            </Link>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto px-2 py-4">
            {/* Primary nav */}
            <div className="mb-1 px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
              Intelligence
            </div>
            <div className="space-y-1 mb-5">
              {PRIMARY_NAV.map(item => (
                <NavLink key={item.href} item={item} pathname={pathname} unreadAlerts={unreadAlerts} />
              ))}
            </div>

            {/* More / secondary nav — collapsible */}
            <button
              onClick={() => setMoreOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-medium uppercase tracking-[0.08em] mb-1 hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              {(() => { const ChevronDownIcon = ChevronDown as any; return <ChevronDownIcon size={12} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`} /> })()}
              More modules
            </button>
            <AnimatePresence initial={false}>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden">
                  <div className="space-y-1 mb-5">
                    {SECONDARY_NAV.map(item => (
                      <NavLink key={item.href} item={item} pathname={pathname} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Settings */}
            <div className="mb-1 px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
              Settings
            </div>
            <div className="space-y-1">
              {SETTINGS_NAV.map(item => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>

          {/* User footer */}
          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 flex items-center gap-3 rounded-lg border p-3"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ background: 'var(--bg-active)', color: 'var(--primary-text)' }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.fullName ?? 'Operator'}</div>
                <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>Platform status</span>
              <span className="mono" style={{ color: liveFeeds > 0 ? 'var(--sev-low)' : 'var(--sev-medium)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {liveFeeds > 0 ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full" style={{ background: 'var(--sev-medium)' }} />}
                {liveFeeds}/5 live
              </span>
            </div>
            <div className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Press <span className="mono">⌘K</span> or <span className="mono">Ctrl+K</span> for command palette.
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <FreshnessBanner />
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <StatusBar />
    </div>
  )
}
