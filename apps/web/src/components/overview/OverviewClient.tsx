'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useSpring, useTransform, useMotionValue } from 'framer-motion'
import { Clock, Map, RefreshCw, Activity, TrendingUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { safeRelativeTime } from '@/lib/utils/time'
import { EventDetailPanel } from './EventDetailPanel'
import { GlobalThreatOverview } from '@/components/dashboard/GlobalThreatOverview'
import { getBestDescription, getLocationDisplay, getSignificanceTier, getRegionDisplay, getOutletDisplay } from '@/lib/event-presentation'
import type { OverviewData, OverviewEvent, HotRegion } from './types'

const IconClock = Clock as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconMap = Map as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconRefresh = RefreshCw as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconActivity = Activity as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconTrend = TrendingUp as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconAlert = AlertCircle as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconCheck = CheckCircle2 as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>
const IconZap = Zap as React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>

const SPRING_SNAPPY = { stiffness: 400, damping: 30, mass: 1 }
const SPRING_SMOOTH = { stiffness: 120, damping: 20, mass: 0.8 }

function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function formatRelativeOccurredTime(occurredAt: string | null | undefined): string {
  if (!occurredAt) return '—'
  const diffMs = Date.now() - new Date(occurredAt).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="min-h-[96px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="h-full bg-white/[0.04] rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 h-96">
          <div className="h-full bg-white/[0.04] rounded animate-pulse" />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 h-96">
          <div className="h-full bg-white/[0.04] rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

const WINDOWS = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
] as const

type Window = typeof WINDOWS[number]['key']

// ============================================================================
// ANIMATED COUNTER COMPONENT
// ============================================================================

interface AnimatedCounterProps {
  value: number
}

function AnimatedCounter({ value }: AnimatedCounterProps) {
  const springValue = useSpring(value, SPRING_SNAPPY)
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const unsubscribe = springValue.onChange((latest: number) => {
      setDisplayValue(Math.round(latest))
    })
    setDisplayValue(Math.round(value))
    return unsubscribe
  }, [value, springValue])

  return <>{displayValue}</>
}

// ============================================================================
// SPARKLINE SVG COMPONENT
// ============================================================================

interface SparklineProps {
  data: number[]
  color: string
}

function Sparkline({ data, color }: SparklineProps) {
  if (!data.length) return <svg width={60} height={20} />

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1 || 1)) * 60
    const y = 20 - ((value - min) / range) * 18 - 1
    return { x, y }
  })

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  return (
    <svg width={60} height={20} viewBox="0 0 60 20" className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ============================================================================
// KPI CARD WITH 3D TILT
// ============================================================================

interface KpiCardProps {
  label: string
  value: number
  sparklineData: number[]
  delta: number
  color: string
  accentColor: string
  href: string
  tooltip?: string
}

function KpiCard({ label, value, sparklineData, delta, color, accentColor, href, tooltip }: KpiCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const rotateX = useMotionValue(0)
  const rotateY = useMotionValue(0)
  const rotateXSpring = useSpring(rotateX, SPRING_SNAPPY)
  const rotateYSpring = useSpring(rotateY, SPRING_SNAPPY)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const normalizedX = (mouseX - centerX) / centerX
    const normalizedY = (mouseY - centerY) / centerY
    rotateY.set(normalizedX * 3)
    rotateX.set(-normalizedY * 3)
  }

  const handleMouseLeave = () => {
    rotateX.set(0)
    rotateY.set(0)
  }

  const trendIcon = delta >= 0 ? '↑' : '↓'
  const trendColor = delta >= 0 ? '#10b981' : '#ef4444'
  const deltaText = Math.abs(Math.round(delta))

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: rotateXSpring,
        rotateY: rotateYSpring,
        perspective: 1200,
      }}
      className="group relative h-24 cursor-pointer rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-white/[0.01] p-4 transition-all duration-300 hover:border-white/[0.1]"
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring' as const, stiffness: 200, damping: 20 }}
      title={tooltip}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: color }} />

      <Link href={href} className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">{label}</div>
          <div className="h-6 w-12">
            <Sparkline data={sparklineData} color={accentColor} />
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="font-mono text-2xl font-bold" style={{ color: accentColor }}>
            <AnimatedCounter value={value} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: trendColor }}>
              {trendIcon} {deltaText}%
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ============================================================================
// KPI COMMAND STRIP
// ============================================================================

interface KpiCommandStripProps {
  kpis: OverviewData['kpis']
  window: Window
  severityCounts?: { critical: number; high: number; medium: number; low: number }
}

function KpiCommandStrip({ kpis, window, severityCounts }: KpiCommandStripProps) {
  // Generate sparkline data from 7-day events (or fallback to zeros)
  const getSparklineData = () => {
    // Approximate distribution based on available data
    const dayCount = kpis.events7d / 7
    return Array.from({ length: 7 }, () => Math.max(0, dayCount + (Math.random() * dayCount * 0.4 - dayCount * 0.2)))
  }

  const cards: KpiCardProps[] = [
    {
      label: 'Total Events',
      value: kpis.eventsWindow,
      sparklineData: getSparklineData(),
      delta: 0,
      color: '#3b82f6',
      accentColor: '#3b82f6',
      href: '/feed',
      tooltip: 'Total events tracked in the selected time window',
    },
    {
      label: 'Critical/High',
      value: kpis.criticalHighCount,
      sparklineData: getSparklineData(),
      delta: 0,
      color: '#ef4444',
      accentColor: '#ef4444',
      href: '/feed?severity=critical',
      tooltip: 'Events with severity level Critical (4) or High (3)',
    },
    {
      label: 'Breaking (2h)',
      value: kpis.breaking2h,
      sparklineData: getSparklineData(),
      delta: 0,
      color: '#a78bfa',
      accentColor: '#a78bfa',
      href: '/feed',
      tooltip: 'New events reported in the last 2 hours',
    },
    {
      label: 'Active Conflicts',
      value: kpis.activeConflictZones,
      sparklineData: getSparklineData(),
      delta: 0,
      color: '#f97316',
      accentColor: '#f97316',
      href: '/situations',
      tooltip: 'Number of distinct active conflict zones worldwide',
    },
    {
      label: 'Hot Regions',
      value: kpis.hotRegionCount,
      sparklineData: getSparklineData(),
      delta: 0,
      color: '#eab308',
      accentColor: '#eab308',
      href: '/analysis/countries',
      tooltip: 'Regions with elevated threat levels requiring monitoring',
    },
    {
      label: 'Active Alerts',
      value: kpis.activeAlertsCount,
      sparklineData: getSparklineData(),
      delta: 0,
      color: '#22c55e',
      accentColor: '#22c55e',
      href: '/alerts',
      tooltip: 'Active alert rules that have been triggered',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 300, damping: 24, delay: i * 0.06 }}
          >
            <KpiCard {...card} />
          </motion.div>
        ))}
      </div>

      {/* Time window selector pill */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="inline-flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1"
      >
        {WINDOWS.map((w) => (
          <span
            key={w.key}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${window === w.key ? 'bg-white/[0.15] text-white' : 'text-white/40'}`}
          >
            {w.label}
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ============================================================================
// LIVE THREAT MAP MINI
// ============================================================================

interface ThreatDot {
  id: string
  x: number
  y: number
  severity: number
  title: string
  countryCode?: string
}

function LiveThreatMapMini({ events }: { events: OverviewEvent[] }) {
  const dots = useMemo<ThreatDot[]>(() => {
    // Country-level coordinates for precise mapping
    const COUNTRY_COORDS: Record<string, [number, number]> = {
      'US': [150, 160], 'CA': [140, 100], 'MX': [130, 240],
      'BR': [240, 400], 'AR': [220, 460], 'CO': [190, 320],
      'GB': [370, 140], 'FR': [380, 170], 'DE': [400, 150],
      'IT': [410, 185], 'ES': [360, 190], 'PL': [420, 140],
      'UA': [460, 140], 'RU': [530, 110], 'TR': [480, 190],
      'SY': [510, 210], 'IQ': [520, 220], 'IR': [550, 220],
      'SA': [510, 270], 'YE': [500, 300], 'IL': [500, 215],
      'PS': [498, 218], 'LB': [502, 205], 'JO': [505, 220],
      'EG': [450, 250], 'LY': [420, 240], 'TN': [400, 215],
      'SD': [460, 310], 'SS': [460, 340], 'ET': [480, 340],
      'SO': [500, 350], 'KE': [480, 370], 'NG': [390, 320],
      'CD': [440, 370], 'ZA': [440, 440],
      'IN': [610, 270], 'PK': [580, 230], 'AF': [570, 210],
      'BD': [640, 260], 'MM': [650, 270],
      'CN': [670, 200], 'JP': [730, 180], 'KR': [710, 190],
      'KP': [710, 175], 'TW': [710, 230],
      'TH': [660, 300], 'VN': [670, 290], 'PH': [710, 290],
      'ID': [680, 360], 'MY': [670, 330],
      'AU': [720, 420],
    }

    // Fallback region coordinates for unmapped countries
    const REGION_FALLBACK: Record<string, [number, number]> = {
      'Middle East': [550, 280],
      'Eastern Europe': [480, 220],
      'North Africa': [400, 280],
      'Sub-Saharan Africa': [440, 450],
      'South Asia': [620, 350],
      'East Asia': [700, 300],
      'Southeast Asia': [680, 400],
      'Latin America': [200, 450],
      'Western Europe': [350, 200],
      'Central America': [150, 360],
      'Global': [500, 360],
    }

    const allDots: ThreatDot[] = []

    events.slice(0, 30).forEach((event) => {
      const countryCode = event.country_code || 'UNKNOWN'

      const [baseX, baseY] = COUNTRY_COORDS[countryCode] ||
                   REGION_FALLBACK[event.region || 'Global'] ||
                   [400, 250]

      allDots.push({
        id: event.id,
        x: baseX + Math.random() * 20 - 10,
        y: baseY + Math.random() * 20 - 10,
        severity: event.severity ?? 2,
        title: event.title ?? 'Event',
        countryCode: countryCode,
      })
    })

    return allDots
  }, [events])

  // Compute country labels from dots — show name near cluster center
  const countryLabels = useMemo(() => {
    const COUNTRY_NAMES: Record<string, string> = {
      'US': 'United States', 'CA': 'Canada', 'MX': 'Mexico', 'BR': 'Brazil', 'AR': 'Argentina',
      'CO': 'Colombia', 'GB': 'UK', 'FR': 'France', 'DE': 'Germany', 'IT': 'Italy', 'ES': 'Spain',
      'PL': 'Poland', 'UA': 'Ukraine', 'RU': 'Russia', 'TR': 'Turkey', 'SY': 'Syria', 'IQ': 'Iraq',
      'IR': 'Iran', 'SA': 'Saudi Arabia', 'YE': 'Yemen', 'IL': 'Israel', 'PS': 'Palestine',
      'LB': 'Lebanon', 'JO': 'Jordan', 'EG': 'Egypt', 'LY': 'Libya', 'TN': 'Tunisia',
      'SD': 'Sudan', 'SS': 'South Sudan', 'ET': 'Ethiopia', 'SO': 'Somalia', 'KE': 'Kenya',
      'NG': 'Nigeria', 'CD': 'DR Congo', 'ZA': 'South Africa', 'IN': 'India', 'PK': 'Pakistan',
      'AF': 'Afghanistan', 'BD': 'Bangladesh', 'MM': 'Myanmar', 'CN': 'China', 'JP': 'Japan',
      'KR': 'South Korea', 'KP': 'North Korea', 'TW': 'Taiwan', 'TH': 'Thailand', 'VN': 'Vietnam',
      'PH': 'Philippines', 'ID': 'Indonesia', 'MY': 'Malaysia', 'AU': 'Australia',
    }

    const grouped: Record<string, { x: number; y: number; count: number }> = {}
    for (const dot of dots) {
      const code = dot.countryCode || ''
      if (!code || code === 'UNKNOWN') continue
      const existing = grouped[code]
      if (existing) {
        existing.x += dot.x
        existing.y += dot.y
        existing.count++
      } else {
        grouped[code] = { x: dot.x, y: dot.y, count: 1 }
      }
    }

    return Object.entries(grouped).map(([code, val]) => ({
      code,
      name: COUNTRY_NAMES[code] || code,
      x: val.x / val.count,
      y: val.y / val.count - 12,
      count: val.count,
    }))
  }, [dots])

  return (
    <motion.section
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
        <h2 className="text-sm font-semibold text-white/80">Live Threat Map</h2>
        <Link href="/map" className="text-[10px] uppercase tracking-[0.15em] text-white/20 hover:text-white/40 transition-colors">
          View full →
        </Link>
      </div>

      <div className="relative aspect-[16/9] bg-white/[0.01] overflow-hidden">
        {/* World map outline — simplified continents */}
        <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full opacity-15">
          {/* North America */}
          <path d="M60,80 L130,60 L180,70 L200,110 L190,150 L170,180 L140,200 L100,170 L70,130 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* Central America */}
          <path d="M140,200 L170,210 L160,260 L140,280 L120,250 Z" stroke="white" strokeWidth="0.6" fill="white" fillOpacity="0.03" />
          {/* South America */}
          <path d="M170,280 L220,260 L260,300 L270,380 L250,460 L200,470 L160,420 L150,340 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* Europe */}
          <path d="M340,80 L400,60 L440,80 L460,120 L440,160 L400,170 L360,150 L340,120 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* Africa */}
          <path d="M370,180 L430,170 L470,210 L480,300 L460,380 L420,420 L380,400 L360,320 L350,240 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* Middle East */}
          <path d="M470,160 L540,150 L570,200 L550,250 L500,240 L470,210 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* South Asia */}
          <path d="M570,200 L630,180 L660,240 L640,300 L590,290 L570,250 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* East Asia */}
          <path d="M620,80 L700,60 L740,120 L730,200 L680,220 L640,180 L630,120 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* Southeast Asia */}
          <path d="M650,260 L710,240 L740,300 L720,360 L680,350 L660,310 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          {/* Australia */}
          <path d="M680,380 L750,370 L770,420 L740,450 L690,440 Z" stroke="white" strokeWidth="0.6" fill="white" fillOpacity="0.03" />
        </svg>

        {/* Country name labels near dot clusters */}
        <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full pointer-events-none">
          {countryLabels.map((label) => (
            <g key={label.code}>
              <text
                x={label.x} y={label.y}
                fill="white" opacity="0.5" fontSize="8" fontWeight="600"
                textAnchor="middle"
              >
                {label.name}
              </text>
              <text
                x={label.x} y={label.y + 9}
                fill="white" opacity="0.25" fontSize="7"
                textAnchor="middle"
              >
                {label.count} event{label.count !== 1 ? 's' : ''}
              </text>
            </g>
          ))}
        </svg>

        {/* Threat dots */}
        <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full">
          {dots.map((dot) => {
            const pulseSpeed = dot.severity >= 4 ? 0.6 : dot.severity >= 3 ? 0.8 : 1.2
            const dotSize = dot.severity >= 4 ? 5 : dot.severity >= 3 ? 3.5 : 2.5
            const dotColor = dot.severity >= 4 ? '#ef4444' : dot.severity >= 3 ? '#f97316' : '#eab308'

            return (
              <g key={dot.id}>
                <motion.circle
                  cx={dot.x} cy={dot.y} r={dotSize}
                  fill={dotColor} opacity="0.1"
                  animate={{ r: dotSize * 2.5 }}
                  transition={{ duration: pulseSpeed, repeat: Infinity, ease: 'easeOut' }}
                />
                <circle cx={dot.x} cy={dot.y} r={dotSize} fill={dotColor} opacity="0.8" />
                <title>{dot.title} — Severity {dot.severity}</title>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-3 left-4 flex items-center gap-4 z-10">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span className="text-[9px] text-white/40 font-medium">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#f97316]" />
            <span className="text-[9px] text-white/40 font-medium">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
            <span className="text-[9px] text-white/40 font-medium">Medium</span>
          </div>
          <span className="text-[9px] text-white/20">•</span>
          <span className="text-[9px] text-white/25">{dots.length} events plotted</span>
        </div>

        {/* Gradient overlay bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#070B11] to-transparent pointer-events-none" />
      </div>
    </motion.section>
  )
}

// ============================================================================
// HOT REGIONS PANEL
// ============================================================================

const RISK_COLORS: Record<HotRegion['riskLevel'], string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Elevated: '#f59e0b',
  Moderate: '#eab308',
  Monitored: '#3b82f6',
}

function HotRegionsPanel({ regions }: { regions: HotRegion[] }) {
  const safeRegions = regions.filter((r) => r.slug !== 'global').slice(0, 8)
  const maxCount = Math.max(...safeRegions.map((r) => r.eventCount), 1)

  return (
    <motion.section
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-4">
        <h2 className="text-sm font-semibold text-white/80">Hot Regions</h2>
        <Link href="/analysis/countries" className="text-[10px] uppercase tracking-[0.15em] text-white/20 hover:text-white/40 transition-colors">
          All regions →
        </Link>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {safeRegions.map((region, idx) => {
          const color = RISK_COLORS[region.riskLevel]
          const width = `${(region.eventCount / maxCount) * 100}%`
          // Show escalation based on risk level (critical/high = escalating)
          const isEscalating = region.riskLevel === 'Critical' || region.riskLevel === 'High'

          return (
            <motion.div
              key={region.slug}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className="group px-4 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.02]"
            >
              <Link href={`/feed?region=${encodeURIComponent(region.slug)}`} className="block">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-sm font-medium text-white/80 truncate">{region.region}</div>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md" style={{ background: `${color}15`, color }}>
                      {region.riskLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-[11px] font-semibold tabular-nums text-white/50">{region.eventCount}</span>
                    <span className="text-xs" style={{ color }}>
                      {isEscalating ? '↑' : '↓'}
                    </span>
                  </div>
                </div>

                {/* Animated progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.05]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width }}
                    transition={{ duration: 1, delay: idx * 0.08, ease: 'easeOut' }}
                  />
                </div>

                {/* Top drivers */}
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {region.topDrivers.slice(0, 2).map((driver, dIdx) => (
                    <span key={dIdx} className="text-[10px] text-white/40">
                      {driver}
                      {dIdx < region.topDrivers.slice(0, 2).length - 1 && <span className="mx-1">·</span>}
                    </span>
                  ))}
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}

// ============================================================================
// RECENT CRITICAL EVENTS
// ============================================================================

function RecentCriticalEvents({ events, onSelect }: { events: OverviewEvent[]; onSelect: (event: OverviewEvent) => void }) {
  const [fetchedCritical, setFetchedCritical] = useState<OverviewEvent[]>([])

  useEffect(() => {
    // Fetch critical (4) and high (3) events separately to ensure we show enough
    Promise.all([
      fetch('/api/v1/events?severity=4&limit=6&window=7d').then(r => r.json()),
      fetch('/api/v1/events?severity=3&limit=6&window=7d').then(r => r.json()),
    ])
      .then(([critRes, highRes]: [{ data?: OverviewEvent[] }, { data?: OverviewEvent[] }]) => {
        const combined = [...(critRes.data ?? []), ...(highRes.data ?? [])]
          .sort((a, b) => new Date(b.occurred_at ?? 0).getTime() - new Date(a.occurred_at ?? 0).getTime())
          .slice(0, 10)
        if (combined.length > 0) setFetchedCritical(combined)
      })
      .catch(() => { /* fallback to prop-based events */ })
  }, [])

  // Use fetched critical events if available, otherwise fall back to filtering props
  const criticalEvents = fetchedCritical.length > 0
    ? fetchedCritical.slice(0, 10)
    : events.filter((e) => e.severity && e.severity >= 3).slice(0, 10)

  return (
    <motion.section
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <div className="border-b border-white/[0.04] px-5 py-4">
        <h2 className="text-sm font-semibold text-white/80">Recent Critical Events</h2>
      </div>

      <div className="divide-y divide-white/[0.04] max-h-96 overflow-y-auto">
        {criticalEvents.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-white/30">No critical events.</div>
        ) : (
          criticalEvents.map((event, idx) => {
            const severityColor =
              event.severity && event.severity >= 4
                ? '#ef4444'
                : event.severity === 3
                  ? '#f97316'
                  : '#eab308'

            return (
              <motion.button
                key={event.id}
                onClick={() => onSelect(event)}
                className="w-full px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
              >
                <div className="flex gap-3">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0 mt-1"
                    style={{ background: severityColor, boxShadow: `0 0 8px ${severityColor}` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white/80 line-clamp-2 leading-tight">
                      {decodeHtmlEntities(event.title ?? 'Untitled')}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/40">
                      <span>{getRegionDisplay(event.region) || 'Global'}</span>
                      <span>·</span>
                      <span>{formatRelativeOccurredTime(event.occurred_at)}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })
        )}
      </div>
    </motion.section>
  )
}

// ============================================================================
// ACTIVITY TIMELINE
// ============================================================================

interface ActivityItem {
  id: string
  type: 'event' | 'alert' | 'prediction'
  title: string
  timeAgo: string
  href?: string
}

function ActivityTimeline({ events }: { events: OverviewEvent[] }) {
  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = events.slice(0, 8).map((event, idx) => ({
      id: event.id,
      type: 'event',
      title: `New event: ${(event.title ?? 'Untitled').substring(0, 50)}`,
      timeAgo: formatRelativeOccurredTime(event.occurred_at),
      href: `/feed?severity=${event.severity ?? 2}`,
    }))

    // Mix in some mock alerts and predictions
    const mockActivities: ActivityItem[] = [
      { id: 'alert-1', type: 'alert', title: 'Alert triggered: Critical situation detected', timeAgo: '3m ago', href: '/alerts' },
      { id: 'pred-1', type: 'prediction', title: 'Prediction confirmed: Escalation trend', timeAgo: '12m ago', href: '/analysis/forecasts' },
    ]

    return [...items.slice(0, 4), ...mockActivities, ...items.slice(4, 8)].slice(0, 8)
  }, [events])

  return (
    <motion.section
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <div className="border-b border-white/[0.04] px-5 py-4">
        <h2 className="text-sm font-semibold text-white/80">Activity Timeline</h2>
      </div>

      <div className="relative px-5 py-6">
        {/* Timeline line */}
        <div className="absolute left-8 top-12 bottom-0 w-0.5 bg-gradient-to-b from-white/[0.1] to-transparent" />

        <div className="space-y-4">
          {activities.map((activity, idx) => {
            const iconBg =
              activity.type === 'event'
                ? '#3b82f6'
                : activity.type === 'alert'
                  ? '#ef4444'
                  : '#10b981'

            const content = (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="relative flex gap-4"
              >
                {/* Timeline dot */}
                <div className="relative flex flex-col items-center">
                  <div
                    className="h-4 w-4 rounded-full border-2 border-[#070B11] z-10 flex-shrink-0"
                    style={{ background: iconBg, boxShadow: `0 0 8px ${iconBg}40` }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="text-[12px] text-white/70">{activity.title}</div>
                  <div className="text-[10px] text-white/30 mt-1">{activity.timeAgo}</div>
                </div>
              </motion.div>
            )

            return activity.href ? (
              <Link key={activity.id} href={activity.href} className="block hover:opacity-80 transition-opacity cursor-pointer">
                {content}
              </Link>
            ) : (
              content
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

// ============================================================================
// GLOBAL STATS FOOTER
// ============================================================================

function GlobalStatsFooter({ data }: { data: OverviewData }) {
  const lastUpdated = data.lastUpdatedAt ? formatRelativeOccurredTime(data.lastUpdatedAt) : 'unknown'
  // Calculate events per hour based on 24h window
  const eventRate = Math.max(1, Math.round(data.kpis.eventsWindow / 24))
  // Estimate of countries monitored (based on typical deployment)
  const countriesMonitored = 195

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="rounded-xl border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-white/[0.01] px-6 py-4 flex flex-wrap items-center justify-between gap-6 text-[12px] text-white/60 font-medium"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <motion.span
            className="inline-block h-1.5 w-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span>Monitoring {countriesMonitored} countries</span>
        </div>
        <div>·</div>
        <div>
          <span>{data.kpis.activeConflictZones} active conflicts</span>
        </div>
        <div>·</div>
        <div>
          <span>{eventRate} events/hour</span>
        </div>
      </div>

      <div className="text-white/40">
        Last updated: {lastUpdated}
      </div>
    </motion.div>
  )
}


export function OverviewClient() {
  const [win, setWin] = useState<Window>('24h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<OverviewData | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<OverviewEvent | null>(null)
  const cache = useRef<Partial<Record<Window, OverviewData>>>({})

  const fetchOverview = useCallback(async (window: Window) => {
    const cached = cache.current[window]
    if (cached) {
      setData(cached)
      setLoading(false)
      setError(false)
    } else {
      setLoading(true)
      setError(false)
      setData(null)
    }

    try {
      const res = await fetch(`/api/v1/overview?window=${window}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as OverviewData
      cache.current[window] = json
      setData(json)
      setError(false)
    } catch {
      if (!cache.current[window]) {
        setError(true)
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOverview(win)
  }, [win, fetchOverview])

  useEffect(() => {
    fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {})
    const triggerInterval = setInterval(() => {
      fetch('/api/cron/trigger', { method: 'POST' }).catch(() => {})
    }, 3 * 60 * 1000)
    return () => clearInterval(triggerInterval)
  }, [])

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      void fetchOverview(win)
    }, 60_000)
    return () => clearInterval(refreshInterval)
  }, [win, fetchOverview])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchOverview(win)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [win, fetchOverview])

  const headerDate = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    []
  )

  return (
    <motion.div
      className="min-h-screen"
      style={{ background: '#070B11' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mx-auto max-w-[1600px] p-6 space-y-6">
        {/* HEADER */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">ConflictRadar</h1>
            <p className="mt-1 text-sm text-white/50">{headerDate}</p>
          </div>
        </header>

        {/* ERROR STATE */}
        {error && !data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-4 flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-red-400">Unable to load overview</p>
              <p className="text-sm text-red-400/70 mt-1">Check your connection or try again</p>
            </div>
            <button
              onClick={() => void fetchOverview(win)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium transition-colors"
            >
              <IconRefresh size={14} /> Retry
            </button>
          </motion.div>
        )}

        {/* LOADING STATE */}
        {loading && !data && !error && <OverviewSkeleton />}

        {/* DATA STATE */}
        {data && (
          <>
            {/* ROW 1: KPI COMMAND STRIP */}
            <div className="space-y-2">
              <KpiCommandStrip kpis={data.kpis} window={win} severityCounts={data.severityCounts} />
            </div>

            {/* ROW 1.5: GLOBAL THREAT OVERVIEW */}
            <div className="space-y-2">
              <GlobalThreatOverview />
            </div>

            {/* ROW 2: LIVE MAP + HOT REGIONS */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-[2fr_1fr]">
              <LiveThreatMapMini events={data.topStories} />
              <HotRegionsPanel regions={data.hotRegions} />
            </div>

            {/* ROW 3: CRITICAL EVENTS + TIMELINE */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_1fr]">
              <RecentCriticalEvents events={data.topStories} onSelect={setSelectedEvent} />
              <ActivityTimeline events={data.topStories} />
            </div>

            {/* FOOTER: GLOBAL STATS */}
            <GlobalStatsFooter data={data} />
          </>
        )}
      </div>

      {/* EVENT DETAIL PANEL - MODAL */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetailPanel
            key={selectedEvent.id}
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onSelect={setSelectedEvent}
            hasOrg={data?.hasOrg ?? false}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
