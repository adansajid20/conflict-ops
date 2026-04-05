'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  Activity,
  Bell,
  Brain,
  Globe,
  LayoutDashboard,
  Plane,
  Radio,
  ScanSearch,
  Settings,
  Shield,
  Stethoscope,
  TrendingUp,
} from 'lucide-react'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { FreshnessBanner } from '@/components/layout/FreshnessBanner'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { IntelCopilot } from '@/components/copilot/IntelCopilot'
import { useHealthStatus } from '@/hooks/useHealthStatus'
import { safeTimeAgo } from '@/types/intel-item'

export const dynamic = 'force-dynamic'

type NavItem = {
  href: string
  label: string
  icon: unknown
  comingSoon?: boolean
}

const PRIMARY_NAV: NavItem[] = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/feed', label: 'Intel Feed', icon: Activity },
  { href: '/map', label: 'Operational Map', icon: Radio },
  { href: '/alerts', label: 'Alerts', icon: Bell },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Admin', icon: Stethoscope },
  { href: '/admin/doctor', label: 'Doctor', icon: Stethoscope },
]

const ANALYSIS_NAV: NavItem[] = [
  { href: '/analysis/trends', label: 'Trends', icon: TrendingUp },
  { href: '/analysis/predictions', label: 'Predictions', icon: Brain },
  { href: '/analysis/actors', label: 'Actor Network', icon: Globe },
  { href: '/analysis/reports', label: 'Reports', icon: Activity, comingSoon: true },
]

const TOOLS_NAV: NavItem[] = [
  { href: '/travel', label: 'Travel Risk', icon: Plane },
  { href: '/geoverify', label: 'GeoVerify', icon: ScanSearch },
  { href: '/workbench', label: 'Workbench', icon: Activity },
  { href: '/tools/similarity', label: 'Similarity Search', icon: Brain },
]

function NavLink({ item, pathname, alertCount = 0 }: { item: NavItem; pathname: string; alertCount?: number }) {
  const Icon = item.icon as React.ElementType
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

  if (item.comingSoon) {
    return (
      <button
        type="button"
        className="nav-item w-full opacity-50 cursor-not-allowed"
        title="Coming soon — on the roadmap"
        onClick={(event) => event.preventDefault()}
      >
        <Icon className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        <span>{item.label}</span>
        <span className="text-[9px] tracking-wider bg-white/5 text-white/30 rounded px-1 ml-auto">SOON</span>
      </button>
    )
  }

  return (
    <Link href={item.href} className={`nav-item transition-colors duration-150 ${active ? 'active' : ''}`} style={{ position: 'relative' }}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 2,
          background: 'var(--primary)',
          borderRadius: '0 2px 2px 0',
          opacity: active ? 1 : 0,
          transition: 'opacity 150ms ease',
        }}
      />
      <Icon className="h-4 w-4" style={{ color: active ? 'var(--primary-text)' : 'var(--text-muted)' }} />
      <span>{item.label}</span>
      {item.href === '/alerts' && alertCount > 0 && (
        <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] mono" style={{ background: 'var(--sev-critical-dim)', color: 'var(--sev-critical)' }}>
          {alertCount}
        </span>
      )}
    </Link>
  )
}

function SidebarStatus({ lastIngestAt, liveFeeds, totalFeeds }: { lastIngestAt: string | null; liveFeeds: number; totalFeeds: number }) {
  const [utcTime, setUtcTime] = useState('')

  useEffect(() => {
    const tick = () => setUtcTime(new Date().toISOString().slice(11, 19))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  }

  const ingestAgeMs = lastIngestAt ? Date.now() - new Date(lastIngestAt).getTime() : Number.POSITIVE_INFINITY
  const isWarning = ingestAgeMs > 5 * 60 * 1000
  const isStale = ingestAgeMs > 15 * 60 * 1000
  const ingestIcon = isStale ? '✕' : isWarning ? '⚠' : '⟳'
  const ingestColor = isStale ? 'var(--sev-critical)' : isWarning ? 'var(--sev-medium)' : 'var(--text-muted)'
  const ingestLabel = isStale ? 'STALE' : `INGEST ${safeTimeAgo(lastIngestAt)}`

  return (
    <div className="space-y-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span style={{ color: liveFeeds > 0 ? 'var(--sev-low)' : 'var(--sev-medium)' }}>🟢</span>
        <span>Live</span>
        <span>·</span>
        <span className="mono">{liveFeeds}/{totalFeeds}</span>
        <span>|</span>
        <span className="mono" style={{ color: ingestColor }}>{ingestIcon}</span>
        <span className="mono" style={{ color: ingestColor }}>{ingestLabel}</span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span>UTC <span className="mono">{utcTime}</span></span>
        <span>·</span>
        <button
          type="button"
          onClick={openCommandPalette}
          title="Open command palette"
          className="rounded-full border px-2 py-0.5 mono"
          style={{ borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
        >
          ⌘K
        </button>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { health } = useHealthStatus(60_000)
  const [alertCount, setAlertCount] = useState(0)
  const [branding, setBranding] = useState<{ logo_url?: string; primary_color?: string; accent_color?: string; app_name?: string } | null>(null)

  const isAdminMode = useMemo(() => {
    const envAdmin = process.env['NEXT_PUBLIC_ADMIN_MODE'] === 'true'
    const paramAdmin = searchParams?.get('admin') === '1'
    const onAdminRoute = pathname.startsWith('/admin')
    return envAdmin || paramAdmin || onAdminRoute
  }, [searchParams, pathname])

  useEffect(() => {
    fetch('/api/v1/me').catch(() => undefined)
    fetch('/api/v1/enterprise/branding', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: { data?: { logo_url?: string; primary_color?: string; accent_color?: string; app_name?: string } }) => setBranding(json.data ?? null))
      .catch(() => setBranding(null))
  }, [pathname])

  useEffect(() => {
    const fetchCount = () => {
      fetch('/api/v1/alerts/count', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data: { count: number }) => setAlertCount(data.count ?? 0))
        .catch(() => undefined)
    }

    fetchCount()
    const interval = setInterval(fetchCount, 60_000)
    return () => clearInterval(interval)
  }, [])

  const initials = user?.fullName
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'CO'

  const liveFeeds = health?.sources?.live ?? health?.enabledSources?.filter((source) => source.ok).length ?? 0
  const totalFeeds = health?.sources?.enabled ?? health?.enabledSources?.length ?? 5
  const lastIngestAt = health?.ingest?.last_success_at ?? health?.lastIngestAt ?? null

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--bg-base)', ['--primary' as string]: branding?.primary_color ?? 'var(--primary)', ['--accent' as string]: branding?.accent_color ?? 'var(--accent)' } as React.CSSProperties}>
      <CommandPalette />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[240px] shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
          <div className="border-b px-4 py-5" style={{ borderColor: 'var(--border)' }}>
            <Link href="/overview" className="flex items-start gap-3" style={{ textDecoration: 'none' }}>
              <div className="rounded-lg border p-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
                {(() => { const ShieldIcon = Shield as React.ElementType; return <ShieldIcon className="h-4 w-4" style={{ color: 'var(--primary-text)' }} /> })()}
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[0.04em]" style={{ color: 'var(--text-primary)' }}>{branding?.app_name ?? 'CONFLICTRADAR'}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Intelligence Platform</div>
              </div>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-4">
            <div className="mb-1 px-3 pb-2 text-xs tracking-widest opacity-50" style={{ color: 'var(--text-muted)' }}>
              INTELLIGENCE
            </div>
            <div className="mb-5 space-y-1">
              {PRIMARY_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} alertCount={alertCount} />
              ))}
              {isAdminMode && (
                <>
                  <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-[0.08em]" style={{ color: 'rgba(139,92,246,0.7)' }}>
                    Admin
                  </div>
                  {ADMIN_NAV.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </>
              )}
            </div>

            <div className="mb-1 px-3 pb-2 text-xs tracking-widest opacity-50" style={{ color: 'var(--text-muted)' }}>
              ANALYSIS
            </div>
            <div className="mb-5 space-y-1">
              {ANALYSIS_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>

            <div className="mb-1 px-3 pb-2 text-xs tracking-widest opacity-50" style={{ color: 'var(--text-muted)' }}>
              TOOLS
            </div>
            <div className="space-y-1">
              {TOOLS_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>

          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
            <div className="mb-2 space-y-1">
              <NavLink item={{ href: '/settings', label: 'Settings', icon: Settings }} pathname={pathname} />
              <NavLink item={{ href: '/settings/alerts', label: 'Alert Settings', icon: Bell }} pathname={pathname} />
            </div>
            <div className="mb-3 flex items-center gap-3 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: 'var(--bg-active)', color: 'var(--primary-text)' }}>
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user?.fullName ?? 'Operator'}</div>
                <div className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}</div>
              </div>
            </div>
            <SidebarStatus lastIngestAt={lastIngestAt} liveFeeds={liveFeeds} totalFeeds={totalFeeds} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <FreshnessBanner />
          <div className="flex justify-end border-b px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><NotificationBell /></div>
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <IntelCopilot />
    </div>
  )
}
