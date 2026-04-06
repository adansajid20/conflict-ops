'use client'

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react'
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
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ok ? '#22C55E' : '#EF4444' }} />
}

type IconComponent = ComponentType<{ size?: number; style?: CSSProperties }>

export default function AdminPage() {
  const RefreshIcon = RefreshCw as unknown as IconComponent
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])

  const load = async () => {
    const [healthRes, eventsRes] = await Promise.all([
      fetch('/api/health', { cache: 'no-store' }),
      fetch('/api/v1/events?limit=10&window=24h', { cache: 'no-store' }),
    ])
    const healthJson = await healthRes.json() as HealthResponse
    const eventsJson = await eventsRes.json() as { data?: RecentEvent[] }
    setHealth(healthJson)
    setRecentEvents(eventsJson.data ?? [])
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-white">System Health</h1>
          <div className="mt-1 inline-flex rounded-full px-2 py-1 text-xs bg-blue-500/10 text-blue-400">Doctor Mode</div>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.05] px-3 py-2 text-sm text-white">
          <RefreshIcon size={14} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
              <div className="mb-3 flex items-center justify-between"><Icon size={18} style={{ color: '#60a5fa' }} /><StatusDot ok={card.ok} /></div>
              <div className="text-sm font-medium text-white">{card.label}</div>
              <div className="mt-1 text-sm text-white/50">{card.meta}</div>
            </div>
          )
        })}
      </div>

      <DataContractsPanel />

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015]">
        <div className="border-b border-white/[0.05] px-4 py-3 text-sm font-semibold text-white">Recent Events</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/30">
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentEvents.map((event) => (
              <tr key={event.id} className="border-t border-white/[0.05]">
                <td className="px-4 py-3 text-white">{event.source ?? '—'}</td>
                <td className="px-4 py-3 text-white">{String(event.title ?? '').slice(0, 60)}</td>
                <td className="px-4 py-3 text-white/50">{event.severity ?? '—'}</td>
                <td className="px-4 py-3 text-white/30">{timeAgo(event.occurred_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
