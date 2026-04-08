'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Shield, AlertTriangle, TrendingUp, MapPin, Calendar, BadgeAlert } from 'lucide-react'

interface Actor {
  id: string; name: string; actor_type: string | null; country: string | null
  alignment: string | null; threat_level: string; is_sanctioned: boolean
  event_count: number; description: string | null; aliases: string[] | null
  sanctions_lists: string[] | null; wikipedia_url: string | null; first_seen_at: string | null
}

interface Mention {
  id: string; role: string | null; context: string | null; sentiment: string | null
  created_at: string; events: { id: string; title: string; severity: number; occurred_at: string; region: string | null } | null
}

const THREAT_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', none: '#6b7280',
}
const SEV_COLOR: Record<number, string> = { 4: '#ef4444', 3: '#f97316', 2: '#eab308', 1: '#22c55e' }
const TYPE_COLORS: Record<string, string> = {
  state: '#3b82f6', 'non-state': '#ef4444', individual: '#a78bfa', organization: '#f97316', company: '#22c55e',
}

const SPRING_SNAPPY = { stiffness: 400, damping: 30 }

export function ActorDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<{ actor: Actor; mentions: Mention[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/actors/${id}`)
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-[#070B11] px-8 py-10">
      <motion.div
        className="space-y-4 max-w-4xl"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          }} />
        ))}
      </motion.div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-[#070B11] flex items-center justify-center flex-col gap-4">
      <Shield className="w-12 h-12 text-white/20" />
      <p className="text-white/40 text-sm">Actor not found.</p>
      <Link href="/actors" className="text-sm text-blue-400 hover:text-blue-300">← Back to actors</Link>
    </div>
  )

  const { actor, mentions } = data
  const tc = THREAT_COLOR[actor.threat_level] ?? '#6b7280'
  const typeColor = TYPE_COLORS[actor.actor_type ?? 'state'] ?? '#3b82f6'
  const firstSeen = actor.first_seen_at ? new Date(actor.first_seen_at) : null

  return (
    <div className="min-h-screen bg-[#070B11] px-8 py-10">
      {/* Back button */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <Link href="/actors" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Profiles
        </Link>
      </motion.div>

      {/* Header Card */}
      <motion.div
        className="rounded-2xl border overflow-hidden mb-8 p-8"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring' as const, ...SPRING_SNAPPY }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="flex items-start justify-between gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-4xl font-bold text-white mb-3">{actor.name}</h1>
            {actor.aliases && actor.aliases.length > 0 && (
              <p className="text-sm text-white/50 mb-3">
                Also known as: <span className="text-white/70">{actor.aliases.join(', ')}</span>
              </p>
            )}
            {actor.description && (
              <p className="text-sm leading-relaxed text-white/60 max-w-2xl">
                {actor.description}
              </p>
            )}
          </motion.div>

          {/* Threat badge */}
          <motion.div
            className="flex-shrink-0 rounded-xl px-6 py-4 text-center border"
            style={{
              background: tc + '10',
              borderColor: tc + '30',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring' as const, ...SPRING_SNAPPY, delay: 0.1 }}
          >
            <div className="text-2xl font-bold uppercase tracking-wider" style={{ color: tc, fontFamily: 'JetBrains Mono, monospace' }}>
              {actor.threat_level}
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40 mt-1">
              Threat Level
            </div>
          </motion.div>
        </div>

        {/* Meta grid */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, staggerChildren: 0.05 }}
        >
          {[
            { label: 'Entity Type', value: actor.actor_type ? actor.actor_type.replace('-', ' ') : '—', icon: '🏢' },
            { label: 'Country', value: actor.country ?? '—', icon: '📍' },
            { label: 'Alignment', value: actor.alignment ?? '—', icon: '🧭' },
            { label: 'Mentions', value: actor.event_count.toString(), icon: '📰' },
          ].map(({ label, value, icon }) => (
            <motion.div
              key={label}
              className="rounded-lg border p-4"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.06)',
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{label}</div>
              <div className="text-sm font-semibold text-white">{icon} {value}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Sanctions notice */}
        <AnimatePresence>
          {actor.is_sanctioned && actor.sanctions_lists && (
            <motion.div
              className="mt-6 p-4 rounded-lg border"
              style={{
                background: '#ef444410',
                borderColor: '#ef444430',
              }}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex items-start gap-3">
                <BadgeAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-red-400">Designated as Sanctioned Entity</div>
                  <div className="text-xs text-red-300/70 mt-1">
                    Listed on: {actor.sanctions_lists.join(', ')}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* First seen & Wikipedia */}
        <motion.div
          className="mt-6 flex items-center gap-6 text-xs text-white/50 border-t border-white/[0.05] pt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {firstSeen && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              First seen: {firstSeen.toLocaleDateString()}
            </div>
          )}
          {actor.wikipedia_url && (
            <a href={actor.wikipedia_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
              View on Wikipedia →
            </a>
          )}
        </motion.div>
      </motion.div>

      {/* Activity Timeline */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-blue-400" />
          Recent Mentions & Events
        </h2>

        {mentions.length === 0 ? (
          <motion.div
            className="text-center py-12 rounded-2xl border"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AlertTriangle className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No event mentions tracked yet.</p>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
          >
            {mentions.map((m, i) => {
              const severity = m.events?.severity ?? 1
              const sevColor = SEV_COLOR[severity]

              return (
                <motion.div
                  key={m.id}
                  className="rounded-xl border overflow-hidden p-5 group"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)',
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                  whileHover={{
                    borderColor: sevColor + '60',
                    boxShadow: `0 0 20px ${sevColor}20`,
                  }}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

                  <div className="flex items-start gap-4">
                    {m.events && (
                      <motion.span
                        className="mt-1 flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider h-fit"
                        style={{ background: sevColor + '20', color: sevColor, border: `1px solid ${sevColor}40` }}
                      >
                        {severity === 4 ? '🚨 CRITICAL' : severity === 3 ? '⚠️ HIGH' : severity === 2 ? '⚡ MED' : '✓ LOW'}
                      </motion.span>
                    )}

                    <div className="flex-1 min-w-0">
                      <motion.p className="text-base font-semibold text-white mb-2">
                        {m.events?.title ?? 'Unknown event'}
                      </motion.p>

                      <div className="space-y-2 text-xs text-white/50">
                        <div className="flex flex-wrap items-center gap-4">
                          {m.role && (
                            <span>
                              Role: <span className="text-white/70 capitalize">{m.role}</span>
                            </span>
                          )}
                          {m.events?.occurred_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(m.events.occurred_at).toLocaleDateString()}
                            </span>
                          )}
                          {m.events?.region && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {m.events.region}
                            </span>
                          )}
                          {m.sentiment && (
                            <span>
                              Sentiment: <span className="text-white/70 capitalize">{m.sentiment}</span>
                            </span>
                          )}
                        </div>

                        {m.context && (
                          <motion.p
                            className="italic mt-2 pl-3 border-l-2 text-white/40"
                            style={{ borderColor: sevColor + '50' }}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                          >
                            &ldquo;{m.context}&rdquo;
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
