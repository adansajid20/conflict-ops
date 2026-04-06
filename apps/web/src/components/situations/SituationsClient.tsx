'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          ACTIVE SITUATIONS
        </h1>
        <p className="mt-1 text-sm text-white/30">
          {situations.length} monitored conflicts · Live intelligence tracking
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.015]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {situations.map(sit => (
            <Link key={sit.id} href={`/situations/${sit.slug}`}
              className="block rounded-xl border border-white/[0.05] bg-white/[0.015] p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: SEVERITY_COLOR[sit.severity] + '22', color: SEVERITY_COLOR[sit.severity] }}>
                      {sit.severity}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/30">
                      {sit.status}
                    </span>
                    {sit.primary_region && (
                      <span className="text-[10px] text-white/30">
                        {sit.primary_region.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-base font-semibold text-white">
                    {sit.name}
                  </h2>
                  {sit.description && (
                    <p className="mt-1 text-sm line-clamp-2 text-white/30">
                      {sit.description}
                    </p>
                  )}
                  {sit.tags && sit.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sit.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="rounded-full px-2 py-0.5 text-[10px] bg-white/[0.03] text-white/30">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Risk score */}
                <div className="shrink-0 text-right">
                  <div className="text-2xl font-bold tabular-nums"
                    style={{ color: RISK_BAR_COLOR(sit.risk_score), fontFamily: 'JetBrains Mono, monospace' }}>
                    {sit.risk_score.toFixed(1)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-white/30">
                    Risk Score
                  </div>
                  <div className="mt-1 h-1.5 w-20 rounded-full overflow-hidden bg-white/[0.05]">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(sit.risk_score / 10) * 100}%`, background: RISK_BAR_COLOR(sit.risk_score) }} />
                  </div>
                  <div className="mt-1.5 text-[10px] text-white/30">
                    {sit.event_count.toLocaleString()} events/30d
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
