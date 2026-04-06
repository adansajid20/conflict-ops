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

  if (loading) return <div className="text-xs mono p-4 text-white/30">LOADING...</div>

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
        <div className="mb-6 rounded border border-green-400/35 bg-green-500/10 p-4">
          <div className="mb-2 text-xs font-bold text-green-400">✓ API KEY CREATED — COPY NOW</div>
          <code className="mb-2 block break-all rounded bg-white/[0.05] p-2 text-xs text-white">
            {newKey}
          </code>
          <p className="text-xs text-white/50">
            This key will not be shown again. Store it securely.
          </p>
          <button onClick={() => void navigator.clipboard.writeText(newKey)}
            className="mt-2 rounded border border-green-400/35 bg-green-500/10 px-4 py-1 text-xs font-medium text-green-400 hover:bg-green-500/20">
            COPY TO CLIPBOARD
          </button>
        </div>
      )}

      {/* Error */}
      {(error || planError) && (
        <div className="mb-4 rounded border border-red-400/35 bg-red-500/10 p-3 text-xs text-red-400">
          {error || planError}
        </div>
      )}

      {/* Create form */}
      <div className="mb-6 rounded border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03]">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">CREATE NEW API KEY</div>
        <div className="flex gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Key name (e.g. Production)"
            className="flex-1 rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20" />
          <button onClick={() => void create()} disabled={creating || !name.trim()}
            className="rounded bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50">
            {creating ? '...' : 'CREATE'}
          </button>
        </div>
      </div>

      {/* Key list */}
      {loading ? (
        <p className="py-8 text-center text-xs text-white/50">LOADING...</p>
      ) : keys.length === 0 ? (
        <p className="py-8 text-center text-xs text-white/50">NO API KEYS YET</p>
      ) : (
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">ACTIVE KEYS</div>
          {keys.map(k => (
            <div key={k.id} className="mb-2 flex items-center justify-between rounded border border-white/[0.05] bg-white/[0.015] p-3 hover:bg-white/[0.03]">
              <div>
                <div className="text-xs font-bold text-white">{k.name}</div>
                <div className="text-xs text-white/50">
                  {k.key_prefix} · Created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used && ` · Last used ${new Date(k.last_used).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void rotate(k.id)}
                  disabled={rotatingId === k.id}
                  className="rounded border border-blue-400/35 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50">
                  {rotatingId === k.id ? 'ROTATING...' : 'ROTATE'}
                </button>
                <button onClick={() => { if (confirm('Revoke this key?')) void revoke(k.id) }}
                  className="rounded border border-red-400/35 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20">
                  REVOKE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API docs */}
      <div className="mt-6 rounded border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03]">
        <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">QUICK START</div>
        <code className="block text-xs text-white">
          {`curl https://conflictradar.co/api/public/v1/events \\
  -H "Authorization: Bearer cok_live_..." \\
  -d "limit=50&severity_gte=3"`}
        </code>
        <div className="mt-2 text-xs text-white/50">
          Rate limit: 1,000 req/hr (Business) · Docs: /api/public/v1
        </div>
      </div>
    </div>
  )
}
