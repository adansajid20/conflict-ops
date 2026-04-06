'use client'

import { useEffect, useState, useCallback } from 'react'
import { OrgRequired } from '@/components/org/OrgRequired'

type APIKey = {
  id: string
  name: string
  key_prefix: string
  active: boolean
  last_used: string | null
  expires_at: string | null
  created_at: string
  key?: string  // only present on creation
}

export function APIKeysManager() {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noOrg, setNoOrg] = useState(false)
  const [planError, setPlanError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/apikeys')
      const json = await res.json() as { data?: APIKey[]; error?: string }
      if (json.data) {
        setKeys(json.data)
      } else if (json.error === 'No org') {
        setNoOrg(true)
      } else if (json.error) {
        setError(json.error)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const create = async () => {
    if (!name.trim()) return
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/v1/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json() as { data?: APIKey; error?: string }
      if (json.data) {
        setNewKey(json.data.key ?? null)
        setName('')
        await load()
      } else if (json.error?.includes('Business')) {
        setPlanError(json.error)
      } else if (json.error) setError(json.error)
    } finally { setCreating(false) }
  }

  const revoke = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/apikeys?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: 'Failed to revoke key' })) as { error?: string }
        setError(json.error ?? 'Failed to revoke key')
        return
      }
      await load()
    } catch {
      setError('Failed to revoke key')
    }
  }

  const rotate = async (id: string) => {
    setRotatingId(id)
    setError(null)
    try {
      const res = await fetch('/api/v1/apikeys/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_id: id }),
      })
      const json = await res.json() as { success?: boolean; data?: APIKey; error?: string }
      if (json.data?.key) {
        setNewKey(json.data.key)
        await load()
      } else if (json.error) {
        setError(json.error)
      }
    } finally {
      setRotatingId(null)
    }
  }

  if (loading) return <div className="text-xs mono p-4" style={{ color: 'var(--text-muted)' }}>LOADING...</div>

  if (noOrg) return (
    <OrgRequired
      feature="API Keys"
      description="API keys are scoped to your organization. Create one now to unlock programmatic access."
    />
  )

  return (
    <div>
      {/* New key created banner */}
      {newKey && (
        <div className="p-4 rounded border mb-6" style={{ borderColor: '#10B981', backgroundColor: '#10B98120' }}>
          <div className="text-xs mono font-bold mb-2" style={{ color: '#10B981' }}>✓ API KEY CREATED — COPY NOW</div>
          <code className="text-xs mono break-all block mb-2 p-2 rounded" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            {newKey}
          </code>
          <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
            This key will not be shown again. Store it securely.
          </p>
          <button onClick={() => void navigator.clipboard.writeText(newKey)}
            className="mt-2 px-4 py-1 text-xs mono rounded border"
            style={{ borderColor: '#10B981', color: '#10B981' }}>
            COPY TO CLIPBOARD
          </button>
        </div>
      )}

      {/* Error */}
      {(error || planError) && (
        <div className="p-3 rounded border mb-4 text-xs mono" style={{ borderColor: '#EF4444', color: '#EF4444' }}>
          {error || planError}
        </div>
      )}

      {/* Create form */}
      <div className="p-4 rounded border mb-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>CREATE NEW API KEY</div>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Key name (e.g. Production)"
            className="flex-1 px-3 py-2 text-xs mono rounded border"
            style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <button onClick={() => void create()} disabled={creating || !name.trim()}
            className="px-4 py-2 text-xs mono rounded font-bold"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            {creating ? '...' : 'CREATE'}
          </button>
        </div>
      </div>

      {/* Key list */}
      {loading ? (
        <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>LOADING...</p>
      ) : keys.length === 0 ? (
        <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>NO API KEYS YET</p>
      ) : (
        <div>
          <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>ACTIVE KEYS</div>
          {keys.map(k => (
            <div key={k.id} className="p-3 rounded border mb-2 flex items-center justify-between"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <div>
                <div className="text-xs mono font-bold" style={{ color: 'var(--text-primary)' }}>{k.name}</div>
                <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
                  {k.key_prefix} · Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used && ` · Last used ${new Date(k.last_used).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void rotate(k.id)}
                  disabled={rotatingId === k.id}
                  className="px-3 py-1 text-xs mono rounded border"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                  {rotatingId === k.id ? 'ROTATING...' : 'ROTATE'}
                </button>
                <button onClick={() => { if (confirm('Revoke this key?')) void revoke(k.id) }}
                  className="px-3 py-1 text-xs mono rounded border"
                  style={{ borderColor: '#EF4444', color: '#EF4444' }}>
                  REVOKE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API docs */}
      <div className="mt-6 p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>QUICK START</div>
        <code className="text-xs mono block" style={{ color: 'var(--text-primary)' }}>
          {`curl https://conflictradar.co/api/public/v1/events \\
  -H "Authorization: Bearer cok_live_..." \\
  -d "limit=50&severity_gte=3"`}
        </code>
        <div className="text-xs mono mt-2" style={{ color: 'var(--text-muted)' }}>
          Rate limit: 1,000 req/hr (Business) · Docs: /api/public/v1
        </div>
      </div>
    </div>
  )
}
