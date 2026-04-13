'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react'
import { getCountryName, getCountryFlag } from '@/lib/countries'

interface GlobalSummaryData {
  global_threat_level: number
  severity_breakdown: {
    critical: number
    high: number
    medium: number
    low: number
  }
  top_countries: Array<{ country_code: string; event_count: number }>
  trending_regions: Array<{
    country_code: string
    event_count: number
    previous_count: number
    trend: number
  }>
  event_count: number
  period: { start: string; end: string }
}

interface GlobalThreatOverviewProps {
  refreshInterval?: number
}

const SPRING_CONFIG = { type: 'spring' as const, stiffness: 400, damping: 30 }

function getThreatColor(threatLevel: number): string {
  if (threatLevel >= 80) return '#ef4444' // Critical - red
  if (threatLevel >= 60) return '#f97316' // High - orange
  if (threatLevel >= 40) return '#eab308' // Medium - yellow
  return '#22c55e' // Low - green
}

function ThreatGauge({ value }: { value: number }) {
  const color = getThreatColor(value)
  const circumference = 2 * Math.PI * 45

  return (
    <Link href="/methodology" title="View threat methodology">
      <div className="relative w-32 h-32 cursor-pointer hover:opacity-80 transition-opacity">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="white"
          strokeWidth="2"
          opacity="0.1"
        />

        {/* Threat indicator circle */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference * (1 - value / 100),
          }}
          transition={SPRING_CONFIG}
          strokeLinecap="round"
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_CONFIG}
          className="text-center"
        >
          <div className="text-3xl font-bold tabular-nums" style={{ color }}>
            {Math.round(value)}
          </div>
          <div className="text-[10px] font-semibold text-white/60 uppercase">Threat</div>
        </motion.div>
      </div>
      </div>
    </Link>
  )
}

function SeverityCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: string
  icon: string
}) {
  const severityMap: Record<string, string> = {
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  }
  const severityParam = severityMap[label] || label.toLowerCase()

  return (
    <Link href={`/feed?severity=${severityParam}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_CONFIG}
        className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-lg p-4 hover:bg-white/[0.07] transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{icon}</span>
          <span className="text-xs font-semibold text-white/60 uppercase">{label}</span>
        </div>
        <div className="flex items-end gap-2">
          <div className="text-2xl font-bold tabular-nums" style={{ color }}>
            {value}
          </div>
          <div
            className="w-1 h-6 rounded-full"
            style={{ backgroundColor: color, opacity: 0.6 }}
          />
        </div>
      </motion.div>
    </Link>
  )
}

function CountryRow({
  countryCode,
  eventCount,
  index,
}: {
  countryCode: string
  eventCount: number
  index: number
}) {
  const flag = getCountryFlag(countryCode)
  const name = getCountryName(countryCode)

  return (
    <Link href={`/analysis/countries/${countryCode.toLowerCase()}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...SPRING_CONFIG, delay: index * 0.05 }}
        className="flex items-center justify-between py-2.5 px-3 rounded hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-lg">{flag}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-xs text-white/40">{eventCount} events</div>
          </div>
        </div>
        <div className="ml-auto pl-2">
          <div className="text-sm font-bold tabular-nums text-cyan-400">{eventCount}</div>
        </div>
      </motion.div>
    </Link>
  )
}

function TrendingRow({
  countryCode,
  trend,
  index,
}: {
  countryCode: string
  trend: number
  index: number
}) {
  const flag = getCountryFlag(countryCode)
  const name = getCountryName(countryCode)
  const trendColor = trend > 0 ? '#ef4444' : '#22c55e'
  const trendIcon = trend > 0 ? '📈' : '📉'

  return (
    <Link href={`/analysis/countries/${countryCode.toLowerCase()}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...SPRING_CONFIG, delay: index * 0.05 }}
        className="flex items-center justify-between py-2.5 px-3 rounded hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-lg">{flag}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-xs text-white/40">
              {Math.abs(trend)} more event{Math.abs(trend) === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="ml-auto pl-2 flex items-center gap-1.5">
          <span className="text-lg">{trendIcon}</span>
          <div className="text-sm font-bold tabular-nums" style={{ color: trendColor }}>
            {trend > 0 ? '+' : ''}{trend}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export function GlobalThreatOverview({ refreshInterval = 60000 }: GlobalThreatOverviewProps) {
  const [data, setData] = useState<GlobalSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch('/api/v1/intelligence/global-summary')
      if (!response.ok) throw new Error('Failed to fetch global summary')

      const json = await response.json()
      if (json.success && json.data) {
        // Ensure arrays exist to prevent .map() crashes
        setData({
          ...json.data,
          top_countries: json.data.top_countries ?? [],
          trending_regions: json.data.trending_regions ?? [],
          severity_breakdown: json.data.severity_breakdown ?? { critical: 0, high: 0, medium: 0, low: 0 },
        })
      } else {
        throw new Error(json.error || 'Unknown error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('[GlobalThreatOverview] Error:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh
  useEffect(() => {
    const timer = setInterval(fetchData, refreshInterval)
    return () => clearInterval(timer)
  }, [fetchData, refreshInterval])

  const handleRefresh = () => {
    setIsRefreshing(true)
    fetchData()
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-[#070B11] to-[#0f1419] rounded-2xl border border-white/10 p-8 space-y-6"
      >
        <div className="h-32 bg-white/5 rounded-xl animate-pulse" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </motion.div>
    )
  }

  if (error || !data) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-gradient-to-br from-[#070B11] to-[#0f1419] rounded-2xl border border-white/10 p-8"
      >
        <div className="flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <span>Failed to load global threat summary</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_CONFIG}
      className="bg-gradient-to-br from-[#070B11] to-[#0f1419] rounded-2xl border border-white/10 backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🌍</span>
            Global Threat Overview
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Last 7 days • {data.event_count} events
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={{
              duration: isRefreshing ? 1 : 0.3,
              repeat: isRefreshing ? Infinity : 0,
              ease: 'linear',
            }}
          >
            <RefreshCw size={18} className="text-cyan-400" />
          </motion.div>
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-8">
        {/* Threat Gauge and Severity Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="flex justify-center lg:justify-start">
            <ThreatGauge value={data.global_threat_level} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 lg:col-span-4">
            <SeverityCard
              label="Critical"
              value={data.severity_breakdown.critical}
              color="#ef4444"
              icon="🔴"
            />
            <SeverityCard
              label="High"
              value={data.severity_breakdown.high}
              color="#f97316"
              icon="🟠"
            />
            <SeverityCard
              label="Medium"
              value={data.severity_breakdown.medium}
              color="#eab308"
              icon="🟡"
            />
            <SeverityCard
              label="Low"
              value={data.severity_breakdown.low}
              color="#22c55e"
              icon="🟢"
            />
          </div>
        </div>

        {/* Top Countries and Trending Regions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Active Countries */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🔥</span>
              <h3 className="font-semibold text-white">Top Active Countries</h3>
            </div>
            <div className="space-y-0">
              <AnimatePresence>
                {data.top_countries.length > 0 ? (
                  data.top_countries.map((country, idx) => (
                    <CountryRow
                      key={country.country_code}
                      countryCode={country.country_code}
                      eventCount={country.event_count}
                      index={idx}
                    />
                  ))
                ) : (
                  <div className="text-sm text-white/40 py-4 text-center">No data</div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Trending Regions */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📈</span>
              <h3 className="font-semibold text-white">Trending Regions</h3>
            </div>
            <div className="space-y-0">
              <AnimatePresence>
                {data.trending_regions.length > 0 ? (
                  data.trending_regions.map((region, idx) => (
                    <TrendingRow
                      key={region.country_code}
                      countryCode={region.country_code}
                      trend={region.trend}
                      index={idx}
                    />
                  ))
                ) : (
                  <div className="text-sm text-white/40 py-4 text-center">
                    No trending regions
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
