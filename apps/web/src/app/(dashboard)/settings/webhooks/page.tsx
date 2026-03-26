'use client'

import { useEffect, useState } from 'react'

const EVENTS = ['alert.created', 'event.high_severity', 'forecast.updated']

export default function WebhooksPage() {
  const [hooks, setHooks] = useState<any[]>([])
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['alert.created'])
  const load = async () => { const res = await fetch('/api/v1/webhooks-config', { cache: 'no-store' }); const json = await res.json(); setHooks(json.data || []) }
  useEffect(() => { void load() }, [])
  const create = async () => { await fetch('/api/v1/webhooks-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, event_types: selectedEvents }) }); setUrl(''); await load() }
  return <div className="p-6 max-w-5xl"><h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>Webhooks</h1><div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add webhook endpoint</div><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-server/webhook" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} /><div className="mt-3 flex flex-wrap gap-2">{EVENTS.map((event) => <button key={event} onClick={() => setSelectedEvents((prev) => prev.includes(event) ? prev.filter((item) => item !== event) : [...prev, event])} className="rounded-full border px-3 py-1.5 text-sm" style={{ borderColor: selectedEvents.includes(event) ? 'var(--primary)' : 'var(--border)', color: selectedEvents.includes(event) ? 'var(--primary)' : 'var(--text-muted)' }}>{event}</button>)}</div><button onClick={() => void create()} className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Create webhook</button></div><div className="mt-6 space-y-3">{hooks.map((hook) => <div key={hook.id} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="text-sm" style={{ color: 'var(--text-primary)' }}>{hook.url}</div><div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{(hook.event_types || []).join(' · ')}</div><button className="mt-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Test</button></div>)}</div></div>
}
