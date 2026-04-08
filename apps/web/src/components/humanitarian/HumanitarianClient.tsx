'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, TrendingUp, TrendingDown, AlertCircle, Users, Globe, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }

type HumanitarianOverviewResponse = {
  period: { start: string; end: string }
  methodology: {
    version: string
    description: string
    limitations: string[]
    sources: string[]
    confidence_note: string
  }
  summary: {
    total_humanitarian_events: number
    estimated_casualties: number
    countries_affected: number
    regions_affected: number
    most_affected_country: { code: string; name: string; casualties: number } | null
    trend_vs_prior_period: 'increasing' | 'decreasing' | 'stable'
  }
  by_country: Array<{
    country_code: string
    country_name: string
    humanitarian_events: number
    estimated_casualties: number
    event_types: string[]
    severity_distribution: Record<number, number>
    trend: 'increasing' | 'decreasing' | 'stable'
  }>
  by_type: Array<{
    event_type: string
    count: number
    total_casualties: number
    affected_countries: string[]
  }>
  timeline: Array<{
    date: string
    events: number
    casualties: number
  }>
  data_quality: {
    events_with_casualty_data: number
    events_without_casualty_data: number
    coverage_percentage: number
    last_updated: string
  }
}

function TrendBadge({ trend }: { trend: 'increasing' | 'decreasing' | 'stable' }) {
  const config = {
    increasing: { color: '#ef4444', icon: ArrowUpRight, label: 'Increasing' },
    decreasing: { color: '#22c55e', icon: ArrowDownRight, label: 'Decreasing' },
    stable: { color: '#eab308', icon: Activity, label: 'Stable' },
  }
  const { color, icon: Icon, label } = config[trend]
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium" style={{ background: `${color}20`, color }}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  )
}

function SummaryCard({ label, value, trend, icon: Icon }: { label: string; value: string | number; trend?: 'increasing' | 'decreasing' | 'stable'; icon: React.ElementType }) {
  return (
    <motion.div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.08em] text-white/40">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
        <Icon className="h-5 w-5 text-white/20 flex-shrink-0" />
      </div>
      {trend && <div className="mt-3 pt-3 border-t border-white/[0.05]"><TrendBadge trend={trend} /></div>}
    </motion.div>
  )
}

function CountryTable({ countries }: { countries: HumanitarianOverviewResponse['by_country'] }) {
  const [sortBy, setSortBy] = useState<'casualties' | 'events'>('casualties')
  const [searchTerm, setSearchTerm] = useState('')

  const sorted = useMemo(() => {
    let result = [...countries]
    if (sortBy === 'casualties') {
      result.sort((a, b) => b.estimated_casualties - a.estimated_casualties)
    } else {
      result.sort((a, b) => b.humanitarian_events - a.humanitarian_events)
    }
    if (searchTerm) {
      result = result.filter((c) => c.country_name.toLowerCase().includes(searchTerm.toLowerCase()))
    }
    return result
  }, [countries, sortBy, searchTerm])

  return (
    <motion.div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY, delay: 0.1 }}
    >
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white mb-3">By Country</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search countries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-lg bg-white/[0.05] border border-white/[0.05] px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400/50"
          />
          <div className="flex gap-1">
            <button
              onClick={() => setSortBy('casualties')}
              className={`text-xs px-2 py-1.5 rounded-lg transition-all ${sortBy === 'casualties' ? 'bg-blue-500/20 text-blue-400 border border-blue-400/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Casualties
            </button>
            <button
              onClick={() => setSortBy('events')}
              className={`text-xs px-2 py-1.5 rounded-lg transition-all ${sortBy === 'events' ? 'bg-blue-500/20 text-blue-400 border border-blue-400/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Events
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-[0.08em]">Country</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-white/50 uppercase tracking-[0.08em]">Casualties</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-white/50 uppercase tracking-[0.08em]">Events</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-white/50 uppercase tracking-[0.08em]">Severity</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-white/50 uppercase tracking-[0.08em]">Trend</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {sorted.map((country, idx) => {
                const maxSeverity = Object.keys(country.severity_distribution).reduce((max, sev) => {
                  const s = parseInt(sev)
                  return s > max ? s : max
                }, 0)
                return (
                  <motion.tr
                    key={country.country_code}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-white font-medium">{country.country_name}</td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">{country.estimated_casualties.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white/70">{country.humanitarian_events}</td>
                    <td className="px-4 py-3 text-right text-white/70">{maxSeverity}/5</td>
                    <td className="px-4 py-3 text-right"><TrendBadge trend={country.trend} /></td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}

function EventTypeBreakdown({ types }: { types: HumanitarianOverviewResponse['by_type'] }) {
  const maxCount = Math.max(...types.map((t) => t.count), 1)

  return (
    <motion.div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY, delay: 0.15 }}
    >
      <h3 className="text-sm font-semibold text-white mb-4">By Event Type</h3>
      <div className="space-y-3">
        {types.slice(0, 8).map((type) => (
          <div key={type.event_type} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/70 capitalize">{type.event_type}</span>
              <span className="text-xs font-bold text-white tabular-nums">{type.count} events</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500" style={{ width: `${(type.count / maxCount) * 100}%` }} />
              </div>
              <span className="text-xs text-white/50 tabular-nums w-12 text-right">{type.total_casualties.toLocaleString()}</span>
            </div>
            <div className="text-[10px] text-white/40">{type.affected_countries.length} countries affected</div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function DailyTimeline({ timeline }: { timeline: HumanitarianOverviewResponse['timeline'] }) {
  const maxCasualties = Math.max(...timeline.map((d) => d.casualties), 1)
  const maxEvents = Math.max(...timeline.map((d) => d.events), 1)

  if (timeline.length === 0) {
    return (
      <motion.div
        className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center text-white/40"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring' as const, ...SPRING_SNAPPY, delay: 0.2 }}
      >
        No timeline data available
      </motion.div>
    )
  }

  return (
    <motion.div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY, delay: 0.2 }}
    >
      <h3 className="text-sm font-semibold text-white mb-4">Daily Casualties</h3>
      <svg width="100%" height={120} viewBox={`0 0 ${Math.max(timeline.length * 4, 200)} 120`} style={{ minHeight: 120 }} className="overflow-visible">
        {timeline.map((d, i) => {
          const x = i * 4
          const height = (d.casualties / maxCasualties) * 100
          const barWidth = 2.5
          return (
            <g key={d.date}>
              <rect
                x={x + (4 - barWidth) / 2}
                y={100 - height}
                width={barWidth}
                height={height}
                fill="url(#gradient)"
                rx={0.5}
                opacity="0.8"
              />
            </g>
          )
        })}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <line x1="0" y1="100" x2={Math.max(timeline.length * 4, 200)} y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-white/40">
        <span>{timeline[0]?.date || 'N/A'}</span>
        <span>{timeline[timeline.length - 1]?.date || 'N/A'}</span>
      </div>
    </motion.div>
  )
}

function DataQualitySection({ quality }: { quality: HumanitarianOverviewResponse['data_quality'] }) {
  const coverage = quality.coverage_percentage
  const coverageColor = coverage >= 80 ? '#22c55e' : coverage >= 60 ? '#eab308' : '#ef4444'

  return (
    <motion.div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY, delay: 0.25 }}
    >
      <h3 className="text-sm font-semibold text-white mb-4">Data Quality</h3>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/60">Coverage</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: coverageColor }}>
              {coverage}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full" style={{ width: `${coverage}%`, background: coverageColor }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.05]">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.08em]">With Casualty Data</p>
            <p className="mt-1 text-base font-semibold text-white tabular-nums">{quality.events_with_casualty_data}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.08em]">Without Data</p>
            <p className="mt-1 text-base font-semibold text-white tabular-nums">{quality.events_without_casualty_data}</p>
          </div>
        </div>
        <div className="pt-2 border-t border-white/[0.05] text-[10px] text-white/40">
          Updated: {new Date(quality.last_updated).toLocaleString()}
        </div>
      </div>
    </motion.div>
  )
}

function MethodologyBanner({ methodology }: { methodology: HumanitarianOverviewResponse['methodology'] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4"
      initial={{ opacity: 0, y: -20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-300">Methodology</h3>
          <p className="mt-1 text-xs text-blue-200/80">{methodology.description}</p>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2 pt-3 border-t border-blue-400/20"
            >
              <div>
                <p className="text-xs font-semibold text-blue-300 mb-1">Limitations:</p>
                <ul className="text-[11px] text-blue-200/70 space-y-0.5">
                  {methodology.limitations.slice(0, 3).map((limit, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex-shrink-0">•</span>
                      <span>{limit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-300 mb-1">Confidence Note:</p>
                <p className="text-[11px] text-blue-200/70">{methodology.confidence_note}</p>
              </div>
            </motion.div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? 'Show less' : 'Learn more'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function HumanitarianClient() {
  const [data, setData] = useState<HumanitarianOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/humanitarian/overview', { cache: 'no-store' })
        if (!res.ok) throw new Error(`API error: ${res.statusText}`)
        const json = (await res.json()) as HumanitarianOverviewResponse
        setData(json)
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch data'
        setError(message)
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-12 w-12 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin mx-auto" />
          <p className="mt-4 text-sm text-white/50">Loading humanitarian data...</p>
        </motion.div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <p className="mt-4 text-sm text-white/70">{error || 'Failed to load data'}</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-[#070B11]">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl font-bold text-white">Humanitarian Tracker</h1>
          </div>
          <p className="text-sm text-white/50">
            Crisis overview for the past {Math.round((new Date(data.period.end).getTime() - new Date(data.period.start).getTime()) / (1000 * 60 * 60 * 24))} days
          </p>
        </motion.div>

        {/* Methodology Banner */}
        <MethodologyBanner methodology={data.methodology} />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Humanitarian Events"
            value={data.summary.total_humanitarian_events}
            trend={data.summary.trend_vs_prior_period}
            icon={AlertCircle}
          />
          <SummaryCard label="Estimated Casualties" value={data.summary.estimated_casualties.toLocaleString()} icon={Users} />
          <SummaryCard label="Countries Affected" value={data.summary.countries_affected} icon={Globe} />
          <SummaryCard label="Regions Affected" value={data.summary.regions_affected} icon={Activity} />
        </div>

        {/* Most Affected */}
        {data.summary.most_affected_country && (
          <motion.div
            className="rounded-lg border border-red-500/20 bg-red-500/5 p-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
          >
            <p className="text-xs uppercase tracking-[0.08em] text-red-300 font-semibold">Most Affected</p>
            <p className="mt-1 text-2xl font-bold text-white">{data.summary.most_affected_country.name}</p>
            <p className="mt-0.5 text-sm text-red-200">{data.summary.most_affected_country.casualties.toLocaleString()} estimated casualties</p>
          </motion.div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Country Table */}
            {data.by_country.length > 0 && <CountryTable countries={data.by_country} />}

            {/* Daily Timeline */}
            {data.timeline.length > 0 && <DailyTimeline timeline={data.timeline} />}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Event Type Breakdown */}
            {data.by_type.length > 0 && <EventTypeBreakdown types={data.by_type} />}

            {/* Data Quality */}
            <DataQualitySection quality={data.data_quality} />
          </div>
        </div>
      </div>
    </div>
  )
}
