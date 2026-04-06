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
  visibility?: 'private' | 'org' | 'shared'
}

type MissionsResponse = {
  success: boolean
  data?: Mission[]
  meta?: { personal_mode?: boolean }
  error?: string
}

function MissionSkeleton() {
  return (
    <div className="p-4 rounded border border-white/[0.05] bg-white/[0.015] mb-3">
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
  const [visibility, setVisibility] = useState<'private' | 'org' | 'shared'>('org')
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
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, regions: selectedRegions, visibility }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (json.success) {
        setName(''); setDescription(''); setSelectedRegions([]); setVisibility('org'); setShowForm(false)
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
          <h1 className="text-xl font-bold tracking-widest uppercase mono text-white">
            MISSIONS
          </h1>
          <p className="text-xs mt-1 mono text-white/30">
            Focused intelligence collection campaigns. Group events, alerts, and forecasts by objective.
          </p>
        </div>
        {!personalMode && (
          <button onClick={() => setShowForm(s => !s)}
            className="px-4 py-2 rounded text-xs mono font-bold bg-blue-400 text-black">
            + NEW MISSION
          </button>
        )}
      </div>

      {/* New mission form */}
      {showForm && (
        <div className="mb-6 p-5 rounded border border-blue-400 bg-blue-500/10">
          <h3 className="text-xs mono font-bold mb-4 text-blue-400">CREATE MISSION</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs mono mb-1 block text-white/30">NAME *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Ukraine Conflict Monitoring"
                className="w-full px-3 py-2 rounded border border-white/[0.05] bg-[#070B11] text-sm mono text-white" />
            </div>
            <div>
              <label className="text-xs mono mb-1 block text-white/30">DESCRIPTION</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={2} placeholder="Optional context..."
                className="w-full px-3 py-2 rounded border border-white/[0.05] bg-[#070B11] text-sm text-white"
                style={{ resize: 'none' }} />
            </div>
            <div>
              <label className="text-xs mono mb-2 block text-white/30">VISIBILITY</label>
              <div className="flex gap-2">
                {(['private', 'org', 'shared'] as const).map((option) => (
                  <button key={option} onClick={() => setVisibility(option)}
                    className="px-2 py-1 rounded text-xs mono border"
                    style={{
                      borderColor: visibility === option ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                      color: visibility === option ? '#3b82f6' : 'text-white/30',
                      backgroundColor: visibility === option ? 'rgba(59,130,246,0.1)' : 'transparent',
                    }}>
                    {option.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs mono mb-2 block text-white/30">REGIONS</label>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map(r => (
                  <button key={r} onClick={() => setSelectedRegions(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r])}
                    className="px-2 py-1 rounded text-xs mono border"
                    style={{
                      borderColor: selectedRegions.includes(r) ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                      color: selectedRegions.includes(r) ? '#3b82f6' : 'text-white/30',
                      backgroundColor: selectedRegions.includes(r) ? 'rgba(59,130,246,0.1)' : 'transparent',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {createError && <p className="text-xs mono text-red-400">⚠ {createError}</p>}
            <div className="flex gap-2">
              <button onClick={() => void createMission()} disabled={!name.trim() || creating}
                className="px-6 py-2 rounded text-xs mono font-bold bg-blue-400 text-black"
                style={{ opacity: (!name.trim() || creating) ? 0.5 : 1 }}>
                {creating ? 'CREATING...' : 'CREATE MISSION'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded text-xs mono border border-white/[0.05] text-white/30">
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
        <div className="p-8 text-center rounded border border-white/[0.05] bg-white/[0.015]">
          <p className="text-xs mono mb-3 text-red-400">⚠ {error}</p>
          <button onClick={() => void fetchMissions()}
            className="px-4 py-2 rounded text-xs mono border border-white/[0.05] text-white/30">
            RETRY
          </button>
        </div>
      ) : personalMode ? (
        <div className="p-12 text-center rounded border border-white/[0.05] bg-white/[0.015]">
          <div className="text-4xl mb-4">◉</div>
          <p className="text-sm mono font-bold mb-2 text-white/30">COMPLETE ONBOARDING TO CREATE MISSIONS</p>
          <p className="text-xs mb-6 text-white/25">
            Missions are scoped to organizations. Set up your org in the onboarding flow.
          </p>
          <a href="/onboarding" className="inline-block px-8 py-3 rounded text-xs mono font-bold bg-blue-400 text-black">
            COMPLETE ONBOARDING →
          </a>
        </div>
      ) : missions.length === 0 ? (
        <div className="p-12 text-center rounded border border-white/[0.05] bg-white/[0.015]">
          <div className="text-4xl mb-4">◉</div>
          <p className="text-sm mono font-bold mb-2 text-white/30">NO MISSIONS YET</p>
          <p className="text-xs mb-6 text-white/25">
            Create your first mission to organize intelligence collection around a focused objective.
          </p>
          <button onClick={() => setShowForm(true)}
            className="px-8 py-3 rounded text-xs mono font-bold bg-blue-400 text-black">
            + CREATE FIRST MISSION
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {missions.map(m => (
            <div key={m.id} className="p-4 rounded border border-white/[0.05] bg-white/[0.015] hover:border-opacity-80 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold mono text-white">{m.name}</h3>
                <span className="text-xs mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  {m.visibility?.toUpperCase() ?? m.status?.toUpperCase() ?? 'ACTIVE'}
                </span>
              </div>
              {m.description && (
                <p className="text-xs mb-3 truncate-2 text-white/30">{m.description}</p>
              )}
              {m.regions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {m.regions.slice(0, 3).map(r => (
                    <span key={r} className="text-xs mono px-1.5 py-0.5 rounded bg-white/[0.03] text-white/30">
                      {r}
                    </span>
                  ))}
                  {m.regions.length > 3 && (
                    <span className="text-xs mono text-white/25">+{m.regions.length - 3}</span>
                  )}
                </div>
              )}
              <p className="text-xs mono text-white/25">
                Created {new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
