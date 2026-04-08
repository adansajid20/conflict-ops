'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Shield, TrendingUp, MapPin } from 'lucide-react'

interface Actor {
  id: string; name: string; actor_type: string | null; country: string | null
  alignment: string | null; threat_level: string; is_sanctioned: boolean
  event_count: number; description: string | null; aliases: string[] | null
}

const THREAT_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', none: '#6b7280',
}
const TYPE_COLORS: Record<string, string> = {
  state: '#3b82f6', 'non-state': '#ef4444', individual: '#a78bfa', organization: '#f97316', company: '#22c55e',
}
const TYPE_ICON: Record<string, string> = {
  state: '🏛️', 'non-state': '⚔️', individual: '👤', organization: '🏢', company: '💼',
}

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }

function Sparkline({ count }: { count: number }) {
  const maxH = Math.max(count, 1)
  return (
    <svg width={40} height={24} viewBox="0 0 40 24">
      {[...Array(8)].map((_, i) => {
        const h = (Math.sin(i * 0.7) * 0.5 + 0.5) * maxH
        return (
          <rect
            key={i}
            x={i * 5}
            y={24 - (h / maxH) * 20}
            width={4}
            height={(h / maxH) * 20}
            fill="#3b82f6"
            opacity={0.6}
          />
        )
      })}
    </svg>
  )
}

export function ActorsClient() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/v1/actors')
      .then(r => r.json())
      .then(d => { setActors(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = (filter === 'all' ? actors : actors.filter(a => a.actor_type === filter))
    .filter(a => a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-[#070B11] px-8 py-10">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-400" />
              Actor Profiles
            </h1>
            <p className="text-sm text-white/40 mt-2">
              {actors.length} tracked entities across all regions
            </p>
          </div>
        </div>

        {/* Search bar */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search actors by name…"
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 text-white placeholder:text-white/30 transition-colors"
          />
        </motion.div>
      </motion.div>

      {/* Type filter */}
      <motion.div
        className="flex gap-2 mb-8 flex-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        {['all', 'state', 'non-state', 'individual', 'organization'].map((f, i) => (
          <motion.button
            key={f}
            onClick={() => setFilter(f)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer uppercase tracking-wider`}
            style={{
              background: filter === f ? (TYPE_COLORS[f] ?? '#3b82f6') + '15' : 'transparent',
              borderColor: filter === f ? (TYPE_COLORS[f] ?? '#3b82f6') : 'rgba(255,255,255,0.1)',
              color: filter === f ? (TYPE_COLORS[f] ?? '#3b82f6') : 'rgba(255,255,255,0.5)',
            }}
          >
            {f === 'all' ? 'All Entities' : f.replace('-', ' ')}
          </motion.button>
        ))}
      </motion.div>

      {/* Actors grid */}
      {loading ? (
        <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="h-32 animate-pulse rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
              }}
            />
          ))}
        </motion.div>
      ) : filtered.length === 0 ? (
        <motion.div
          className="text-center py-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Shield className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No actors match your search or filters.</p>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.05 }}
        >
          <AnimatePresence>
            {filtered.map(actor => {
              const color = TYPE_COLORS[actor.actor_type ?? 'state'] ?? '#3b82f6'
              const threatColor = THREAT_COLOR[actor.threat_level] ?? '#6b7280'

              return (
                <motion.div
                  key={actor.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
                >
                  <Link href={`/actors/${actor.id}`}>
                    <motion.div
                      className="group relative overflow-hidden rounded-2xl border transition-all cursor-pointer h-full"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
                        borderColor: 'rgba(255,255,255,0.06)',
                      }}
                      whileHover={{
                        borderColor: color + '60',
                        boxShadow: `0 0 20px ${color}20`,
                        y: -4,
                      }}
                    >
                      {/* Top edge highlight */}
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                      <div className="p-5 h-full flex flex-col">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-2xl flex-shrink-0">
                              {TYPE_ICON[actor.actor_type ?? ''] ?? '🔵'}
                            </span>
                            <div className="min-w-0">
                              <h3 className="font-bold text-white truncate text-sm">
                                {actor.name}
                              </h3>
                              {actor.actor_type && (
                                <span
                                  className="text-[10px] font-semibold uppercase tracking-wider mt-1 inline-block px-2 py-1 rounded"
                                  style={{ color, background: color + '15' }}
                                >
                                  {actor.actor_type.replace('-', ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <motion.div
                            className="flex-shrink-0 text-center rounded-lg p-2 text-right"
                            style={{
                              background: threatColor + '15',
                            }}
                          >
                            <div className="text-[10px] font-bold uppercase" style={{ color: threatColor }}>
                              {actor.threat_level}
                            </div>
                          </motion.div>
                        </div>

                        {/* Description */}
                        {actor.description && (
                          <p className="text-xs text-white/50 line-clamp-2 mb-3">
                            {actor.description}
                          </p>
                        )}

                        {/* Meta info */}
                        <div className="space-y-2 mb-4 flex-1">
                          {actor.country && (
                            <div className="flex items-center gap-2 text-xs text-white/40">
                              <MapPin className="w-3 h-3" />
                              {actor.country}
                            </div>
                          )}
                          {actor.alignment && (
                            <div className="text-xs text-white/40">
                              Alignment: <span className="text-white/60">{actor.alignment}</span>
                            </div>
                          )}
                        </div>

                        {/* Sanction badge */}
                        {actor.is_sanctioned && (
                          <motion.div
                            className="mb-3 rounded px-2.5 py-1.5 text-[10px] font-bold uppercase border"
                            style={{
                              background: '#ef444415',
                              borderColor: '#ef4444',
                              color: '#ef4444',
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                          >
                            ⚠️ Sanctioned Entity
                          </motion.div>
                        )}

                        {/* Activity sparkline */}
                        {actor.event_count > 0 && (
                          <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                            <span className="text-xs text-white/40">{actor.event_count} mentions</span>
                            <Sparkline count={actor.event_count} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}
