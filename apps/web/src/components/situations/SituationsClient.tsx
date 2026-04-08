'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

interface Situation {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  severity: string
  primary_region: string | null
  countries: string[] | null
  event_count: number
  risk_score: number
  tags: string[] | null
  started_at: string | null
  last_event_at: string | null
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
}

const RISK_BAR_COLOR = (score: number) => {
  if (score >= 8) return '#ef4444'
  if (score >= 6) return '#f97316'
  if (score >= 4) return '#eab308'
  return '#22c55e'
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

export function SituationsClient() {
  const [situations, setSituations] = useState<Situation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/situations')
      .then(r => r.json())
      .then(d => { setSituations(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
      >
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          ACTIVE SITUATIONS
        </h1>
        <p className="mt-2 text-sm text-white/40">
          {situations.length} monitored conflicts · Live intelligence tracking
        </p>
      </motion.div>

      <AnimatePresence>
        {loading ? (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, ...SPRING_SMOOTH }}
                className="h-28 animate-pulse rounded-xl bg-gradient-to-r from-white/[0.05] to-white/[0.02] backdrop-blur-sm"
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SPRING_SMOOTH}
          >
            {situations.map((sit, idx) => (
              <motion.div
                key={sit.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, ...SPRING_SMOOTH }}
                whileHover={{ y: -4 }}
              >
                <Link href={`/situations/${sit.slug}`}
                  className="block rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-white/[0.005] p-6 transition-all backdrop-blur-sm hover:border-white/[0.12] hover:shadow-lg hover:shadow-white/[0.1]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <motion.span
                          className="rounded px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: SEVERITY_COLOR[sit.severity] + '22', color: SEVERITY_COLOR[sit.severity], border: `1px solid ${SEVERITY_COLOR[sit.severity]}44` }}
                          whileHover={{ scale: 1.1 }}
                        >
                          {sit.severity}
                        </motion.span>
                        <span className="text-[10px] uppercase tracking-wider text-white/30">
                          {sit.status}
                        </span>
                        {sit.primary_region && (
                          <span className="text-[10px] text-white/40 font-medium">
                            {sit.primary_region.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-bold text-white">
                        {sit.name}
                      </h2>
                      {sit.description && (
                        <p className="mt-2 text-sm line-clamp-2 text-white/40">
                          {sit.description}
                        </p>
                      )}
                      {sit.tags && sit.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {sit.tags.slice(0, 5).map(tag => (
                            <motion.span
                              key={tag}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="rounded-full px-2.5 py-1 text-[10px] bg-white/[0.06] text-white/40 border border-white/[0.08] font-medium"
                            >
                              {tag}
                            </motion.span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Risk score */}
                    <motion.div className="shrink-0 text-right" whileHover={{ scale: 1.05 }}>
                      <div className="text-3xl font-bold tabular-nums"
                        style={{ color: RISK_BAR_COLOR(sit.risk_score), fontFamily: 'JetBrains Mono, monospace' }}>
                        {sit.risk_score.toFixed(1)}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-white/30 mt-1">
                        Risk Score
                      </div>
                      <motion.div
                        className="mt-2 h-1.5 w-24 rounded-full overflow-hidden bg-white/[0.08]"
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ delay: 0.05, ...SPRING_SMOOTH }}
                      >
                        <motion.div
                          className="h-full rounded-full transition-all"
                          style={{ background: RISK_BAR_COLOR(sit.risk_score) }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(sit.risk_score / 10) * 100}%` }}
                          transition={{ delay: 0.1, ...SPRING_SMOOTH }}
                        />
                      </motion.div>
                      <div className="mt-2 text-[10px] text-white/30 font-mono">
                        {sit.event_count.toLocaleString()} events
                      </div>
                    </motion.div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
