'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Radar, AlertTriangle, TrendingUp, Globe } from 'lucide-react'

// Type definitions
interface CriticalEvent {
  id: string
  title: string
  severity: number
  country_code?: string
  country_name?: string
  event_type?: string
  occurred_at?: string
  ingested_at?: string
}

interface ConvergenceHotspot {
  country: string
  country_code?: string
  convergence_score: number
  active_domains: number
  escalation_probability: number
}

interface HumanitarianData {
  total_casualties_7d: number
  countries_affected: number
  most_affected_country: string
  trend: 'up' | 'down' | 'stable'
  daily_casualty_trend: number[]
}

interface ThreatMatrixCountry {
  country_code: string
  country_name: string
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  composite_score?: number
}

interface CompositeScoreData {
  country_code: string
  country_name: string
  composite_score: number
  signal_components?: Record<string, number>
  timestamp?: string
}

// Icon type casting
const IconRadio = Radio as React.ComponentType<{ className?: string; size?: number }>
const IconRadar = Radar as React.ComponentType<{ className?: string; size?: number }>
const IconAlert = AlertTriangle as React.ComponentType<{ className?: string; size?: number }>
const IconTrend = TrendingUp as React.ComponentType<{ className?: string; size?: number }>
const IconGlobe = Globe as React.ComponentType<{ className?: string; size?: number }>

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }

function timeAgo(timestamp?: string): string {
  if (!timestamp) return 'just now'
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const mins = Math.max(0, Math.floor(diffMs / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function getSeverityColor(severity?: number): string {
  if (!severity) return '#666666'
  if (severity >= 4) return '#ef4444'
  if (severity === 3) return '#f97316'
  if (severity === 2) return '#eab308'
  return '#22c55e'
}

function getSeverityLabel(severity?: number): string {
  if (!severity) return 'LOW'
  if (severity >= 4) return 'CRITICAL'
  if (severity === 3) return 'HIGH'
  if (severity === 2) return 'MEDIUM'
  return 'LOW'
}

function getRiskColor(level: string): string {
  if (level === 'critical') return '#ef4444'
  if (level === 'high') return '#f97316'
  if (level === 'medium') return '#eab308'
  return '#22c55e'
}

function getColorFromScore(score: number): string {
  if (score >= 80) return '#ef4444' // red - critical
  if (score >= 60) return '#f97316' // orange - high
  if (score >= 30) return '#eab308' // yellow - medium
  return '#22c55e' // green - low
}

// Status Bar Component
function StatusBar({
  utcTime,
  eventsToday,
  activeCrises,
}: {
  utcTime: string
  eventsToday: number
  activeCrises: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SNAPPY, delay: 0.1 }}
      className="w-full border-b border-white/10 bg-gradient-to-r from-[#070B11] via-[#0a0e17] to-[#070B11] backdrop-blur px-6 py-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xl font-bold tracking-widest text-red-400">SITUATION ROOM</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-white/60">
          <div className="flex items-center gap-2">
            <span className="text-white/40">UTC</span>
            <span className="text-cyan-400 font-semibold">{utcTime}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-white/40">EVENTS</span>
            <span className="text-cyan-400 font-semibold">{eventsToday}</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-white/40">ACTIVE</span>
            <span className="text-orange-400 font-semibold">{activeCrises}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Live Event Stream Component
function LiveEventStream({ events }: { events: CriticalEvent[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_SNAPPY, delay: 0.2 }}
      className="flex flex-col h-full rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 bg-white/[0.03]">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <div className="flex items-center gap-2">
          <IconRadio className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-red-400 tracking-widest">LIVE STREAM</span>
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {events.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex items-center justify-center text-white/30 text-sm"
            >
              No events
            </motion.div>
          ) : (
            events.map((event, idx) => {
              const severity = event.severity ?? 1
              const color = getSeverityColor(severity)
              const label = getSeverityLabel(severity)
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ ...SPRING_SNAPPY, delay: idx * 0.05 }}
                  className="border-l-2 border-white/10 bg-white/[0.04] rounded p-3 hover:bg-white/[0.08] transition-colors cursor-pointer"
                  style={{ borderLeftColor: color }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded uppercase whitespace-nowrap flex-shrink-0"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {label}
                      </span>
                      <span className="text-xs text-white/50 font-mono">{event.country_code || 'XX'}</span>
                    </div>
                    <span className="text-[10px] text-white/40 font-mono flex-shrink-0">{timeAgo(event.occurred_at)}</span>
                  </div>
                  <p className="text-sm text-white/80 line-clamp-2">{event.title}</p>
                  {event.event_type && (
                    <p className="text-xs text-white/40 mt-2 font-mono">{event.event_type}</p>
                  )}
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// Convergence Hotspots Component
function ConvergenceHotspots({ hotspots }: { hotspots: ConvergenceHotspot[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING_SNAPPY, delay: 0.25 }}
      className="flex flex-col h-full rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 bg-white/[0.03]">
        <IconRadar className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-cyan-400 tracking-widest">CROSS-SIGNAL CONVERGENCE</span>
      </div>

      {/* Hotspots List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {hotspots.slice(0, 8).map((hotspot, idx) => (
            <motion.div
              key={`${hotspot.country_code || hotspot.country}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.3 + idx * 0.05 }}
              className="bg-white/[0.04] rounded-lg p-3 border border-white/10"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">{hotspot.country}</span>
                <span className="text-xs font-mono text-cyan-400">
                  {(hotspot.convergence_score * 100).toFixed(0)}%
                </span>
              </div>

              {/* Score Bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${hotspot.convergence_score * 100}%` }}
                  transition={{ ...SPRING_SNAPPY, delay: 0.4 + idx * 0.05 }}
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                />
              </div>

              {/* Details */}
              <div className="flex items-center justify-between text-[10px] text-white/50 font-mono">
                <span>{hotspot.active_domains} domains</span>
                <span>escalation: {(hotspot.escalation_probability * 100).toFixed(0)}%</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// Humanitarian Pulse Component
function HumanitarianPulse({ data }: { data: HumanitarianData | null }) {
  const trendIcon =
    data?.trend === 'up' ? '↑' : data?.trend === 'down' ? '↓' : '→'
  const trendColor =
    data?.trend === 'up' ? 'text-red-400' : data?.trend === 'down' ? 'text-green-400' : 'text-yellow-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SNAPPY, delay: 0.3 }}
      className="flex flex-col h-full rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 bg-white/[0.03]">
        <IconAlert className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-red-400 tracking-widest">HUMANITARIAN PULSE</span>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 flex flex-col justify-center">
        {data ? (
          <>
            {/* Casualties Counter */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.4 }}
              className="mb-6"
            >
              <div className="text-xs text-white/50 font-mono mb-2">TOTAL CASUALTIES (7D)</div>
              <div className="text-4xl font-bold text-red-400 font-mono">
                {data.total_casualties_7d.toLocaleString()}
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_SNAPPY, delay: 0.45 }}
                className="bg-white/[0.04] rounded p-3"
              >
                <div className="text-xs text-white/40 font-mono mb-1">COUNTRIES AFFECTED</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {data.countries_affected}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING_SNAPPY, delay: 0.5 }}
                className="bg-white/[0.04] rounded p-3"
              >
                <div className="text-xs text-white/40 font-mono mb-1">TREND</div>
                <div className={`text-2xl font-bold ${trendColor}`}>
                  {trendIcon}
                </div>
              </motion.div>
            </div>

            {/* Most Affected */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.55 }}
              className="bg-white/[0.04] rounded p-3 border border-orange-500/20"
            >
              <div className="text-xs text-white/40 font-mono mb-2">MOST AFFECTED</div>
              <div className="text-lg font-bold text-orange-400">
                {data.most_affected_country}
              </div>
            </motion.div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-white/30">
            Loading data...
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Threat Matrix Component
function ThreatMatrix({ countries }: { countries: ThreatMatrixCountry[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SNAPPY, delay: 0.35 }}
      className="flex flex-col h-full rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4 bg-white/[0.03]">
        <IconGlobe className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-semibold text-orange-400 tracking-widest">GLOBAL THREAT MATRIX</span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <AnimatePresence>
            {countries.slice(0, 16).map((country, idx) => {
              const score = country.composite_score ?? 0
              const color = getColorFromScore(score)
              const isPulsing = score >= 80
              return (
                <motion.div
                  key={country.country_code}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ ...SPRING_SNAPPY, delay: 0.4 + idx * 0.03 }}
                  className={`aspect-square rounded-lg border flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group transition-all ${
                    isPulsing ? 'animate-pulse' : ''
                  }`}
                  style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}40`,
                  }}
                  title={`${country.country_name}: ${score.toFixed(0)}`}
                >
                  {isPulsing && (
                    <div
                      className="absolute inset-0 rounded-lg animate-pulse"
                      style={{
                        boxShadow: `inset 0 0 20px ${color}40`,
                      }}
                    />
                  )}
                  <div className="relative z-10 text-center">
                    <div className="text-lg font-bold" style={{ color }}>
                      {country.country_code}
                    </div>
                    <div className="text-xs font-mono mt-1" style={{ color }}>
                      {score.toFixed(0)}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
          className="rounded-lg bg-white/[0.03] border border-white/10 p-3 text-[10px]"
        >
          <div className="font-semibold text-white/70 mb-2">Score Legend</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-white/50">80-100: Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }} />
              <span className="text-white/50">60-80: High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }} />
              <span className="text-white/50">30-60: Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }} />
              <span className="text-white/50">0-30: Low</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Main Component
export function SituationRoomClient() {
  const [utcTime, setUtcTime] = useState<string>('00:00:00')
  const [events, setEvents] = useState<CriticalEvent[]>([])
  const [hotspots, setHotspots] = useState<ConvergenceHotspot[]>([])
  const [humanitarian, setHumanitarian] = useState<HumanitarianData | null>(null)
  const [threatMatrix, setThreatMatrix] = useState<ThreatMatrixCountry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInterval = useRef<NodeJS.Timeout>()

  // Update UTC time every second
  useEffect(() => {
    const updateTime = () => {
      setUtcTime(new Date().toISOString().slice(11, 19))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, hotspotRes, humanRes, threatRes, compositeRes] = await Promise.all([
        fetch('/api/v1/events?severity=critical,high&limit=20'),
        fetch('/api/v1/intelligence/cross-signals'),
        fetch('/api/v1/humanitarian/overview?days=7'),
        fetch('/api/v1/countries?limit=20&sort=risk'),
        fetch('/api/v1/intelligence/composite-score?all=true'),
      ])

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json()
        setEvents(eventsData.data?.slice(0, 20) || [])
      }

      if (hotspotRes.ok) {
        const hotspotData = await hotspotRes.json()
        const hotspotContent = hotspotData.data || hotspotData
        setHotspots(hotspotContent.convergence_hotspots || hotspotContent.hotspots || hotspotContent.data || [])
      }

      if (humanRes.ok) {
        const humanData = await humanRes.json()
        setHumanitarian(humanData.data || null)
      }

      // Get composite scores and merge with threat matrix
      let compositeScoreMap = new Map<string, number>()
      if (compositeRes.ok) {
        const compositeData = await compositeRes.json()
        const compositeContent = compositeData.data || compositeData
        const scores = Array.isArray(compositeContent.composite_scores)
          ? compositeContent.composite_scores
          : compositeContent.data || []
        scores.forEach((item: CompositeScoreData) => {
          compositeScoreMap.set(item.country_code, item.composite_score)
        })
      }

      if (threatRes.ok) {
        const threatData = await threatRes.json()
        const countries = (threatData.data || []) as ThreatMatrixCountry[]
        // Merge composite scores into threat matrix countries
        const enrichedCountries = countries.map(country => ({
          ...country,
          composite_score: compositeScoreMap.get(country.country_code) ?? 0,
        }))
        setThreatMatrix(enrichedCountries)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error fetching situation room data:', error)
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchInterval.current = setInterval(fetchData, 30_000)
    return () => {
      if (fetchInterval.current) clearInterval(fetchInterval.current)
    }
  }, [fetchData])

  const eventsToday = events.length
  const activeCrises = events.filter((e) => (e.severity ?? 1) >= 3).length

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">Loading situation room...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#070B11]">
      {/* Status Bar */}
      <StatusBar utcTime={utcTime} eventsToday={eventsToday} activeCrises={activeCrises} />

      {/* 2x2 Grid Layout */}
      <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Top-Left: Live Event Stream */}
        <LiveEventStream events={events} />

        {/* Top-Right: Convergence Hotspots */}
        <ConvergenceHotspots hotspots={hotspots} />

        {/* Bottom-Left: Humanitarian Pulse */}
        <HumanitarianPulse data={humanitarian} />

        {/* Bottom-Right: Threat Matrix */}
        <ThreatMatrix countries={threatMatrix} />
      </div>
    </div>
  )
}
