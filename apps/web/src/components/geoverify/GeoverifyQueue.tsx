'use client'

import { useEffect, useState, useCallback } from 'react'
import { TIER_COLORS, TIER_LABELS, VERIFICATION_METHODS, type GeoVerification, type GeoVerificationTier } from '@/lib/geoverify/engine'

export function GeoverifyQueue() {
  const [items, setItems] = useState<GeoVerification[]>([])
  const [loading, setLoading] = useState(true)
  const [newUrl, setNewUrl] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<GeoVerification | null>(null)
  const [checkMethod, setCheckMethod] = useState<string>(VERIFICATION_METHODS[0].label)
  const [checkResult, setCheckResult] = useState<'pass' | 'fail' | 'inconclusive'>('pass')
  const [checkNotes, setCheckNotes] = useState('')
  const [addingCheck, setAddingCheck] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/geoverify')
      const json = await res.json() as { data?: GeoVerification[] }
      if (json.data) setItems(json.data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const submit = async () => {
    if (!newUrl) return
    setSubmitting(true)
    try {
      await fetch('/api/v1/geoverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: newUrl, claimed_location: newLocation || undefined }),
      })
      setNewUrl(''); setNewLocation('')
      await load()
    } finally { setSubmitting(false) }
  }

  const addCheck = async () => {
    if (!selected) return
    setAddingCheck(true)
    try {
      const res = await fetch('/api/v1/geoverify?action=add_check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_id: selected.id,
          method: checkMethod,
          result: checkResult,
          notes: checkNotes,
        }),
      })
      const json = await res.json() as { data?: GeoVerification }
      if (json.data) {
        setSelected(json.data)
        setItems(prev => prev.map(i => i.id === json.data!.id ? json.data! : i))
        setCheckNotes('')
      }
    } finally { setAddingCheck(false) }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Left: queue */}
      <div>
        {/* Submit new */}
        <div className="mb-4 rounded border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03]">
          <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">SUBMIT FOR VERIFICATION</div>
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="Source URL (tweet, telegram post, video...)"
            className="mb-2 w-full rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20" />
          <input value={newLocation} onChange={e => setNewLocation(e.target.value)}
            placeholder="Claimed location (optional)"
            className="mb-2 w-full rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20" />
          <button onClick={() => void submit()} disabled={submitting || !newUrl}
            className="w-full rounded bg-blue-500 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50">
            {submitting ? 'SUBMITTING...' : 'SUBMIT'}
          </button>
        </div>

        {/* Queue list */}
        {loading ? (
          <p className="py-8 text-center text-xs text-white/50">LOADING QUEUE...</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-xs text-white/50">QUEUE EMPTY — SUBMIT A SOURCE URL TO BEGIN</p>
        ) : items.map(item => (
          <div
            key={item.id}
            onClick={() => setSelected(item)}
            className="mb-2 cursor-pointer rounded border p-3"
            style={{
              borderColor: selected?.id === item.id ? '#3B82F6' : 'rgb(255, 255, 255, 0.05)',
              backgroundColor: 'rgb(255, 255, 255, 0.015)',
              borderLeftWidth: 3,
              borderLeftColor: TIER_COLORS[item.tier as GeoVerificationTier],
            }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: TIER_COLORS[item.tier as GeoVerificationTier] }}>
                {TIER_LABELS[item.tier as GeoVerificationTier]}
              </span>
              <span className="text-xs text-white/50">{item.confidence_score}% confidence</span>
            </div>
            <div className="truncate text-xs text-white">{item.source_url}</div>
            {item.claimed_location && (
              <div className="mt-1 text-xs text-white/50">↦ {item.claimed_location}</div>
            )}
            <div className="mt-1 text-xs text-white/50">
              {(item.checks as unknown[]).length} checks · {new Date(item.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* Right: verification panel */}
      <div>
        {!selected ? (
          <div className="rounded border border-white/[0.05] bg-white/[0.015] p-8 text-center hover:bg-white/[0.03]">
            <p className="text-xs text-white/50">SELECT AN ITEM TO BEGIN VERIFICATION</p>
          </div>
        ) : (
          <div className="rounded border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: TIER_COLORS[selected.tier as GeoVerificationTier] }}>
                {TIER_LABELS[selected.tier as GeoVerificationTier]}
              </span>
              <span className="text-xs text-white/50">{selected.confidence_score}/100</span>
            </div>

            <div className="mb-3 break-all text-xs text-white/50">
              <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{selected.source_url}</a>
            </div>

            {/* Existing checks */}
            {(selected.checks as Array<{ method: string; result: string; notes: string; timestamp: string }>).map((c, i) => (
              <div key={i} className="mb-2 rounded border border-white/[0.05] p-2 text-xs" style={{
                borderLeftWidth: 3,
                borderLeftColor: c.result === 'pass' ? '#10B981' : c.result === 'fail' ? '#EF4444' : '#F59E0B',
              }}>
                <div className="flex justify-between">
                  <span className="text-white">{c.method}</span>
                  <span style={{ color: c.result === 'pass' ? '#10B981' : c.result === 'fail' ? '#EF4444' : '#F59E0B' }}>
                    {c.result.toUpperCase()}
                  </span>
                </div>
                {c.notes && <div className="mt-1 text-white/50">{c.notes}</div>}
              </div>
            ))}

            {/* Add check */}
            <div className="mt-4 border-t border-white/[0.05] pt-4">
              <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">ADD VERIFICATION CHECK</div>
              <select value={checkMethod} onChange={e => setCheckMethod(e.target.value)}
                className="mb-2 w-full rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white">
                {VERIFICATION_METHODS.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
              </select>
              <select value={checkResult} onChange={e => setCheckResult(e.target.value as 'pass' | 'fail' | 'inconclusive')}
                className="mb-2 w-full rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white">
                <option value="pass">PASS</option>
                <option value="fail">FAIL</option>
                <option value="inconclusive">INCONCLUSIVE</option>
              </select>
              <textarea value={checkNotes} onChange={e => setCheckNotes(e.target.value)}
                placeholder="Analyst notes..."
                rows={3}
                className="mb-2 w-full resize-none rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-white placeholder:text-white/20" />
              <button onClick={() => void addCheck()} disabled={addingCheck}
                className="w-full rounded bg-blue-500 py-2 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50">
                {addingCheck ? 'SAVING...' : 'ADD CHECK'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
