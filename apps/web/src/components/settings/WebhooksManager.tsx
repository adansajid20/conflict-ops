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
        <div className="p-4 rounded border mb-6" style={{ borderColor: '#10B981', backgroundColor: '#10B98120' }}>
          <div className="text-xs mono font-bold mb-2" style={{ color: '#10B981' }}>✓ WEBHOOK CREATED — COPY SIGNING SECRET</div>
          <code className="text-xs mono break-all block p-2 rounded mb-2" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            {newSecret}
          </code>
          <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>Not shown again. Verify payloads with HMAC-SHA256.</p>
        </div>
      )}

      {error && (
        error.toLowerCase().includes('org') || error.toLowerCase().includes('organization')
          ? <OrgRequired feature="Webhooks" description="Webhooks are scoped to your organization." />
          : <div className="p-3 rounded border mb-4 text-xs mono" style={{ borderColor: '#EF4444', color: '#EF4444' }}>{error}</div>
      )}

      {/* Create form */}
      <div className="p-4 rounded border mb-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="text-xs mono font-bold mb-3" style={{ color: 'var(--text-muted)' }}>ADD WEBHOOK ENDPOINT</div>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-server.com/webhook"
          className="w-full px-3 py-2 text-xs mono rounded border mb-2"
          style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
          className="w-full px-3 py-2 text-xs mono rounded border mb-3"
          style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        <div className="text-xs mono mb-2" style={{ color: 'var(--text-muted)' }}>EVENTS TO SUBSCRIBE</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {EVENTS.map(ev => (
            <button key={ev} onClick={() => toggle(ev)}
              className="px-2 py-1 text-xs mono rounded border"
              style={{
                borderColor: selectedEvents.includes(ev) ? 'var(--primary)' : 'var(--border)',
                color: selectedEvents.includes(ev) ? 'var(--primary)' : 'var(--text-muted)',
                backgroundColor: selectedEvents.includes(ev) ? 'var(--primary)20' : 'transparent',
              }}>
              {ev}
            </button>
          ))}
        </div>
        <button onClick={() => void create()} disabled={creating || !url || selectedEvents.length === 0}
          className="w-full py-2 text-xs mono rounded font-bold"
          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
          {creating ? 'CREATING...' : 'CREATE WEBHOOK'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>LOADING...</p>
      ) : hooks.length === 0 ? (
        <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>NO WEBHOOKS CONFIGURED</p>
      ) : hooks.map(h => (
        <div key={h.id} className="p-3 rounded border mb-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs mono font-bold truncate" style={{ color: 'var(--text-primary)' }}>{h.url}</div>
              <div className="text-xs mono mt-1 flex flex-wrap gap-1">
                {h.event_types.map(ev => (
                  <span key={ev} className="px-1 rounded" style={{ backgroundColor: 'var(--border)', color: 'var(--text-muted)' }}>{ev}</span>
                ))}
              </div>
              <div className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>
                {h.failure_count > 0 && <span style={{ color: '#EF4444' }}>⚠ {h.failure_count} failures · </span>}
                {h.last_triggered ? `Last: ${new Date(h.last_triggered).toLocaleString()}` : 'Never triggered'}
              </div>
            </div>
            <button onClick={() => void remove(h.id)}
              className="px-2 py-1 text-xs mono rounded border shrink-0"
              style={{ borderColor: '#EF4444', color: '#EF4444' }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )
}
