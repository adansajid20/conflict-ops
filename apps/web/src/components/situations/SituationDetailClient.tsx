'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft as ArrowLeftIcon, AlertTriangle as AlertTriangleIcon, Activity as ActivityIcon, Globe as GlobeIcon, Clock as ClockIcon } from 'lucide-react'
type IconProps = { size?: number; className?: string; style?: React.CSSProperties }
const ArrowLeft = ArrowLeftIcon as React.ComponentType<IconProps>
const AlertTriangle = AlertTriangleIcon as React.ComponentType<IconProps>
const Activity = ActivityIcon as React.ComponentType<IconProps>
const Globe = GlobeIcon as React.ComponentType<IconProps>
const Clock = ClockIcon as React.ComponentType<IconProps>

interface Event {
  id: string; title: string; severity: number; region: string | null
  occurred_at: string; source: string; event_type: string | null
  escalation_signal: boolean; outlet_name: string | null
}
interface Situation {
  id: string; name: string; slug: string; description: string | null
  status: string; severity: string; primary_region: string | null
  countries: string[] | null; event_count: number; risk_score: number
  tags: string[] | null; started_at: string | null; casualty_estimate: number | null
}

const SEV_COLOR: Record<number, string> = { 4: '#ef4444', 3: '#f97316', 2: '#eab308', 1: '#22c55e' }
const SEV_LABEL: Record<number, string> = { 4: 'CRITICAL', 3: 'HIGH', 2: 'MEDIUM', 1: 'LOW' }

export function SituationDetailClient({ slug }: { slug: string }) {
  const [data, setData] = useState<{ situation: Situation; events: Event[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/situations/${slug}`)
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.015]" />)}
    </div>
  )

  if (!data) return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <p className="text-white/50">Situation not found.</p>
      <Link href="/situations" className="mt-4 inline-block text-sm underline text-blue-400">← Back to situations</Link>
    </div>
  )

  const { situation, events } = data
  const riskColor = situation.risk_score >= 8 ? '#ef4444' : situation.risk_score >= 6 ? '#f97316' : '#eab308'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/situations" className="mb-6 inline-flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70 text-white/50">
        <ArrowLeft size={14} /> All Situations
      </Link>

      {/* Hero */}
      <div className="mb-6 rounded-xl border border-white/[0.05] bg-white/[0.015] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: riskColor }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: riskColor }}>
                {situation.status}
              </span>
              {situation.primary_region && (
                <span className="text-[10px] uppercase tracking-wider text-white/50">
                  {situation.primary_region.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {situation.name}
            </h1>
            {situation.description && (
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {situation.description}
              </p>
            )}
            {situation.countries && situation.countries.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {situation.countries.map(c => (
                  <span key={c} className="rounded-full border border-white/[0.05] px-2 py-0.5 text-[11px] text-white/50">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="shrink-0 text-right">
            <div className="tabular-nums text-4xl font-bold text-white" style={{ color: riskColor, fontFamily: 'JetBrains Mono, monospace' }}>
              {situation.risk_score.toFixed(1)}
            </div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-white/50">Risk Score</div>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full rounded-full" style={{ width: `${(situation.risk_score / 10) * 100}%`, background: riskColor }} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Activity, label: 'Events / 30d', value: situation.event_count.toLocaleString() },
            { icon: AlertTriangle, label: 'Severity', value: situation.severity.toUpperCase() },
            { icon: Globe, label: 'Region', value: (situation.primary_region ?? '—').replace(/_/g, ' ') },
            { icon: Clock, label: 'Started', value: situation.started_at ? new Date(situation.started_at).getFullYear().toString() : '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-lg bg-white/[0.025] p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Icon size={11} className="text-white/50" />
                <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
              </div>
              <div className="text-sm font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        {situation.tags && situation.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {situation.tags.map(tag => (
              <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] text-red-500" style={{ background: 'rgba(239,68,68,0.1)' }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Events timeline */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/50">
          Recent Events ({events.length})
        </h2>
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/50">No events in last 30 days.</p>
          ) : events.map(event => (
            <div key={event.id} className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
              <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold"
                style={{ background: SEV_COLOR[event.severity] + '22', color: SEV_COLOR[event.severity] }}>
                {SEV_LABEL[event.severity] ?? 'LOW'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-white">{event.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
                  <span>{event.outlet_name ?? event.source}</span>
                  <span>·</span>
                  <span>{new Date(event.occurred_at).toLocaleString()}</span>
                  {event.escalation_signal && (
                    <span className="rounded px-1 py-0.5 text-red-500" style={{ background: 'rgba(239,68,68,0.15)' }}>
                      ⚡ ESCALATION
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
