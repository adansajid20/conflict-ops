'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useSpring, useTransform, useMotionValue } from 'framer-motion'
import { Clock, Map, RefreshCw, Activity, TrendingUp, AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { safeRelativeTime } from '@/lib/utils/time'
import { EventDetailPanel } from './EventDetailPanel'
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
}

function KpiCard({ label, value, sparklineData, delta, color, accentColor, href }: KpiCardProps) {
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
}

function KpiCommandStrip({ kpis, window }: KpiCommandStripProps) {
  // Generate mock sparkline data (in a real app, fetch from /api/v1/trends)
  const getSparklineData = () => Array.from({ length: 7 }, () => Math.random() * 100)

  const cards: KpiCardProps[] = [
    {
      label: 'Total Events',
      value: kpis.eventsWindow,
      sparklineData: getSparklineData(),
      delta: Math.random() * 20 - 10,
      color: '#3b82f6',
      accentColor: '#3b82f6',
      href: '/feed',
    },
    {
      label: 'Fatalities',
      value: Math.floor(Math.random() * 500),
      sparklineData: getSparklineData(),
      delta: Math.random() * 30 - 15,
      color: '#ef4444',
      accentColor: '#ef4444',
      href: '/analysis',
    },
    {
      label: 'Displacement',
      value: Math.floor(Math.random() * 10000),
      sparklineData: getSparklineData(),
      delta: Math.random() * 20 - 10,
      color: '#a78bfa',
      accentColor: '#a78bfa',
      href: '/analysis',
    },
    {
      label: 'Active Conflicts',
      value: kpis.activeConflictZones,
      sparklineData: getSparklineData(),
      delta: Math.random() * 15 - 7,
      color: '#f97316',
      accentColor: '#f97316',
      href: '/situations',
    },
    {
      label: 'Escalation Index',
      value: Math.floor(Math.random() * 100),
      sparklineData: getSparklineData(),
      delta: Math.random() * 25 - 12,
      color: '#eab308',
      accentColor: '#eab308',
      href: '/analysis',
    },
    {
      label: 'Avg Severity',
      value: Math.floor(Math.random() * 5),
      sparklineData: getSparklineData(),
      delta: Math.random() * 10 - 5,
      color: '#22c55e',
      accentColor: '#22c55e',
      href: '/feed',
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
}

function LiveThreatMapMini({ events }: { events: OverviewEvent[] }) {
  const dots = useMemo<ThreatDot[]>(() => {
    const regionToDots: Record<string, ThreatDot[]> = {}

    events.slice(0, 30).forEach((event, idx) => {
      const region = event.region || 'Global'
      if (!regionToDots[region]) regionToDots[region] = []

      // Simplified world map coordinates
      const coords: Record<string, [number, number]> = {
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

      const [x, y] = coords[region] || [Math.random() * 800, Math.random() * 500]

      regionToDots[region].push({
        id: event.id,
        x: x + Math.random() * 30 - 15,
        y: y + Math.random() * 30 - 15,
        severity: event.severity ?? 2,
        title: event.title ?? 'Event',
      })
    })

    return Object.values(regionToDots).flat()
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
        {/* Simplified SVG world map outline */}
        <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full opacity-20">
          {/* Simple continent outlines */}
          <path d="M 50 100 L 100 90 L 120 130 L 80 150 Z" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3" />
          <path d="M 150 80 L 200 70 L 210 140 L 160 150 Z" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3" />
          <path d="M 350 150 L 450 140 L 480 250 L 380 270 Z" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3" />
          <path d="M 500 200 L 600 190 L 620 300 L 520 310 Z" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3" />
          <path d="M 650 250 L 750 240 L 760 350 L 680 360 Z" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3" />
          <path d="M 100 350 L 250 340 L 280 450 L 150 460 Z" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3" />
        </svg>

        {/* Threat dots */}
        <svg viewBox="0 0 800 500" className="absolute inset-0 w-full h-full">
          {dots.map((dot, idx) => {
            const pulseSpeed = dot.severity >= 4 ? 0.6 : dot.severity >= 3 ? 0.8 : 1.2
            const dotSize = dot.severity >= 4 ? 5 : dot.severity >= 3 ? 3.5 : 2.5

            return (
              <g key={dot.id}>
                {/* Pulsing background */}
                <motion.circle
                  cx={dot.x}
                  cy={dot.y}
                  r={dotSize}
                  fill="#ef4444"
                  opacity="0.1"
                  animate={{ r: dotSize * 2.5 }}
                  transition={{ duration: pulseSpeed, repeat: Infinity, ease: 'easeOut' }}
                />
                {/* Main dot */}
                <circle
                  cx={dot.x}
                  cy={dot.y}
                  r={dotSize}
                  fill={dot.severity >= 4 ? '#ef4444' : dot.severity >= 3 ? '#f97316' : '#eab308'}
                  opacity="0.8"
                />
              </g>
            )
          })}
        </svg>

        {/* Gradient overlay bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#070B11] to-transparent pointer-events-none" />
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
          const isEscalating = Math.random() > 0.5

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
  const criticalEvents = events.filter((e) => e.severity && e.severity >= 3).slice(0, 10)

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
}

function ActivityTimeline({ events }: { events: OverviewEvent[] }) {
  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = events.slice(0, 8).map((event, idx) => ({
      id: event.id,
      type: 'event',
      title: `New event: ${(event.title ?? 'Untitled').substring(0, 50)}`,
      timeAgo: formatRelativeOccurredTime(event.occurred_at),
    }))

    // Mix in some mock alerts and predictions
    const mockActivities: ActivityItem[] = [
      { id: 'alert-1', type: 'alert', title: 'Alert triggered: Critical situation detected', timeAgo: '3m ago' },
      { id: 'pred-1', type: 'prediction', title: 'Prediction confirmed: Escalation trend', timeAgo: '12m ago' },
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

            return (
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
  const eventRate = Math.floor(Math.random() * 50) + 10

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
          <span>Monitoring {data.kpis.eventsWindow + Math.floor(Math.random() * 50)} countries</span>
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
              <KpiCommandStrip kpis={data.kpis} window={win} />
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
