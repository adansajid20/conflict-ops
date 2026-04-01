'use client'

import { useState } from 'react'

const OPTIONS = [30, 90, 180, 365, 730] as const

export function RetentionPolicyEditor({ initialDays = 365 }: { initialDays?: number }) {
  const initialIndex = Math.max(0, OPTIONS.indexOf((OPTIONS.find((value) => value === initialDays) ?? 365) as typeof OPTIONS[number]))
  const [index, setIndex] = useState(initialIndex)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const value = OPTIONS[index] ?? 365
  const estimate = value <= 90 ? 'Low storage footprint' : value <= 365 ? 'Balanced retention window' : 'Higher storage usage for long-term investigations'

  const save = async () => {
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/v1/enterprise/retention', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data_retention_days: value }) })
    const json = await res.json() as { success: boolean; error?: string }
    setMessage(json.success ? 'Retention policy updated.' : (json.error ?? 'Failed to update retention policy.'))
    setSaving(false)
  }

  return (
    <div className="p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>DATA RETENTION</div>
      <input type="range" min={0} max={OPTIONS.length - 1} value={index} onChange={(event) => setIndex(Number(event.target.value))} className="w-full" />
      <div className="mt-3 text-sm font-bold mono" style={{ color: 'var(--text-primary)' }}>{value} DAYS</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{estimate}</div>
      <div className="mt-3 flex gap-2 text-xs mono">
        {OPTIONS.map((option, optionIndex) => <span key={option} style={{ color: optionIndex === index ? 'var(--primary)' : 'var(--text-muted)' }}>{option}</span>)}
      </div>
      <button onClick={() => void save()} disabled={saving} className="mt-4 px-4 py-2 rounded text-xs mono font-bold" style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
        {saving ? 'SAVING...' : 'SAVE POLICY'}
      </button>
      {message ? <div className="mt-2 text-xs mono" style={{ color: 'var(--text-muted)' }}>{message}</div> : null}
    </div>
  )
}
