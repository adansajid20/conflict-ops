'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Brain,
  ChevronLeft,
  Coins,
  Clock,
  FileText,
  Flag,
  FlaskConical,
  GitCompare,
  Globe,
  Heart,
  LayoutDashboard,
  LineChart,
  Lock,
  MapPin,
  Palette,
  Plane,
  Radar,
  Radio,
  Rss,
  Settings,
  Shield,
  Stethoscope,
  Target,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wrench,
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

type NavSection = {
  label: string
  items: NavItem[]
}

const INTELLIGENCE_NAV: NavItem[] = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/feed', label: 'Intel Feed', icon: Rss },
  { href: '/map', label: 'Operational Map', icon: Globe },
  { href: '/alerts', label: 'Alerts', icon: Bell },
]

const ANALYSIS_NAV: NavItem[] = [
  { href: '/analysis/trends', label: 'Trends', icon: TrendingUp },
  { href: '/analysis/predictions', label: 'Predictions', icon: Brain },
  { href: '/analysis/forecasts', label: 'Predictive Forecasts', icon: LineChart },
  { href: '/analysis/actors', label: 'Actors', icon: Users },
  { href: '/analysis/reports', label: 'Reports', icon: FileText },
  { href: '/analysis/countries', label: 'Countries', icon: Flag },
  { href: '/analysis/market', label: 'Market', icon: BarChart3 },
]

const INTELLIGENCE_PREMIUM_NAV: NavItem[] = [
  { href: '/situation-room', label: 'Situation Room', icon: Radio },
  { href: '/humanitarian', label: 'Humanitarian Tracker', icon: Heart },
  { href: '/anomalies', label: 'Anomalies', icon: AlertTriangle },
]

const TOOLS_NAV: NavItem[] = [
  { href: '/travel', label: 'Travel', icon: Plane },
  { href: '/geoverify', label: 'GeoVerify', icon: MapPin },
  { href: '/workbench', label: 'Workbench', icon: Wrench },
  { href: '/tools/simulator', label: 'Simulator', icon: FlaskConical },
  { href: '/tools/timeline', label: 'Timeline', icon: Clock },
  { href: '/tools/compare', label: 'Compare', icon: GitCompare },
  { href: '/tools/sanctions', label: 'Sanctions', icon: Shield },
  { href: '/tools/personnel', label: 'Personnel', icon: UserCheck },
  { href: '/tools/supply-chain', label: 'Supply Chain', icon: Truck },
  { href: '/custom', label: 'Custom', icon: Palette },
  { href: '/analyst', label: 'Analyst', icon: Bot },
  { href: '/tools/tracking', label: 'Tracking', icon: Radar },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Admin', icon: Lock },
  { href: '/admin/doctor', label: 'Doctor', icon: Stethoscope },
]

const REFERENCE_NAV: NavItem[] = [
  { href: '/methodology', label: 'Methodology', icon: FileText },
]

const NAV_SECTIONS: NavSection[] = [
  { label: 'INTELLIGENCE', items: INTELLIGENCE_NAV },
  { label: 'INTELLIGENCE (PREMIUM)', items: INTELLIGENCE_PREMIUM_NAV },
  { label: 'ANALYSIS', items: ANALYSIS_NAV },
  { label: 'TOOLS', items: TOOLS_NAV },
  { label: 'REFERENCE', items: REFERENCE_NAV },
]

function NavLink({
  item,
  pathname,
  alertCount = 0,
  collapsed = false,
}: {
  item: NavItem
  pathname: string
  alertCount?: number
  collapsed?: boolean
}) {
  const Icon = item.icon as React.ElementType
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

  if (item.comingSoon) {
    return (
      <button
        type="button"
        className="w-full opacity-50 cursor-not-allowed flex items-center justify-center gap-3 px-3 py-2 text-[13px] text-white/50 rounded-[6px]"
        title="Coming soon"
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    )
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`relative flex items-center justify-center gap-3 px-3 py-2 text-[13px] rounded-[6px] transition-all duration-150 ${
        active
          ? 'bg-blue-500/15 text-blue-400'
          : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'
      }`}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-500 rounded-r transition-opacity duration-150"
        />
      )}
      <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-white/40'}`} />
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-left">{item.label}</span>
          {item.href === '/alerts' && alertCount > 0 && (
            <span className="ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400">
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

function SidebarStatus({
  lastIngestAt,
  liveFeeds,
  totalFeeds,
  collapsed = false,
}: {
  lastIngestAt: string | null
  liveFeeds: number
  totalFeeds: number
  collapsed?: boolean
}) {
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

  if (collapsed) {
    const isLive = liveFeeds > 0
    return (
      <div
        className="flex items-center justify-center h-6 w-6 rounded-full relative"
        title={`Live: ${liveFeeds}/${totalFeeds}`}
      >
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: isLive ? '#22c55e' : '#eab308' }}
        />
      </div>
    )
  }

  const ingestAgeMs = lastIngestAt ? Date.now() - new Date(lastIngestAt).getTime() : Number.POSITIVE_INFINITY
  const isWarning = ingestAgeMs > 5 * 60 * 1000
  const isStale = ingestAgeMs > 15 * 60 * 1000
  const ingestIcon = isStale ? '✕' : isWarning ? '⚠' : '⟳'
  const ingestColor = isStale ? '#ef4444' : isWarning ? '#eab308' : 'rgba(255,255,255,0.3)'

  return (
    <div className="space-y-3 text-[11px] text-white/50">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: liveFeeds > 0 ? '#22c55e' : '#eab308' }}
        />
        <span className="font-medium">Live</span>
        <span className="text-white/30">·</span>
        <span className="font-mono text-white/40">
          {liveFeeds}/{totalFeeds}
        </span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span style={{ color: ingestColor }}>{ingestIcon}</span>
        <span className="font-mono text-white/40">UTC {utcTime}</span>
      </div>
      <button
        type="button"
        onClick={openCommandPalette}
        title="Open command palette (⌘K)"
        className="w-full flex items-center justify-center gap-1.5 rounded-[6px] border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 text-white/40 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-150"
      >
        <span className="font-mono text-[10px]">⌘K</span>
      </button>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { health } = useHealthStatus(60_000)
  const [alertCount, setAlertCount] = useState(0)
  const [branding, setBranding] = useState<{
    logo_url?: string
    primary_color?: string
    accent_color?: string
    app_name?: string
  } | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const isAdminMode = useMemo(() => {
    const envAdmin = process.env['NEXT_PUBLIC_ADMIN_MODE'] === 'true'
    const onAdminRoute = pathname.startsWith('/admin')
    return envAdmin || onAdminRoute
  }, [pathname])

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored !== null) {
      setCollapsed(JSON.parse(stored))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed))
  }, [collapsed])

  useEffect(() => {
    fetch('/api/v1/me').catch(() => undefined)
    fetch('/api/v1/enterprise/branding', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: { data?: any }) => setBranding(json.data ?? null))
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

  const liveFeeds = health?.sources?.live ?? health?.enabledSources?.filter((source: any) => source.ok).length ?? 0
  const totalFeeds = health?.sources?.enabled ?? health?.enabledSources?.length ?? 5
  const lastIngestAt = health?.ingest?.last_success_at ?? health?.lastIngestAt ?? null

  return (
    <div
      className="flex h-screen flex-col bg-[#070B11]"
      style={
        {
          ['--primary' as string]: branding?.primary_color ?? '#3b82f6',
          ['--accent' as string]: branding?.accent_color ?? '#60a5fa',
        } as React.CSSProperties
      }
    >
      <CommandPalette />
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={`shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0B0F18] transition-all duration-200 ${
            collapsed ? 'w-[64px]' : 'w-[240px]'
          }`}
        >
          {/* Logo Section */}
          <div className="border-b border-white/[0.06] px-3 py-5 flex items-center justify-between">
            {!collapsed && (
              <Link
                href="/overview"
                className="flex items-center gap-2 no-underline hover:opacity-90 transition-opacity"
              >
                <Shield className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="text-sm font-semibold text-white truncate">
                  {branding?.app_name ?? 'ConflictRadar'}
                </div>
              </Link>
            )}
            {collapsed && (
              <Link href="/overview" className="flex items-center justify-center no-underline">
                <Shield className="h-5 w-5 text-blue-400" />
              </Link>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex items-center justify-center h-8 w-8 rounded-[6px] hover:bg-white/[0.08] transition-colors duration-150 text-white/50 hover:text-white/70"
            >
              <ChevronLeft
                className={`h-4 w-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Nav Sections */}
          <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                {!collapsed && (
                  <div className="mb-3 px-3 text-[10px] uppercase tracking-[0.12em] font-semibold text-white/30">
                    {section.label}
                  </div>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      alertCount={item.href === '/alerts' ? alertCount : 0}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Admin Section */}
            {isAdminMode && (
              <div>
                {!collapsed && (
                  <div className="mb-3 px-3 text-[10px] uppercase tracking-[0.12em] font-semibold text-white/30">
                    SETTINGS
                  </div>
                )}
                <div className="space-y-1">
                  {ADMIN_NAV.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Section */}
          <div className="border-t border-white/[0.06] px-3 py-4 space-y-4">
            {/* Settings Link */}
            {!isAdminMode && (
              <NavLink
                item={{ href: '/settings', label: 'Settings', icon: Settings }}
                pathname={pathname}
                collapsed={collapsed}
              />
            )}

            {/* Status Indicator */}
            {isAdminMode && <SidebarStatus lastIngestAt={lastIngestAt} liveFeeds={liveFeeds} totalFeeds={totalFeeds} collapsed={collapsed} />}

            {/* User Card */}
            {!collapsed && (
              <div className="flex items-center gap-3 rounded-[6px] border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white/90">
                    {user?.fullName ?? 'Operator'}
                  </div>
                  <div className="truncate text-xs text-white/40">
                    {user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}
                  </div>
                </div>
              </div>
            )}

            {collapsed && (
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold flex-shrink-0 mx-auto">
                {initials}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col bg-[#070B11]">
          <FreshnessBanner />

          {/* Top Bar */}
          <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-6 bg-white/[0.01]">
            {/* Left side: Breadcrumbs/Title */}
            <div className="text-sm text-white/50">
              {/* Breadcrumb or page title can go here */}
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-4">
              <NotificationBell />
            </div>
          </div>

          {/* Page Content */}
          <main className="min-h-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
      <IntelCopilot />
    </div>
  )
}
