'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, ExternalLink, TrendingUp } from 'lucide-react'

type Question = { id: string; title: string; probability: number; source: 'metaculus' | 'polymarket'; description: string; resolution_date?: string | null; volume?: number | null; url: string }
type EventRow = { id: string; title: string; occurred_at?: string | null; severity?: number | string | null; source: string }

function probColor(value: number) { if (value < 30) return '#22C55E'; if (value <= 70) return '#EAB308'; return '#EF4444' }
function formatDate(input?: string | null) { return input ? new Date(input).toLocaleDateString() : '—' }
function SourceBadge({ source }: { source: string }) { const ui = source === 'metaculus' ? ['rgba(37,99,235,0.15)', '#60A5FA'] : ['rgba(147,51,234,0.15)', '#C084FC']; return <span className="rounded-full px-2 py-1 text-[10px] font-medium uppercase" style={{ background: ui[0], color: ui[1] }}>{source}</span> }

export function MarketsPanel() {
  const TrendingUpIcon = TrendingUp as any
  const ExternalLinkIcon = ExternalLink as any
  const CalendarIcon = Calendar as any
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQ, setSelectedQ] = useState<Question | null>(null)
  const [filter, setFilter] = useState<'all' | 'metaculus' | 'polymarket' | 'high-conf' | 'closing-soon'>('all')
  const [relatedEvents, setRelatedEvents] = useState<EventRow[]>([])

  useEffect(() => {
    void fetch('/api/v1/markets', { cache: 'no-store' }).then((r) => r.json()).then((json: any) => {
      const metaculus = (json.data?.metaculus ?? []).map((q: any) => ({ id: String(q.id), title: q.title, probability: Math.round((q.community_prediction ?? 0) * 100), source: 'metaculus' as const, description: 'Community forecast from Metaculus.', resolution_date: q.close_time, volume: null, url: q.page_url }))
      const polymarket = (json.data?.polymarket ?? []).map((q: any) => ({ id: String(q.id), title: q.title, probability: Math.round(((q.outcomes?.[0]?.price ?? 0) as number) * 100), source: 'polymarket' as const, description: 'Real-money implied odds from Polymarket.', resolution_date: null, volume: q.volume_24hr, url: q.market_url }))
      const rows = [...metaculus, ...polymarket]
      setQuestions(rows)
      setSelectedQ(rows[0] ?? null)
    })
  }, [])

  useEffect(() => {
    if (!selectedQ) return
    const keyword = selectedQ.title.split(' ').slice(0, 4).join(' ')
    void fetch(`/api/v1/events?search=${encodeURIComponent(keyword)}&limit=3`, { cache: 'no-store' }).then((r) => r.json()).then((json: { data?: EventRow[] }) => setRelatedEvents(json.data ?? []))
  }, [selectedQ])

  const filtered = useMemo(() => questions.filter((q) => {
    if (filter === 'all') return true
    if (filter === 'high-conf') return q.probability >= 70
    if (filter === 'closing-soon') return !!q.resolution_date && new Date(q.resolution_date).getTime() - Date.now() < 14 * 86400000
    return q.source === filter
  }), [filter, questions])

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border lg:flex-row" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="flex min-h-0 flex-1 flex-col border-r" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-2 overflow-auto border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>{(['all', 'metaculus', 'polymarket', 'high-conf', 'closing-soon'] as const).map((tab) => <button key={tab} onClick={() => setFilter(tab)} className="rounded-full border px-3 py-1.5 text-sm capitalize" style={{ borderColor: filter === tab ? 'var(--primary)' : 'var(--border)', color: filter === tab ? 'var(--primary)' : 'var(--text-muted)' }}>{tab.replace('-', ' ')}</button>)}</div>
        <div className="flex-1 overflow-y-auto">{filtered.map((q) => <div key={q.id} onClick={() => setSelectedQ(q)} className="cursor-pointer border-b px-4 py-3 hover:bg-white/5" style={{ borderColor: 'var(--border)' }}><div className="flex items-start gap-3"><SourceBadge source={q.source} /><div className="flex-1"><p className="line-clamp-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{q.title}</p><div className="mt-1.5 flex items-center gap-2"><div className="h-1.5 w-full rounded" style={{ background: 'var(--bg-surface-3)' }}><div className="h-full rounded" style={{ width: `${q.probability}%`, background: probColor(q.probability) }} /></div><span className="text-sm font-bold" style={{ color: probColor(q.probability), fontFamily: 'JetBrains Mono, monospace' }}>{q.probability}%</span></div><div className="mt-1 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>{q.resolution_date && <span className="inline-flex items-center gap-1"><CalendarIcon size={10} /> {formatDate(q.resolution_date)}</span>}{q.volume ? <span>${q.volume.toLocaleString()}</span> : null}</div></div></div></div>)}</div>
      </div>
      <div className="w-full shrink-0 p-4 lg:w-80">{!selectedQ ? <div className="flex h-full items-center justify-center text-center" style={{ color: 'var(--text-muted)' }}>Select a question to view details</div> : <div><div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedQ.title}</div><div className="mt-2"><SourceBadge source={selectedQ.source} /></div><div className="mt-4 text-[48px] font-semibold" style={{ color: probColor(selectedQ.probability), fontFamily: 'JetBrains Mono, monospace' }}>{selectedQ.probability}%</div><div className="text-sm" style={{ color: 'var(--text-muted)' }}>probability</div><div className="mt-2 h-3 rounded-full" style={{ background: 'var(--bg-surface-3)' }}><div className="h-full rounded-full" style={{ width: `${selectedQ.probability}%`, background: probColor(selectedQ.probability) }} /></div><p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedQ.description}</p><div className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Resolution: {formatDate(selectedQ.resolution_date)}</div><a href={selectedQ.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>View on {selectedQ.source} <ExternalLinkIcon size={14} /></a><div className="mt-6"><div className="mb-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Related events</div>{relatedEvents.slice(0, 3).map((event) => <div key={event.id} className="mb-2 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><div className="text-sm" style={{ color: 'var(--text-primary)' }}>{event.title}</div><div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{event.source}</div></div>)}{relatedEvents.length === 0 && <div className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>No linked reporting found.</div>}</div></div>}</div>
    </div>
  )
}
