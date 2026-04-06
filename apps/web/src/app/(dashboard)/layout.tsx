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
  MapPin,
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
  { href: '/analysis/reports', label: 'Reports', icon: Activity },
  { href: '/analysis/market', label: 'Market Impact', icon: TrendingUp },
  { href: '/analysis/countries', label: 'Country Profiles', icon: MapPin },
]

const TOOLS_NAV: NavItem[] = [
  { href: '/travel', label: 'Travel Risk', icon: Plane },
  { href: '/geoverify', label: 'GeoVerify', icon: ScanSearch },
  { href: '/workbench', label: 'Workbench', icon: Activity },
  { href: '/tools/similarity', label: 'Similarity Search', icon: Brain },
  { href: '/tools/simulator', label: 'Scenario Simulator', icon: Brain },
  { href: '/tools/timeline', label: 'Event Timeline', icon: Activity },
  { href: '/tools/compare', label: 'Compare Regions', icon: Activity },
  { href: '/tools/sanctions', label: 'Sanctions Monitor', icon: Shield },
  { href: '/tools/personnel', label: 'Personnel Safety', icon: Shield },
  { href: '/tools/supply-chain', label: 'Supply Chain', icon: Activity },
  { href: '/custom', label: 'Custom Dashboard', icon: LayoutDashboard },
  { href: '/analyst', label: 'AI Analyst (Radar)', icon: Brain },
]

function NavLink({ item, pathname, alertCount = 0 }: { item: NavItem; pathname: string; alertCount?: number }) {
  const Icon = item.icon as React.ElementType
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

  if (item.comingSoon) {
    return (
      <button
        type="button"
        className="w-full opacity-50 cursor-not-allowed flex items-center gap-3 px-3 py-2 text-[13px] text-white/50 rounded-lg"
        title="Coming soon — on the roadmap"
        onClick={(event) => event.preventDefault()}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{item.label}</span>
        <span className="text-[9px] tracking-wider bg-white/5 text-white/30 rounded px-1 ml-auto flex-shrink-0">SOON</span>
      </button>
    )
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2 text-[13px] rounded-lg transition-all duration-150 relative ${
        active
          ? 'bg-white/[0.06] text-white/90'
          : 'text-white/50 hover:bg-white/[0.04]'
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-0 bottom-0 w-[2px] bg-blue-400 rounded-r transition-opacity duration-150 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-white/30'}`} />
      <span className="truncate flex-1">{item.label}</span>
      {item.href === '/alerts' && alertCount > 0 && (
        <span className="ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-500/15 text-red-400">
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
  const ingestColor = isStale ? '#f87171' : isWarning ? '#fbbf24' : 'rgba(255,255,255,0.3)'
  const ingestLabel = isStale ? 'STALE' : `INGEST ${safeTimeAgo(lastIngestAt)}`

  return (
    <div className="space-y-2 text-[10px] text-white/40">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span style={{ color: liveFeeds > 0 ? '#60a5fa' : '#fbbf24' }}>🟢</span>
        <span>Live</span>
        <span>·</span>
        <span className="mono">{liveFeeds}/{totalFeeds}</span>
        <span>|</span>
        <span className={`mono ${typeof ingestColor === 'string' && ingestColor.includes('var') ? '' : ingestColor}`} style={typeof ingestColor === 'string' && ingestColor.includes('var') ? { color: ingestColor } : {}}>{ingestIcon}</span>
        <span className={`mono ${typeof ingestColor === 'string' && ingestColor.includes('var') ? '' : ingestColor}`} style={typeof ingestColor === 'string' && ingestColor.includes('var') ? { color: ingestColor } : {}}>{ingestLabel}</span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span>UTC <span className="mono">{utcTime}</span></span>
        <span>·</span>
        <button
          type="button"
          onClick={openCommandPalette}
          title="Open command palette"
          className="rounded-full border px-2 py-0.5 mono text-white/40 border-white/[0.08] hover:border-white/[0.12] transition-colors duration-150"
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
    <div className="flex h-screen flex-col bg-[#070B11]" style={{ ['--primary' as string]: branding?.primary_color ?? '#3b82f6', ['--accent' as string]: branding?.accent_color ?? '#60a5fa' } as React.CSSProperties}>
      <CommandPalette />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[256px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0B0F18]">
          {/* Logo Section */}
          <div className="border-b border-white/[0.06] px-4 py-5">
            <Link href="/overview" className="flex items-center gap-2 no-underline hover:opacity-90 transition-opacity">
              <Shield className="h-5 w-5 text-blue-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-white">{branding?.app_name ?? 'ConflictRadar'}</div>
              </div>
            </Link>
          </div>

          {/* Nav Sections */}
          <div className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {/* Primary Nav */}
            <div className="mb-6">
              <div className="mb-2 px-3 text-[10px] uppercase tracking-[0.15em] text-white/20">
                Intelligence
              </div>
              <div className="space-y-1">
                {PRIMARY_NAV.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} alertCount={alertCount} />
                ))}
              </div>
            </div>

            {/* Admin Nav */}
            {isAdminMode && (
              <div className="mb-6">
                <div className="mb-2 px-3 text-[10px] uppercase tracking-[0.15em] text-white/20">
                  Admin
                </div>
                <div className="space-y-1">
                  {ADMIN_NAV.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Nav */}
            <div className="mb-6">
              <div className="mb-2 px-3 text-[10px] uppercase tracking-[0.15em] text-white/20">
                Analysis
              </div>
              <div className="space-y-1">
                {ANALYSIS_NAV.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>

            {/* Tools Nav */}
            <div>
              <div className="mb-2 px-3 text-[10px] uppercase tracking-[0.15em] text-white/20">
                Tools
              </div>
              <div className="space-y-1">
                {TOOLS_NAV.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
            {/* Settings Nav */}
            <div className="space-y-1">
              <NavLink item={{ href: '/settings', label: 'Settings', icon: Settings }} pathname={pathname} />
              <NavLink item={{ href: '/settings/alerts', label: 'Alert Settings', icon: Bell }} pathname={pathname} />
            </div>

            {/* User Card */}
            <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400/20 text-blue-300 text-xs font-semibold flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white/90">{user?.fullName ?? 'Operator'}</div>
                <div className="truncate text-xs text-white/40">{user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}</div>
              </div>
            </div>

            {/* Admin Status */}
            {isAdminMode && <SidebarStatus lastIngestAt={lastIngestAt} liveFeeds={liveFeeds} totalFeeds={totalFeeds} />}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#070B11]">
          <FreshnessBanner />

          {/* Top Bar */}
          <div className="flex justify-end border-b border-white/[0.04] px-4 py-3 bg-transparent">
            <NotificationBell />
          </div>

          {/* Page Content */}
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <IntelCopilot />
    </div>
  )
}
