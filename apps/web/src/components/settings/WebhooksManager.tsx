'use client'

import { useEffect, useState, useCallback } from 'react'
import { OrgRequired } from '@/components/org/OrgRequired'

const EVENTS = ['alert.created','event.high_severity','escalation.changed','vessel.dark','aircraft.emergency','forecast.updated']

type Webhook = {
  id: string
  url: string
  event_types: string[]
  active: boolean
  description: string | null
  created_at: string
  last_triggered: string | null
  failure_count: number
}

export function WebhooksManager() {
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['alert.created'])
  const [creating, setCreating] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/webhooks-config')
      const json = await res.json() as { data?: Webhook[]; error?: string }
      if (json.data) setHooks(json.data)
      else if (json.error) setError(json.error)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const toggle = (ev: string) =>
    setSelectedEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev])

  const create = async () => {
    if (!url || selectedEvents.length === 0) return
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/v1/webhooks-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, event_types: selectedEvents, description: desc || undefined }),
      })
      const json = await res.json() as { data?: Webhook & { signing_secret?: string }; error?: string }
      if (json.data?.signing_secret) { setNewSecret(json.data.signing_secret); setUrl(''); setDesc('') }
      else if (json.error) setError(json.error)
      await load()
    } finally { setCreating(false) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    try {
      const res = await fetch(`/api/v1/webhooks-config?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Failed to delete webhook' })) as { error?: string }
        setError(json.error ?? 'Failed to delete webhook')
        return
      }
      await load()
    } catch {
      setError('Failed to delete webhook')
    }
  }

  return (
    <div>
      {newSecret && (
        <div className="p-4 rounded border border-green-400/35 bg-green-500/10 mb-6">
          <div className="text-xs mono font-bold mb-2 text-green-400">✓ WEBHOOK CREATED — COPY SIGNING SECRET</div>
          <code className="text-xs mono break-all block p-2 rounded mb-2 bg-white/[0.05] text-white">
            {newSecret}
          </code>
          <p className="text-xs mono text-white/50">Not shown again. Verify payloads with HMAC-SHA256.</p>
        </div>
      )}

      {error && (
        error.toLowerCase().includes('org') || error.toLowerCase().includes('organization')
          ? <OrgRequired feature="Webhooks" description="Webhooks are scoped to your organization." />
          : <div className="p-3 rounded border border-red-400/35 mb-4 text-xs mono text-red-400">{error}</div>
      )}

      {/* Create form */}
      <div className="p-4 rounded border border-white/[0.05] bg-white/[0.015] mb-6">
        <div className="text-xs mono font-bold mb-3 text-white/30">ADD WEBHOOK ENDPOINT</div>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-server.com/webhook"
          className="w-full px-3 py-2 text-xs mono rounded border border-white/[0.05] bg-white/[0.03] mb-2 text-white placeholder:text-white/20" />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
          className="w-full px-3 py-2 text-xs mono rounded border border-white/[0.05] bg-white/[0.03] mb-3 text-white placeholder:text-white/20" />
        <div className="text-xs mono mb-2 text-white/30">EVENTS TO SUBSCRIBE</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {EVENTS.map(ev => (
            <button key={ev} onClick={() => toggle(ev)}
              className="px-2 py-1 text-xs mono rounded border"
              style={{
                borderColor: selectedEvents.includes(ev) ? '#60a5fa' : '#ffffff05',
                color: selectedEvents.includes(ev) ? '#60a5fa' : '#ffffff50',
                backgroundColor: selectedEvents.includes(ev) ? '#3b82f620' : 'transparent',
              }}>
              {ev}
            </button>
          ))}
        </div>
        <button onClick={() => void create()} disabled={creating || !url || selectedEvents.length === 0}
          className="w-full py-2 text-xs mono rounded font-bold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
          {creating ? 'CREATING...' : 'CREATE WEBHOOK'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-xs mono text-center py-8 text-white/30">LOADING...</p>
      ) : hooks.length === 0 ? (
        <p className="text-xs mono text-center py-8 text-white/30">NO WEBHOOKS CONFIGURED</p>
      ) : hooks.map(h => (
        <div key={h.id} className="p-3 rounded border border-white/[0.05] bg-white/[0.015] mb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs mono font-bold truncate text-white">{h.url}</div>
              <div className="text-xs mono mt-1 flex flex-wrap gap-1">
                {h.event_types.map(ev => (
                  <span key={ev} className="px-1 rounded bg-white/[0.05] text-white/50">{ev}</span>
                ))}
              </div>
              <div className="text-xs mono mt-1 text-white/30">
                {h.failure_count > 0 && <span className="text-red-400">⚠ {h.failure_count} failures · </span>}
                {h.last_triggered ? `Last: ${new Date(h.last_triggered).toLocaleString()}` : 'Never triggered'}
              </div>
            </div>
            <button onClick={() => void remove(h.id)}
              className="px-2 py-1 text-xs mono rounded border border-red-400/35 text-red-400 shrink-0 hover:bg-red-500/10">✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
