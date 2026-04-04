'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft as ArrowLeftIcon } from 'lucide-react'
const ArrowLeft = ArrowLeftIcon as React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>

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
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: 'var(--bg-surface)' }} />)}
    </div>
  )

  if (!data) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p style={{ color: 'var(--text-muted)' }}>Actor not found.</p>
      <Link href="/actors" className="mt-4 inline-block text-sm underline" style={{ color: 'var(--accent)' }}>← Back to actors</Link>
    </div>
  )

  const { actor, mentions } = data
  const tc = THREAT_COLOR[actor.threat_level] ?? '#6b7280'

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/actors" className="mb-6 inline-flex items-center gap-1.5 text-sm hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={14} /> Actor Profiles
      </Link>

      <div className="rounded-xl border p-6 mb-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
              {actor.name}
            </h1>
            {actor.aliases && actor.aliases.length > 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Also known as: {actor.aliases.join(', ')}
              </p>
            )}
            {actor.description && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {actor.description}
              </p>
            )}
          </div>
          <div className="shrink-0 text-center">
            <div className="rounded-xl px-3 py-2" style={{ background: tc + '22' }}>
              <div className="text-lg font-bold uppercase" style={{ color: tc, fontFamily: 'JetBrains Mono, monospace' }}>
                {actor.threat_level}
              </div>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Threat Level
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          {[
            { label: 'Type', value: actor.actor_type ?? '—' },
            { label: 'Country', value: actor.country ?? '—' },
            { label: 'Alignment', value: actor.alignment ?? '—' },
            { label: 'Mentions', value: actor.event_count.toString() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              <div className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>

        {actor.is_sanctioned && actor.sanctions_lists && (
          <div className="mt-4 rounded-lg p-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <span className="text-xs font-bold" style={{ color: '#ef4444' }}>⚠️ SANCTIONED</span>
            <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
              Lists: {actor.sanctions_lists.join(', ')}
            </span>
          </div>
        )}

        {actor.wikipedia_url && (
          <div className="mt-3">
            <a href={actor.wikipedia_url} target="_blank" rel="noreferrer"
              className="text-xs underline" style={{ color: 'var(--text-muted)' }}>
              Wikipedia →
            </a>
          </div>
        )}
      </div>

      {/* Mentions */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Recent Mentions ({mentions.length})
      </h2>
      {mentions.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No event mentions tracked yet.
        </p>
      ) : (
        <div className="space-y-2">
          {mentions.map(m => (
            <div key={m.id} className="rounded-lg border p-3 flex gap-3"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              {m.events && (
                <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold h-fit"
                  style={{ background: SEV_COLOR[m.events.severity] + '22', color: SEV_COLOR[m.events.severity] }}>
                  {m.events.severity === 4 ? 'CRIT' : m.events.severity === 3 ? 'HIGH' : m.events.severity === 2 ? 'MED' : 'LOW'}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {m.events?.title ?? 'Unknown event'}
                </p>
                <div className="mt-1 flex gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {m.role && <span className="capitalize">Role: {m.role}</span>}
                  {m.events?.occurred_at && <span>{new Date(m.events.occurred_at).toLocaleDateString()}</span>}
                  {m.sentiment && <span className="capitalize">Sentiment: {m.sentiment}</span>}
                </div>
                {m.context && (
                  <p className="mt-1 text-xs italic line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                    &ldquo;{m.context}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
