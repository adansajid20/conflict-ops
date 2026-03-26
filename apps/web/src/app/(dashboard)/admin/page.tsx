'use client'

import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Database, RefreshCw, Server, Shield, ToggleLeft, ToggleRight } from 'lucide-react'

type Health = any
function timeAgo(input?: string | null) { if (!input) return 'never'; const d = Date.now() - new Date(input).getTime(); const m = Math.floor(d / 60000); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago` }
function StatusDot({ ok }: { ok: boolean }) { return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ok ? '#22C55E' : '#EF4444' }} /> }

export default function AdminPage() {
  const DatabaseIcon = Database as any
  const ServerIcon = Server as any
  const ShieldIcon = Shield as any
  const ActivityIcon = Activity as any
  const RefreshCwIcon = RefreshCw as any
  const ToggleLeftIcon = ToggleLeft as any
  const ToggleRightIcon = ToggleRight as any
  const ChevronDownIcon = ChevronDown as any
  const ChevronUpIcon = ChevronUp as any
  const [health, setHealth] = useState<Health | null>(null)
  const [recentEvents, setRecentEvents] = useState<any[]>([])
  const [ingestResult, setIngestResult] = useState<any>(null)
  const [safeMode, setSafeMode] = useState(false)
  const [showIngestOutput, setShowIngestOutput] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    const [healthRes, eventsRes] = await Promise.all([fetch('/api/health', { cache: 'no-store' }), fetch('/api/v1/events?limit=10&window=24h', { cache: 'no-store' })])
    const h = await healthRes.json(); const e = await eventsRes.json()
    setHealth(h); setSafeMode(h.safe_mode); setRecentEvents(e.data ?? [])
  }
  useEffect(() => { void load() }, [])

  const runAction = async (url: string, body?: any, headers?: Record<string, string>) => {
    setLoading(true)
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: body ? JSON.stringify(body) : undefined })
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    return json
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between"><div><h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>System Health</h1><div className="mt-1 inline-flex rounded-full px-2 py-1 text-xs" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>Doctor Mode</div></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}><RefreshCwIcon size={14} /> Refresh</button></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[{ icon: DatabaseIcon, label: 'Database', ok: !!health?.db_ok, meta: `${health?.latency_ms || 0}ms` }, { icon: ServerIcon, label: 'Redis', ok: !!health?.redis_ok, meta: health?.redis_ok ? 'OK' : 'ERROR' }, { icon: ShieldIcon, label: 'Auth', ok: !!health?.auth_ok, meta: health?.auth_ok ? 'OK' : 'ERROR' }, { icon: ActivityIcon, label: 'Ingest', ok: !!health?.ingest?.ok, meta: `Last: ${timeAgo(health?.ingest?.last_success_at)}` }].map((card, idx) => { const Icon = card.icon; return <div key={idx} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-3 flex items-center justify-between"><Icon size={18} style={{ color: 'var(--primary)' }} /><StatusDot ok={card.ok} /></div><div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{card.label}</div><div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{card.meta}</div></div> })}</div>
      <div className="mt-6 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Ingest Sources</div><table className="w-full text-sm"><thead><tr style={{ color: 'var(--text-muted)' }}><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Last Seen</th><th className="px-4 py-3 text-left">Events (24h)</th><th className="px-4 py-3 text-left">Action</th></tr></thead><tbody>{(health?.enabledSources || []).map((src: any) => <tr key={src.name} className="border-t" style={{ borderColor: 'var(--border)' }}><td className="px-4 py-3" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{src.name}</td><td className="px-4 py-3"><StatusDot ok={!!src.ok} /></td><td className="px-4 py-3" style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{timeAgo(src.last_seen_at)}</td><td className="px-4 py-3" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{src.events_24h || 0}</td><td className="px-4 py-3"><button onClick={() => void runAction('/api/v1/admin/run-ingest', undefined, { 'x-internal-secret': 'dev' }).then(setIngestResult)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Trigger</button></td></tr>)}</tbody></table></div>
      <div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Manual Controls</div><div className="flex flex-wrap gap-3"><button onClick={() => void runAction('/api/v1/admin/run-ingest', undefined, { 'x-internal-secret': 'dev' }).then((json) => { setIngestResult(json); setShowIngestOutput(true) })} className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Run Full Ingest</button><button onClick={() => void runAction('/api/v1/admin/backfill-geo').then(setIngestResult)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Backfill Geo</button><button onClick={() => void runAction('/api/v1/admin/clear-cache').then(setIngestResult)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Clear Cache</button><button onClick={() => void runAction('/api/v1/admin/safe-mode', { enabled: !safeMode }).then(() => { setSafeMode(!safeMode); void load() })} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>{safeMode ? <ToggleRightIcon size={18} /> : <ToggleLeftIcon size={18} />} Safe Mode</button></div>{ingestResult && <div className="mt-4"><button onClick={() => setShowIngestOutput((v) => !v)} className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{showIngestOutput ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />} Ingest output</button>{showIngestOutput && <pre className="mt-3 overflow-auto rounded-lg p-4 text-xs" style={{ background: '#03130a', color: '#86EFAC' }}>{JSON.stringify(ingestResult, null, 2)}</pre>}</div>}</div>
      <div className="mt-6 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Recent Events</div><table className="w-full text-sm"><thead><tr style={{ color: 'var(--text-muted)' }}><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-left">Title</th><th className="px-4 py-3 text-left">Severity</th><th className="px-4 py-3 text-left">Time</th></tr></thead><tbody>{recentEvents.map((event) => <tr key={event.id} className="border-t" style={{ borderColor: 'var(--border)' }}><td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{event.source}</td><td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{String(event.title || '').slice(0, 60)}</td><td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{event.severity}</td><td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{timeAgo(event.occurred_at)}</td></tr>)}</tbody></table></div>
      {loading && <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>Running command...</div>}
    </div>
  )
}
