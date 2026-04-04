'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Actor {
  id: string; name: string; actor_type: string | null; country: string | null
  alignment: string | null; threat_level: string; is_sanctioned: boolean
  event_count: number; description: string | null; aliases: string[] | null
}

const THREAT_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e', none: '#6b7280',
}
const TYPE_ICON: Record<string, string> = {
  state: '🏛️', 'non-state': '⚔️', individual: '👤', organization: '🏢', company: '💼',
}

export function ActorsClient() {
  const [actors, setActors] = useState<Actor[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/v1/actors')
      .then(r => r.json())
      .then(d => { setActors(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? actors : actors.filter(a => a.actor_type === filter)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
            ACTOR PROFILES
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {actors.length} tracked entities · States, armed groups, individuals
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'state', 'non-state', 'individual', 'organization'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: filter === f ? 'var(--accent, #3b82f6)' : 'var(--bg-surface)',
                color: filter === f ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}>
              {f === 'all' ? 'All' : f.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl" style={{ background: 'var(--bg-surface)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No actors tracked yet. They&apos;ll populate as events are classified.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(actor => (
            <Link key={actor.id} href={`/actors/${actor.id}`}
              className="block rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{TYPE_ICON[actor.actor_type ?? ''] ?? '🔵'}</span>
                    <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {actor.name}
                    </span>
                    {actor.is_sanctioned && (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                        Sanctioned
                      </span>
                    )}
                  </div>
                  {actor.description && (
                    <p className="mt-1.5 text-xs line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {actor.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {actor.country && <span>📍 {actor.country}</span>}
                    {actor.alignment && <span>🧭 {actor.alignment}</span>}
                    {actor.event_count > 0 && <span>📰 {actor.event_count} mentions</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="rounded px-2 py-1 text-[10px] font-bold uppercase"
                    style={{ background: THREAT_COLOR[actor.threat_level] + '22', color: THREAT_COLOR[actor.threat_level] }}>
                    {actor.threat_level}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
