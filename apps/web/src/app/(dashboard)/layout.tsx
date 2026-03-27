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
  section: 'intelligence' | 'analysis' | 'workspace' | 'settings'
  icon: unknown
}

const NAV_ITEMS: NavItem[] = [
  { href: '/overview', label: 'Overview', section: 'intelligence', icon: LayoutDashboard },
  { href: '/feed', label: 'Intel Feed', section: 'intelligence', icon: Activity },
  { href: '/map', label: 'Map', section: 'intelligence', icon: Globe },
  { href: '/alerts', label: 'Alerts', section: 'intelligence', icon: Bell },
  { href: '/missions', label: 'Missions', section: 'analysis', icon: Target },
  { href: '/workbench', label: 'Workbench', section: 'analysis', icon: FlaskConical },
  { href: '/tracking', label: 'Tracking', section: 'workspace', icon: Radio },
  { href: '/markets', label: 'Markets', section: 'workspace', icon: TrendingUp },
  { href: '/geoverify', label: 'Geoverify', section: 'workspace', icon: ScanSearch },
  { href: '/travel', label: 'Travel Risk', section: 'workspace', icon: Plane },
  { href: '/admin', label: 'Doctor/Admin', section: 'settings', icon: Stethoscope },
  { href: '/settings/org', label: 'Org', section: 'settings', icon: Building2 },
  { href: '/settings/api', label: 'API Keys', section: 'settings', icon: KeyRound },
  { href: '/settings/webhooks', label: 'Webhooks', section: 'settings', icon: Webhook },
  { href: '/settings/billing', label: 'Billing', section: 'settings', icon: CreditCard },
]

function Section({ title, items, pathname, unreadAlerts = 0 }: { title: string; items: NavItem[]; pathname: string; unreadAlerts?: number }) {
  return (
    <div className="mb-5">
      <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon as React.ElementType
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link key={item.href} href={item.href} className={`nav-item transition-colors duration-150 ${active ? 'active' : ''}`} style={{ position: 'relative' }}>
              {active ? <motion.span layoutId="nav-active" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: 'var(--primary)', borderRadius: '0 2px 2px 0' }} transition={{ type: 'spring', stiffness: 400, damping: 35 }} /> : null}
              <Icon className="h-4 w-4" style={{ color: active ? 'var(--primary-text)' : 'var(--text-muted)' }} />
              <span>{item.label}</span>
              {item.href === '/alerts' && unreadAlerts > 0 ? (
                <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] mono" style={{ background: 'var(--sev-critical-dim)', color: 'var(--sev-critical)' }}>
                  {unreadAlerts}
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
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

  const liveFeeds = health?.sources?.live ?? health?.enabledSources?.filter((source) => source.ok).length ?? 0
  const totalFeeds = health?.sources?.enabled ?? health?.enabledSources?.length ?? 5
  const totalEvents = health?.events?.total ?? health?.eventCount ?? 0
  const lastIngestAt = health?.ingest?.last_success_at ?? health?.lastIngestAt ?? null

  return (
    <div className="flex h-7 items-center gap-6 border-t px-4 text-[11px]" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div>UTC <span className="mono" style={{ color: 'var(--text-primary)' }}>{utcTime}</span></div>
      <div>FEEDS <span className="mono" style={{ color: liveFeeds > 0 ? 'var(--sev-low)' : 'var(--sev-medium)' }}>{liveFeeds}/{totalFeeds}</span></div>
      <div>EVENTS <motion.span key={health?.eventCount ?? totalEvents} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mono" style={{ color: 'var(--text-primary)' }}>{totalEvents}</motion.span></div>
      <div>INGEST <span className="mono" style={{ color: 'var(--text-primary)' }}>{safeTimeAgo(lastIngestAt)}</span></div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const { user } = useUser()
  const { health } = useHealthStatus(60_000)
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  useEffect(() => {
    fetch('/api/v1/me').catch(() => undefined)
    fetch('/api/v1/alerts?limit=5&unread=true', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: { data?: unknown[] }) => setUnreadAlerts(json.data?.length ?? 0))
      .catch(() => setUnreadAlerts(0))
  }, [pathname])

  const sections = {
    intelligence: NAV_ITEMS.filter((item) => item.section === 'intelligence'),
    analysis: NAV_ITEMS.filter((item) => item.section === 'analysis'),
    workspace: NAV_ITEMS.filter((item) => item.section === 'workspace'),
    settings: NAV_ITEMS.filter((item) => item.section === 'settings'),
  }

  const initials = user?.fullName
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'CO'

  const liveFeeds = health?.sources?.live ?? health?.enabledSources?.filter((source) => source.ok).length ?? 0

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--bg-base)' }}>
      <CommandPalette />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[240px] shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
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

          <div className="flex-1 overflow-y-auto px-2 py-4">
            <Section title="Intelligence" items={sections.intelligence} pathname={pathname} unreadAlerts={unreadAlerts} />
            <Section title="Analysis" items={sections.analysis} pathname={pathname} />
            <Section title="Workspace" items={sections.workspace} pathname={pathname} />
            <Section title="Settings" items={sections.settings} pathname={pathname} />
          </div>

          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-3 flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--bg-active)', color: 'var(--primary-text)' }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.fullName ?? 'Operator'}</div>
                <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
              <span>Platform status</span>
              <span className="mono" style={{ color: liveFeeds > 0 ? 'var(--sev-low)' : 'var(--sev-medium)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{liveFeeds > 0 ? <span className="live-dot" /> : <span className="h-2 w-2 rounded-full" style={{ background: 'var(--sev-medium)' }} />} {liveFeeds}/5 live</span>
            </div>
            <div className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>Press <span className="mono">⌘K</span> or <span className="mono">Ctrl+K</span> for command palette.</div>
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
