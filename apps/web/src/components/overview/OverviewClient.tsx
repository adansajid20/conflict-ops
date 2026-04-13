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
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{label}</div>
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
  onWindowChange: (w: Window) => void
  severityCounts?: { critical: number; high: number; medium: number; low: number }
}

function KpiCommandStrip({ kpis, window, onWindowChange, severityCounts }: KpiCommandStripProps) {
  // Generate deterministic sparkline data from 7-day events (no Math.random)
  const getSparklineData = useMemo(() => {
    const dayCount = kpis.events7d / 7
    if (dayCount <= 0) return [0, 0, 0, 0, 0, 0, 0]
    // Deterministic variation pattern based on total count (simulates weekly rhythm)
    const pattern = [0.85, 1.1, 1.15, 1.05, 0.95, 0.9, 0.8]
    return pattern.map(p => Math.round(dayCount * p))
  }, [kpis.events7d])

  const cards: KpiCardProps[] = [
    {
      label: 'Total Events',
      value: kpis.eventsWindow,
      sparklineData: getSparklineData,
      delta: 0,
      color: '#3b82f6',
      accentColor: '#3b82f6',
      href: '/feed',
      tooltip: 'Total events tracked in the selected time window',
    },
    {
      label: 'Critical/High',
      value: kpis.criticalHighCount,
      sparklineData: getSparklineData,
      delta: 0,
      color: '#ef4444',
      accentColor: '#ef4444',
      href: '/feed?severity=critical',
      tooltip: 'Events with severity level Critical (4) or High (3)',
    },
    {
      label: 'Breaking (2h)',
      value: kpis.breaking2h,
      sparklineData: getSparklineData,
      delta: 0,
      color: '#a78bfa',
      accentColor: '#a78bfa',
      href: '/feed',
      tooltip: 'New events reported in the last 2 hours',
    },
    {
      label: 'Active Conflicts',
      value: kpis.activeConflictZones,
      sparklineData: getSparklineData,
      delta: 0,
      color: '#f97316',
      accentColor: '#f97316',
      href: '/situations',
      tooltip: 'Number of distinct active conflict zones worldwide',
    },
    {
      label: 'Hot Regions',
      value: kpis.hotRegionCount,
      sparklineData: getSparklineData,
      delta: 0,
      color: '#eab308',
      accentColor: '#eab308',
      href: '/analysis/countries',
      tooltip: 'Regions with elevated threat levels requiring monitoring',
    },
    {
      label: 'Active Alerts',
      value: kpis.activeAlertsCount,
      sparklineData: getSparklineData,
      delta: 0,
      color: '#22c55e',
      accentColor: '#22c55e',
      href: '/alerts',
      tooltip: 'Active alert rules that have been triggered',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
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
          <button
            key={w.key}
            onClick={() => onWindowChange(w.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${window === w.key ? 'bg-white/[0.15] text-white' : 'text-white/40 hover:text-white/60'}`}
          >
            {w.label}
          </button>
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

function LiveThreatMapMini({ events = [] }: { events: OverviewEvent[] }) {
  // Aggregate events by country for the map — show one dot per country, sized by count
  const countryAggregates = useMemo(() => {
    // Well-spaced country coordinates on a Mercator-like 800×500 projection
    const COUNTRY_COORDS: Record<string, [number, number]> = {
      'US': [150, 170], 'CA': [145, 105], 'MX': [125, 245],
      'BR': [245, 390], 'AR': [225, 455], 'CO': [195, 315],
      'VE': [215, 295], 'PE': [190, 360], 'CL': [210, 435],
      'GB': [368, 122], 'FR': [382, 158], 'DE': [402, 135],
      'IT': [412, 172], 'ES': [358, 178], 'PL': [425, 128],
      'UA': [462, 138], 'RU': [530, 100], 'TR': [478, 178],
      // Middle East — spread these out more so they don't cluster
      'SY': [490, 195], 'IQ': [510, 208], 'IR': [548, 198],
      'SA': [505, 262], 'YE': [492, 298], 'IL': [476, 210],
      'PS': [474, 218], 'LB': [478, 198], 'JO': [484, 222],
      'AE': [530, 252], 'KW': [518, 232], 'OM': [540, 270],
      // North Africa
      'EG': [448, 238], 'LY': [415, 228], 'TN': [398, 206],
      'DZ': [378, 218], 'MA': [358, 218],
      // Sub-Saharan Africa — well-spaced
      'SD': [458, 298], 'SS': [452, 328], 'ET': [478, 328],
      'SO': [500, 340], 'KE': [476, 365], 'NG': [388, 312],
      'CD': [438, 365], 'ZA': [438, 438], 'ML': [370, 288],
      'BF': [372, 298], 'CM': [408, 335], 'MZ': [458, 410],
      'CF': [425, 340],
      // South Asia
      'IN': [600, 262], 'PK': [572, 222], 'AF': [562, 202],
      'BD': [618, 248], 'NP': [598, 235], 'LK': [608, 300],
      // East Asia
      'CN': [660, 192], 'JP': [728, 172], 'KR': [708, 185],
      'KP': [700, 168], 'TW': [705, 228], 'MN': [642, 142],
      // Southeast Asia
      'MM': [638, 260], 'TH': [650, 288], 'VN': [662, 278],
      'PH': [705, 278], 'ID': [675, 355], 'MY': [665, 322],
      'KH': [658, 298], 'LA': [652, 268],
      // Oceania
      'AU': [718, 415],
    }

    const COUNTRY_NAMES: Record<string, string> = {
      'US': 'United States', 'CA': 'Canada', 'MX': 'Mexico', 'BR': 'Brazil', 'AR': 'Argentina',
      'CO': 'Colombia', 'VE': 'Venezuela', 'PE': 'Peru', 'CL': 'Chile',
      'GB': 'UK', 'FR': 'France', 'DE': 'Germany', 'IT': 'Italy', 'ES': 'Spain',
      'PL': 'Poland', 'UA': 'Ukraine', 'RU': 'Russia', 'TR': 'Turkey',
      'SY': 'Syria', 'IQ': 'Iraq', 'IR': 'Iran', 'SA': 'Saudi Arabia', 'YE': 'Yemen',
      'IL': 'Israel', 'PS': 'Palestine', 'LB': 'Lebanon', 'JO': 'Jordan',
      'AE': 'UAE', 'KW': 'Kuwait', 'OM': 'Oman',
      'EG': 'Egypt', 'LY': 'Libya', 'TN': 'Tunisia', 'DZ': 'Algeria', 'MA': 'Morocco',
      'SD': 'Sudan', 'SS': 'S. Sudan', 'ET': 'Ethiopia', 'SO': 'Somalia', 'KE': 'Kenya',
      'NG': 'Nigeria', 'CD': 'DR Congo', 'ZA': 'S. Africa', 'ML': 'Mali',
      'BF': 'Burkina Faso', 'CM': 'Cameroon', 'MZ': 'Mozambique', 'CF': 'CAR',
      'IN': 'India', 'PK': 'Pakistan', 'AF': 'Afghanistan', 'BD': 'Bangladesh',
      'NP': 'Nepal', 'LK': 'Sri Lanka',
      'CN': 'China', 'JP': 'Japan', 'KR': 'S. Korea', 'KP': 'N. Korea', 'TW': 'Taiwan',
      'MN': 'Mongolia', 'MM': 'Myanmar', 'TH': 'Thailand', 'VN': 'Vietnam',
      'PH': 'Philippines', 'ID': 'Indonesia', 'MY': 'Malaysia', 'KH': 'Cambodia',
      'LA': 'Laos', 'AU': 'Australia',
    }

    // Region fallback for unknown country codes
    const REGION_FALLBACK: Record<string, [number, number]> = {
      'Middle East': [510, 240], 'Western Asia': [510, 240],
      'Eastern Europe': [460, 145], 'Central Europe': [410, 140],
      'Western Europe': [375, 150], 'Southern Europe': [395, 175],
      'North Africa': [400, 230], 'Northeast Africa': [460, 300],
      'East Africa': [470, 355], 'West Africa': [380, 310],
      'Central Africa': [430, 345], 'Southern Africa': [440, 420],
      'Sub-Saharan Africa': [430, 380],
      'South Asia': [595, 255], 'East Asia': [670, 180],
      'Southeast Asia': [665, 310], 'Central Asia': [560, 165],
      'South America': [220, 400], 'North America': [150, 150],
      'Central America': [145, 265], 'Oceania': [720, 415],
      'Global': [400, 280],
    }

    // Count events per country
    const countryCounts: Record<string, { count: number; maxSeverity: number }> = {}
    for (const event of events) {
      const cc = event.country_code
      if (!cc || cc === 'XX' || cc === 'UNKNOWN' || !/^[A-Z]{2}$/.test(cc)) continue
      const existing = countryCounts[cc]
      if (existing) {
        existing.count++
        existing.maxSeverity = Math.max(existing.maxSeverity, event.severity ?? 1)
      } else {
        countryCounts[cc] = { count: 1, maxSeverity: event.severity ?? 1 }
      }
    }

    // Also count by region for events without valid country codes
    const regionCounts: Record<string, { count: number; maxSeverity: number }> = {}
    for (const event of events) {
      const cc = event.country_code
      if (cc && cc !== 'XX' && /^[A-Z]{2}$/.test(cc) && COUNTRY_COORDS[cc]) continue
      const region = event.region || 'Global'
      if (!REGION_FALLBACK[region]) continue
      const existing = regionCounts[region]
      if (existing) {
        existing.count++
        existing.maxSeverity = Math.max(existing.maxSeverity, event.severity ?? 1)
      } else {
        regionCounts[region] = { count: 1, maxSeverity: event.severity ?? 1 }
      }
    }

    // Build final dot list — one per country
    const result: { code: string; name: string; x: number; y: number; count: number; maxSeverity: number }[] = []

    for (const [code, data] of Object.entries(countryCounts)) {
      const coords = COUNTRY_COORDS[code]
      if (!coords) continue
      result.push({
        code,
        name: COUNTRY_NAMES[code] || code,
        x: coords[0],
        y: coords[1],
        count: data.count,
        maxSeverity: data.maxSeverity,
      })
    }

    // Add region dots for unmapped events
    for (const [region, data] of Object.entries(regionCounts)) {
      const coords = REGION_FALLBACK[region]
      if (!coords) continue
      result.push({
        code: region,
        name: region,
        x: coords[0],
        y: coords[1],
        count: data.count,
        maxSeverity: data.maxSeverity,
      })
    }

    // Sort by count descending so top countries render last (on top)
    return result.sort((a, b) => a.count - b.count)
  }, [events])

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
          <path d="M60,80 L130,60 L180,70 L200,110 L190,150 L170,180 L140,200 L100,170 L70,130 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M140,200 L170,210 L160,260 L140,280 L120,250 Z" stroke="white" strokeWidth="0.6" fill="white" fillOpacity="0.03" />
          <path d="M170,280 L220,260 L260,300 L270,380 L250,460 L200,470 L160,420 L150,340 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M340,80 L400,60 L440,80 L460,120 L440,160 L400,170 L360,150 L340,120 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M370,180 L430,170 L470,210 L480,300 L460,380 L420,420 L380,400 L360,320 L350,240 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M470,160 L540,150 L570,200 L550,250 L500,240 L470,210 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M570,200 L630,180 L660,240 L640,300 L590,290 L570,250 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M620,80 L700,60 L740,120 L730,200 L680,220 L640,180 L630,120 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M650,260 L710,240 L740,300 L720,360 L680,350 L660,310 Z" stroke="white" strokeWidth="0.8" fill="white" fillOpacity="0.03" />
          <path d="M680,380 L750,370 L770,420 L740,450 L690,440 Z" stroke="white" strokeWidth="0.6" fill="white" fillOpacity="0.03" />
        </svg>

        {/* Country dots — one per country, sized by event count */}
        <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full">
          {countryAggregates.map((item) => {
            const dotColor = item.maxSeverity >= 4 ? '#ef4444' : item.maxSeverity >= 3 ? '#f97316' : item.maxSeverity >= 2 ? '#eab308' : '#22c55e'
            // Size based on event count: min 3, max 12
            const dotSize = Math.min(12, Math.max(3, 3 + Math.log2(item.count) * 2.5))
            const pulseSpeed = item.maxSeverity >= 4 ? 0.8 : item.maxSeverity >= 3 ? 1.2 : 2

            return (
              <g key={item.code}>
                {/* Pulse ring */}
                <motion.circle
                  cx={item.x} cy={item.y} r={dotSize}
                  fill={dotColor} opacity="0.08"
                  animate={{ r: [dotSize, dotSize * 3, dotSize] }}
                  transition={{ duration: pulseSpeed, repeat: Infinity, ease: 'easeOut' }}
                />
                {/* Glow */}
                <circle cx={item.x} cy={item.y} r={dotSize * 1.5} fill={dotColor} opacity="0.06" />
                {/* Main dot */}
                <circle cx={item.x} cy={item.y} r={dotSize} fill={dotColor} opacity="0.85" />
                {/* Inner bright core */}
                <circle cx={item.x} cy={item.y} r={dotSize * 0.4} fill="white" opacity="0.3" />
                <title>{item.name}: {item.count} events (Max Severity: {item.maxSeverity})</title>
              </g>
            )
          })}
        </svg>

        {/* Country name labels — rendered on top */}
        <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full pointer-events-none">
          {countryAggregates.map((item) => {
            const labelY = item.y - Math.min(12, Math.max(3, 3 + Math.log2(item.count) * 2.5)) - 5
            return (
              <g key={`label-${item.code}`}>
                {/* Dark background for readability */}
                <rect
                  x={item.x - 30} y={labelY - 8}
                  width="60" height="18" rx="3"
                  fill="#070B11" opacity="0.7"
                />
                <text
                  x={item.x} y={labelY}
                  fill="white" opacity="0.8" fontSize="8" fontWeight="700"
                  textAnchor="middle" dominantBaseline="middle"
                >
                  {item.name}
                </text>
                <text
                  x={item.x} y={labelY + 10}
                  fill="white" opacity="0.35" fontSize="6.5"
                  textAnchor="middle"
                >
                  {item.count} event{item.count !== 1 ? 's' : ''}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-3 left-4 flex items-center gap-4 z-10">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
            <span className="text-[9px] text-white/50 font-medium">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#f97316]" />
            <span className="text-[9px] text-white/50 font-medium">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
            <span className="text-[9px] text-white/50 font-medium">Medium</span>
          </div>
          <span className="text-[9px] text-white/20">•</span>
          <span className="text-[9px] text-white/25">{countryAggregates.reduce((s, c) => s + c.count, 0)} events across {countryAggregates.length} locations</span>
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
  const safeRegions = (regions ?? []).filter((r) => r.slug !== 'global').slice(0, 8)
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
                    <span key={dIdx} className="text-[10px] text-white/50">
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

function RecentCriticalEvents({ events = [], onSelect }: { events: OverviewEvent[]; onSelect: (event: OverviewEvent) => void }) {
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

function ActivityTimeline({ events = [] }: { events: OverviewEvent[] }) {
  const activities = useMemo<ActivityItem[]>(() => {
    return (events ?? []).slice(0, 10).map((event) => ({
      id: event.id,
      type: 'event' as const,
      title: decodeHtmlEntities((event.title ?? 'Untitled').substring(0, 60)),
      timeAgo: formatRelativeOccurredTime(event.occurred_at),
      href: `/feed?severity=${event.severity ?? 2}`,
    }))
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
// GLOBAL VOLATILITY INDEX (CR-VIX)
// ============================================================================

interface VolatilityData {
  global_index: number
  average_7d: number
  average_30d: number
  trend: 'rising' | 'falling' | 'stable'
  top_countries: Array<{
    country: string
    code: string
    index: number
    sparkline: number[]
  }>
}

function GlobalVolatilityIndex() {
  const [data, setData] = useState<VolatilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch('/api/v1/volatility-index?global=true')
      .then(r => r.json())
      .then((res: VolatilityData) => {
        setData(res)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const trendArrow = {
    rising: '↑',
    falling: '↓',
    stable: '→',
  }[data?.trend ?? 'stable']

  const trendColor = {
    rising: '#ef4444',
    falling: '#22c55e',
    stable: '#eab308',
  }[data?.trend ?? 'stable']

  const maxVIX = Math.max(...(data?.top_countries.map(c => c.index) ?? [100]), 100)

  return (
    <motion.section
      className="overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <div className="border-b border-white/[0.04] px-6 py-4">
        <h2 className="text-sm font-semibold text-white/80">Global CR-VIX Index</h2>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-12 w-24 rounded-lg bg-white/[0.04] animate-pulse" />
            <div className="flex gap-6">
              <div className="h-8 w-16 rounded bg-white/[0.04] animate-pulse" />
              <div className="h-8 w-16 rounded bg-white/[0.04] animate-pulse" />
            </div>
            <div className="space-y-3 mt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-6 rounded bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        ) : error || !data ? (
          <div className="text-center text-white/40">Unable to load</div>
        ) : (
          <>
            {/* Main VIX Display */}
            <div className="mb-8">
              <div className="flex items-baseline gap-4 mb-4">
                <div className="text-5xl font-bold text-white tracking-tight">
                  {Math.round(data.global_index)}
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ color: trendColor }} className="text-2xl font-semibold">
                    {trendArrow}
                  </span>
                  <span className="text-xs text-white/50 uppercase tracking-widest">
                    {data.trend}
                  </span>
                </div>
              </div>

              {/* Moving Averages */}
              <div className="flex gap-6 text-xs">
                <div>
                  <div className="text-white/40 mb-1">7d Avg</div>
                  <div className="text-sm font-semibold text-white/70">
                    {Math.round(data.average_7d)}
                  </div>
                </div>
                <div>
                  <div className="text-white/40 mb-1">30d Avg</div>
                  <div className="text-sm font-semibold text-white/70">
                    {Math.round(data.average_30d)}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Volatile Countries */}
            <div className="space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50 mb-4">
                Top Volatile Regions
              </div>

              {data.top_countries.map((country, idx) => {
                const ratio = country.index / maxVIX
                const countryColor = ratio > 0.66 ? '#ef4444' : ratio > 0.33 ? '#f97316' : '#eab308'

                return (
                  <motion.div
                    key={country.code}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    {/* Country flag emoji - would need mapping or fallback */}
                    <span className="text-lg w-6">🌍</span>

                    {/* Country name */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white/70">{country.country}</div>
                      <div className="h-1 rounded-full overflow-hidden bg-white/[0.05] mt-1">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: countryColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${ratio * 100}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.05 }}
                        />
                      </div>
                    </div>

                    {/* VIX Score */}
                    <div className="text-xs font-semibold text-white/60 w-8 text-right">
                      {Math.round(country.index)}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </motion.section>
  )
}

// ============================================================================
// EARLY WARNING SPOTLIGHT
// ============================================================================

interface EarlyWarning {
  country_code: string
  country_name: string
  warning_level: 1 | 2 | 3 | 4 | 5
  trajectory: 'escalating' | 'stable' | 'de_escalating'
  updated_at: string
}

function EarlyWarningSpotlight() {
  const [warnings, setWarnings] = useState<EarlyWarning[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch('/api/v1/early-warning')
      .then(r => r.json())
      .then((res: { data: EarlyWarning[] }) => {
        setWarnings((res.data ?? []).sort((a, b) => b.warning_level - a.warning_level).slice(0, 5))
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  const criticalLevel = warnings.some(w => w.warning_level >= 4)

  const levelColor = (level: number) => {
    switch (level) {
      case 5:
        return '#ef4444'
      case 4:
        return '#ef4444'
      case 3:
        return '#f97316'
      case 2:
        return '#eab308'
      case 1:
      default:
        return '#22c55e'
    }
  }

  const levelLabel = (level: number) => {
    const labels = ['', 'Low', 'Medium', 'High', 'Critical', 'Extreme']
    return labels[level] || 'Unknown'
  }

  const trajectoryArrow = (traj: string) => {
    switch (traj) {
      case 'escalating':
        return '↑'
      case 'de_escalating':
        return '↓'
      case 'stable':
      default:
        return '→'
    }
  }

  return (
    <motion.section
      className={`overflow-hidden rounded-xl border transition-all duration-500 ${
        criticalLevel
          ? 'border-red-500/30 bg-gradient-to-br from-red-500/[0.08] to-red-500/[0.02] shadow-lg shadow-red-500/20'
          : 'border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
    >
      {/* Pulsing glow border for critical alerts */}
      {criticalLevel && (
        <motion.div
          className="absolute inset-0 rounded-xl border border-red-500/50 pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="border-b border-white/[0.04] px-6 py-4 relative z-10">
        <h2 className="text-sm font-semibold text-white/80">Early Warning Spotlight</h2>
      </div>

      <div className="px-6 py-6 relative z-10">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                <div className="w-8 h-8 rounded-full bg-white/[0.04] animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-white/[0.04] animate-pulse" />
                  <div className="h-3 w-16 rounded bg-white/[0.04] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-white/40">Unable to load</div>
        ) : warnings.length === 0 ? (
          <div className="text-center text-white/40">No warnings</div>
        ) : (
          <div className="space-y-3">
            {warnings.map((warning, idx) => {
              const color = levelColor(warning.warning_level)

              return (
                <motion.div
                  key={warning.country_code}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <Link
                    href={`/analysis/countries/${warning.country_code.toLowerCase()}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    {/* Warning Level Badge */}
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                      style={{ background: `${color}20`, color }}
                    >
                      {warning.warning_level}
                    </div>

                    {/* Country Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">
                        {warning.country_name}
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5">
                        {levelLabel(warning.warning_level)} Level
                      </div>
                    </div>

                    {/* Trajectory Arrow */}
                    <div style={{ color }} className="text-lg font-semibold flex-shrink-0">
                      {trajectoryArrow(warning.trajectory)}
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
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
      const json = await res.json()
      // Validate that the response has the expected shape before using it
      if (!json || !json.kpis || !Array.isArray(json.topStories) || !Array.isArray(json.hotRegions)) {
        throw new Error('Invalid response shape')
      }
      const validated: OverviewData = {
        ...json,
        topStories: json.topStories ?? [],
        hotRegions: json.hotRegions ?? [],
        notices: json.notices ?? [],
      }
      cache.current[window] = validated
      setData(validated)
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
              <KpiCommandStrip kpis={data.kpis} window={win} onWindowChange={setWin} severityCounts={data.severityCounts} />
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

            {/* ROW 4: VOLATILITY INDEX + EARLY WARNING */}
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_1fr]">
              <GlobalVolatilityIndex />
              <EarlyWarningSpotlight />
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
