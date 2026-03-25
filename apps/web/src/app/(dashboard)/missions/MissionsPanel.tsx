'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type Mission = {
  id: string
  name: string
  description: string | null
  regions: string[]
  tags: string[]
  created_at: string
  status?: string
}

type MissionsResponse = {
  success: boolean
  data?: Mission[]
  meta?: { personal_mode?: boolean }
  error?: string
}

function MissionSkeleton() {
  return (
    <div className="p-4 rounded border mb-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="skeleton h-4 rounded mb-2" style={{ width: '50%' }} />
      <div className="skeleton h-3 rounded mb-2" style={{ width: '80%' }} />
      <div className="skeleton h-3 rounded" style={{ width: '30%' }} />
    </div>
  )
}

export default function MissionsPanel() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [personalMode, setPersonalMode] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [createError, setCreateError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const REGIONS = [
    'Eastern Europe', 'Middle East', 'Sub-Saharan Africa', 'East Asia',
    'South Asia', 'Central Asia', 'North Africa', 'Latin America', 'Global',
  ]

  const fetchMissions = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    try {
      const res = await fetch('/api/v1/missions', { signal: abortRef.current.signal })
      if (!res.ok) { setError(`HTTP ${res.status}`); return }
      const json = await res.json() as MissionsResponse
      if (!json.success) { setError(json.error ?? 'Request failed'); return }
      setMissions(json.data ?? [])
      setPersonalMode(json.meta?.personal_mode === true)
      setError(null)
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMissions()
    return () => abortRef.current?.abort()
  }, [fetchMissions])

  const createMission = async () => {
    if (!name.trim()) return
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/v1/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, regions: selectedRegions }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (json.success) {
        setName(''); setDescription(''); setSelectedRegions([]); setShowForm(false)
        void fetchMissions()
      } else {
        setCreateError(json.error ?? 'Failed to create')
      }
    } catch { setCreateError('Network error') }
    finally { setCreating(false) }
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
            MISSIONS
          </h1>
          <p className="text-xs mt-1 mono" style={{ color: 'var(--text-muted)' }}>
            Focused intelligence collection campaigns. Group events, alerts, and forecasts by objective.
          </p>
        </div>
        {!personalMode && (
          <button onClick={() => setShowForm(s => !s)}
            className="px-4 py-2 rounded text-xs mono font-bold"
            style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
            + NEW MISSION
          </button>
        )}
      </div>

      {/* New mission form */}
      {showForm && (
        <div className="mb-6 p-5 rounded border" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary-dim)' }}>
          <h3 className="text-xs mono font-bold mb-4" style={{ color: 'var(--primary)' }}>CREATE MISSION</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs mono mb-1 block" style={{ color: 'var(--text-muted)' }}>NAME *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Ukraine Conflict Monitoring"
                className="w-full px-3 py-2 rounded border text-sm mono"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }} />
            </div>
            <div>
              <label className="text-xs mono mb-1 block" style={{ color: 'var(--text-muted)' }}>DESCRIPTION</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={2} placeholder="Optional context..."
                className="w-full px-3 py-2 rounded border text-sm"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none', resize: 'none' }} />
            </div>
            <div>
              <label className="text-xs mono mb-2 block" style={{ color: 'var(--text-muted)' }}>REGIONS</label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map(r => (
                  <button key={r} onClick={() => setSelectedRegions(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])}
                    className="px-2 py-1 rounded text-xs mono border"
                    style={{
                      borderColor: selectedRegions.includes(r) ? 'var(--primary)' : 'var(--border)',
                      color: selectedRegions.includes(r) ? 'var(--primary)' : 'var(--text-muted)',
                      backgroundColor: selectedRegions.includes(r) ? 'var(--primary-dim)' : 'transparent',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {createError && <p className="text-xs mono" style={{ color: '#FF4444' }}>⚠ {createError}</p>}
            <div className="flex gap-2">
              <button onClick={() => void createMission()} disabled={!name.trim() || creating}
                className="px-6 py-2 rounded text-xs mono font-bold"
                style={{ backgroundColor: 'var(--primary)', color: '#000', opacity: (!name.trim() || creating) ? 0.5 : 1 }}>
                {creating ? 'CREATING...' : 'CREATE MISSION'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded text-xs mono border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div>{Array.from({ length: 3 }).map((_, i) => <MissionSkeleton key={i} />)}</div>
      ) : error ? (
        <div className="p-8 text-center rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <p className="text-xs mono mb-3" style={{ color: '#FF4444' }}>⚠ {error}</p>
          <button onClick={() => void fetchMissions()}
            className="px-4 py-2 rounded text-xs mono border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            RETRY
          </button>
        </div>
      ) : personalMode ? (
        <div className="p-12 text-center rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="text-4xl mb-4">◉</div>
          <p className="text-sm mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>COMPLETE ONBOARDING TO CREATE MISSIONS</p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-disabled)' }}>
            Missions are scoped to organizations. Set up your org in the onboarding flow.
          </p>
          <a href="/onboarding" className="inline-block px-8 py-3 rounded text-xs mono font-bold"
            style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
            COMPLETE ONBOARDING →
          </a>
        </div>
      ) : missions.length === 0 ? (
        <div className="p-12 text-center rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="text-4xl mb-4">◉</div>
          <p className="text-sm mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>NO MISSIONS YET</p>
          <p className="text-xs mb-6" style={{ color: 'var(--text-disabled)' }}>
            Create your first mission to organize intelligence collection around a focused objective.
          </p>
          <button onClick={() => setShowForm(true)}
            className="px-8 py-3 rounded text-xs mono font-bold"
            style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
            + CREATE FIRST MISSION
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {missions.map(m => (
            <div key={m.id} className="p-4 rounded border hover:border-opacity-80 transition-colors"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold mono" style={{ color: 'var(--text-primary)' }}>{m.name}</h3>
                <span className="text-xs mono px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--primary-dim)', color: 'var(--primary)' }}>
                  {m.status?.toUpperCase() ?? 'ACTIVE'}
                </span>
              </div>
              {m.description && (
                <p className="text-xs mb-3 truncate-2" style={{ color: 'var(--text-muted)' }}>{m.description}</p>
              )}
              {m.regions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {m.regions.slice(0, 3).map(r => (
                    <span key={r} className="text-xs mono px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>
                      {r}
                    </span>
                  ))}
                  {m.regions.length > 3 && (
                    <span className="text-xs mono" style={{ color: 'var(--text-disabled)' }}>+{m.regions.length - 3}</span>
                  )}
                </div>
              )}
              <p className="text-xs mono" style={{ color: 'var(--text-disabled)' }}>
                Created {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
