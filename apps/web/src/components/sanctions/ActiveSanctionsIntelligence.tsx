'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Globe, TrendingDown, Activity, Clock } from 'lucide-react'
import { getCountryName, getCountryFlag } from '@/lib/countries'

type ActiveEntity = {
  id: string
  entity_name: string
  entity_type: string
  list_source: string
  country: string
  last_activity: string
  event_count: number
  new_regions: string[]
  confidence: number
}

type SanctionsActivity = {
  active_entities?: ActiveEntity[]
  total_events?: number
  unique_entities?: number
}

const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

const sourceColor: Record<string, string> = {
  OFAC_SDN: 'bg-red-400/20 text-red-300 border-red-400/30',
  EU: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  UN: 'bg-cyan-400/20 text-cyan-300 border-cyan-400/30',
  UK_OFSI: 'bg-purple-400/20 text-purple-300 border-purple-400/30',
}

function getRelativeTime(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diff = now.getTime() - then.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return then.toLocaleDateString()
}

export function ActiveSanctionsIntelligence() {
  const [data, setData] = useState<SanctionsActivity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/v1/sanctions/activity', { cache: 'no-store' })
      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const json = await res.json() as SanctionsActivity
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sanctions activity')
      console.error('Sanctions activity fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 60000) // Refresh every 60s
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center py-12 text-white/50"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full mr-2"
        />
        <span className="text-sm">Loading sanctions activity...</span>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
        className="bg-red-500/10 border border-red-400/20 rounded-xl p-5 text-red-300 text-sm flex items-start gap-3"
      >
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium">Failed to load sanctions activity</div>
          <div className="text-xs mt-1 text-red-300/70">{error}</div>
        </div>
      </motion.div>
    )
  }

  const entities = data?.active_entities ?? []

  if (entities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING_SMOOTH}
        className="text-center py-12 text-white/50"
      >
        <Activity className="w-12 h-12 mx-auto mb-3 text-white/20" />
        <p className="text-sm">No active sanctions entities detected in recent events</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={SPRING_SMOOTH}
      className="space-y-4"
    >
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Events', value: data?.total_events ?? 0, icon: Activity },
          { label: 'Unique Entities', value: data?.unique_entities ?? 0, icon: Globe },
          { label: 'Recently Active', value: entities.length, icon: TrendingDown },
        ].map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, ...SPRING_SMOOTH }}
              className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-lg p-3 text-center"
            >
              <Icon className="w-3.5 h-3.5 text-white/40 mx-auto mb-1.5" />
              <div className="text-xs text-white/50 mb-0.5">{stat.label}</div>
              <div className="text-base font-bold text-white">{stat.value}</div>
            </motion.div>
          )
        })}
      </div>

      {/* Active entities list */}
      <div className="space-y-2">
        {entities.map((entity, idx) => (
          <motion.div
            key={entity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.02, ...SPRING_SMOOTH }}
            className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-red-400/20 rounded-lg overflow-hidden hover:border-red-400/40 transition-all"
          >
            <button
              onClick={() => setExpandedId(expandedId === entity.id ? null : entity.id)}
              className="w-full p-4 text-left flex items-start gap-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${sourceColor[entity.list_source] ?? 'bg-white/[0.1] text-white/80'}`}>
                    {entity.list_source}
                  </span>
                  <span className="font-semibold text-sm text-white">{entity.entity_name}</span>
                  <span className="text-xs text-white/50">{entity.entity_type}</span>
                </div>

                {/* Base location */}
                <div className="text-xs text-white/60 flex items-center gap-1 mb-2">
                  <Globe className="w-3 h-3" />
                  {getCountryName(entity.country)} {getCountryFlag(entity.country)}
                </div>

                {/* New regions warning */}
                {entity.new_regions && entity.new_regions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entity.new_regions.map((region, i) => (
                      <span
                        key={`${entity.id}-${i}`}
                        className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/20"
                      >
                        New: {region}
                      </span>
                    ))}
                  </div>
                )}

                {/* Activity indicators */}
                <div className="flex items-center gap-4 text-xs text-white/50 mt-2">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {entity.event_count} event{entity.event_count !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getRelativeTime(entity.last_activity)}
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    {Math.round(entity.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            </button>

            {/* Expanded details */}
            <AnimatePresence>
              {expandedId === entity.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={SPRING_SMOOTH}
                  className="border-t border-white/[0.05] bg-white/[0.02] p-4 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-white/50">Primary Country</span>
                      <div className="text-white mt-1">{getCountryName(entity.country)}</div>
                    </div>
                    <div>
                      <span className="text-white/50">Sanctions List</span>
                      <div className="text-white mt-1 font-mono text-[11px]">{entity.list_source}</div>
                    </div>
                    <div>
                      <span className="text-white/50">Last Activity</span>
                      <div className="text-white mt-1">{new Date(entity.last_activity).toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-white/50">Associated Events</span>
                      <div className="text-white mt-1 font-bold">{entity.event_count}</div>
                    </div>
                  </div>

                  {entity.new_regions && entity.new_regions.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.05]">
                      <span className="text-white/50 text-xs">New Geographic Presence</span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {entity.new_regions.map((region, i) => (
                          <span
                            key={`${entity.id}-new-${i}`}
                            className="text-xs px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/20"
                          >
                            {region}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/[0.05] text-xs text-white/60">
                    This sanctioned entity has appeared in {entity.event_count} recent event{entity.event_count !== 1 ? 's' : ''} in our intelligence feed.
                    {entity.new_regions && entity.new_regions.length > 0 && ` It has been detected in new areas: ${entity.new_regions.join(', ')}.`}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
