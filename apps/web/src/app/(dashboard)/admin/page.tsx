'use client'

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Activity, Database, RefreshCw, Server, Shield } from 'lucide-react'
import { DataContractsPanel } from '@/components/admin/DataContractsPanel'

type HealthResponse = {
  db_ok?: boolean
  redis_ok?: boolean
  auth_ok?: boolean
  latency_ms?: number
  ingest?: { ok?: boolean; last_success_at?: string | null }
}

type RecentEvent = {
  id: string
  source?: string | null
  title?: string | null
  severity?: number | null
  occurred_at?: string | null
}

function timeAgo(input?: string | null) {
  if (!input) return 'never'
  const diff = Date.now() - new Date(input).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <motion.span
      animate={{ opacity: ok ? 1 : 0.5 }}
      className="inline-block h-3 w-3 rounded-full"
      style={{ background: ok ? '#22C55E' : '#EF4444' }}
    />
  )
}

type IconComponent = ComponentType<{ size?: number; style?: CSSProperties }>

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    },
  },
}

export default function AdminPage() {
  const RefreshIcon = RefreshCw as unknown as IconComponent
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const [healthRes, eventsRes] = await Promise.all([
      fetch('/api/health', { cache: 'no-store' }),
      fetch('/api/v1/events?limit=10&window=24h', { cache: 'no-store' }),
    ])
    const healthJson = await healthRes.json() as HealthResponse
    const eventsJson = await eventsRes.json() as { data?: RecentEvent[] }
    setHealth(healthJson)
    setRecentEvents(eventsJson.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const cards: Array<{ icon: IconComponent; label: string; ok: boolean; meta: string }> = [
    { icon: Database as unknown as IconComponent, label: 'Database', ok: Boolean(health?.db_ok), meta: `${health?.latency_ms ?? 0}ms` },
    { icon: Server as unknown as IconComponent, label: 'Redis', ok: Boolean(health?.redis_ok), meta: health?.redis_ok ? 'OK' : 'ERROR' },
    { icon: Shield as unknown as IconComponent, label: 'Auth', ok: Boolean(health?.auth_ok), meta: health?.auth_ok ? 'OK' : 'ERROR' },
    { icon: Activity as unknown as IconComponent, label: 'Ingest', ok: Boolean(health?.ingest?.ok), meta: `Last: ${timeAgo(health?.ingest?.last_success_at)}` },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-6xl mx-auto"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">System Health</h1>
            <div className="inline-flex rounded-full px-4 py-2 text-sm font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 backdrop-blur-sm">
              Doctor Mode
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg px-4 py-3 bg-white/[0.05] border border-white/10 text-white font-semibold hover:bg-white/[0.08] transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing' : 'Refresh'}
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* Health Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <motion.div key={card.label} variants={itemVariants}>
                <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative z-10">
                    <div className="mb-4 flex items-center justify-between">
                      <Icon size={20} style={{ color: '#60a5fa' }} />
                      <StatusDot ok={card.ok} />
                    </div>

                    <h3 className="text-sm font-semibold text-white mb-2">{card.label}</h3>
                    <p className={`text-sm font-mono ${card.ok ? 'text-green-400' : 'text-red-400'}`}>
                      {card.meta}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Data Contracts Panel */}
        <motion.div variants={itemVariants}>
          <DataContractsPanel />
        </motion.div>

        {/* Recent Events Table */}
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative z-10 border-b border-white/[0.05] px-8 py-6">
              <h2 className="text-xl font-semibold text-white">Recent Events</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.05]">
                    <th className="px-8 py-4 text-left font-semibold">Source</th>
                    <th className="px-8 py-4 text-left font-semibold">Title</th>
                    <th className="px-8 py-4 text-left font-semibold">Severity</th>
                    <th className="px-8 py-4 text-left font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-8 text-center text-sm text-white/30">
                        No events in the last 24 hours
                      </td>
                    </tr>
                  ) : (
                    recentEvents.map((event, index) => (
                      <motion.tr
                        key={event.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className="border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-8 py-4 text-white font-medium">{event.source ?? '—'}</td>
                        <td className="px-8 py-4 text-white/80">{String(event.title ?? '').slice(0, 60)}</td>
                        <td className="px-8 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                            !event.severity ? 'text-white/50' :
                            event.severity >= 7 ? 'text-red-400 bg-red-500/10' :
                            event.severity >= 4 ? 'text-amber-400 bg-amber-500/10' :
                            'text-green-400 bg-green-500/10'
                          }`}>
                            {event.severity ?? '—'}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-white/40 text-sm">{timeAgo(event.occurred_at)}</td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
