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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: queue */}
      <div>
        {/* Submit new */}
        <div className="rounded border p-4 mb-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>SUBMIT FOR VERIFICATION</div>
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="Source URL (tweet, telegram post, video...)"
            className="w-full px-3 py-2 text-xs mono rounded border mb-2"
            style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <input value={newLocation} onChange={e => setNewLocation(e.target.value)}
            placeholder="Claimed location (optional)"
            className="w-full px-3 py-2 text-xs mono rounded border mb-2"
            style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <button onClick={() => void submit()} disabled={submitting || !newUrl}
            className="w-full py-2 text-xs mono rounded font-bold"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
            {submitting ? 'SUBMITTING...' : 'SUBMIT'}
          </button>
        </div>

        {/* Queue list */}
        {loading ? (
          <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>LOADING QUEUE...</p>
        ) : items.length === 0 ? (
          <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>QUEUE EMPTY — SUBMIT A SOURCE URL TO BEGIN</p>
        ) : items.map(item => (
          <div
            key={item.id}
            onClick={() => setSelected(item)}
            className="p-3 rounded border mb-2 cursor-pointer"
            style={{
              borderColor: selected?.id === item.id ? 'var(--primary)' : 'var(--border)',
              backgroundColor: 'var(--bg-surface)',
              borderLeftWidth: 3,
              borderLeftColor: TIER_COLORS[item.tier as GeoVerificationTier],
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs mono font-bold" style={{ color: TIER_COLORS[item.tier as GeoVerificationTier] }}>
                {TIER_LABELS[item.tier as GeoVerificationTier]}
              </span>
              <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{item.confidence_score}% confidence</span>
            </div>
            <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{item.source_url}</div>
            {item.claimed_location && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>↦ {item.claimed_location}</div>
            )}
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {(item.checks as unknown[]).length} checks · {new Date(item.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>

      {/* Right: verification panel */}
      <div>
        {!selected ? (
          <div className="rounded border p-8 text-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>SELECT AN ITEM TO BEGIN VERIFICATION</p>
          </div>
        ) : (
          <div className="rounded border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold mono" style={{ color: TIER_COLORS[selected.tier as GeoVerificationTier] }}>
                {TIER_LABELS[selected.tier as GeoVerificationTier]}
              </span>
              <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{selected.confidence_score}/100</span>
            </div>

            <div className="text-xs mb-3 break-all" style={{ color: 'var(--text-muted)' }}>
              <a href={selected.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{selected.source_url}</a>
            </div>

            {/* Existing checks */}
            {(selected.checks as Array<{ method: string; result: string; notes: string; timestamp: string }>).map((c, i) => (
              <div key={i} className="p-2 rounded border mb-2 text-xs mono" style={{
                borderColor: 'var(--border)',
                borderLeftWidth: 3,
                borderLeftColor: c.result === 'pass' ? '#10B981' : c.result === 'fail' ? '#EF4444' : '#F59E0B',
              }}>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-primary)' }}>{c.method}</span>
                  <span style={{ color: c.result === 'pass' ? '#10B981' : c.result === 'fail' ? '#EF4444' : '#F59E0B' }}>
                    {c.result.toUpperCase()}
                  </span>
                </div>
                {c.notes && <div style={{ color: 'var(--text-muted)' }} className="mt-1">{c.notes}</div>}
              </div>
            ))}

            {/* Add check */}
            <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>ADD VERIFICATION CHECK</div>
              <select value={checkMethod} onChange={e => setCheckMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs mono rounded border mb-2"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                {VERIFICATION_METHODS.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}
              </select>
              <select value={checkResult} onChange={e => setCheckResult(e.target.value as 'pass' | 'fail' | 'inconclusive')}
                className="w-full px-3 py-2 text-xs mono rounded border mb-2"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value="pass">PASS</option>
                <option value="fail">FAIL</option>
                <option value="inconclusive">INCONCLUSIVE</option>
              </select>
              <textarea value={checkNotes} onChange={e => setCheckNotes(e.target.value)}
                placeholder="Analyst notes..."
                rows={3}
                className="w-full px-3 py-2 text-xs mono rounded border mb-2 resize-none"
                style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <button onClick={() => void addCheck()} disabled={addingCheck}
                className="w-full py-2 text-xs mono rounded font-bold"
                style={{ backgroundColor: 'var(--primary)', color: '#fff' }}>
                {addingCheck ? 'SAVING...' : 'ADD CHECK'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
