'use client'

import { useState } from 'react'

type ConditionType = 'country' | 'event_type' | 'severity_gte' | 'keyword' | 'actor'

type Condition = {
  id: string
  type: ConditionType
  value: string
}

const CONDITION_LABELS: Record<ConditionType, string> = {
  country:      'Country (ISO code)',
  event_type:   'Event Type',
  severity_gte: 'Severity ≥',
  keyword:      'Keyword in Title/Desc',
  actor:        'Actor Name',
}

const EVENT_TYPES = ['conflict', 'political', 'economic', 'humanitarian', 'natural_disaster', 'cyber', 'other', 'news']
const PRIORITIES = [{ value: 1, label: 'P1 — CRITICAL' }, { value: 2, label: 'P2 — HIGH' }, { value: 3, label: 'P3 — ROUTINE' }]

export function PIRBuilder({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(2)
  const [conditions, setConditions] = useState<Condition[]>([
    { id: '1', type: 'country', value: '' },
  ])
  const [channels, setChannels] = useState<string[]>(['in_app'])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addCondition = () => {
    setConditions(prev => [...prev, { id: String(Date.now()), type: 'keyword', value: '' }])
  }

  const updateCondition = (id: string, field: 'type' | 'value', val: string) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, [field]: val } : c))
  }

  const removeCondition = (id: string) => {
    setConditions(prev => prev.filter(c => c.id !== id))
  }

  const toggleChannel = (ch: string) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch])
  }

  const submit = async () => {
    if (!name.trim()) { setError('Name required'); return }
    const validConditions = conditions.filter(c => c.value.trim())
    if (validConditions.length === 0) { setError('At least one condition required'); return }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/v1/pir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          priority,
          conditions: validConditions.map(c => ({
            type: c.type,
            value: c.type === 'severity_gte' ? parseInt(c.value) : c.value,
          })),
          alert_channels: channels,
        }),
      })

      const json = await res.json() as { success: boolean; error?: string }
      if (!json.success) { setError(json.error ?? 'Failed'); return }

      setName('')
      setDescription('')
      setConditions([{ id: '1', type: 'country', value: '' }])
      onCreated?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded border p-5" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="text-xs mono tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
        CREATE PRIORITY INTELLIGENCE REQUIREMENT (PIR)
      </div>

      {error && (
        <div className="mb-3 p-2 rounded text-xs mono" style={{ backgroundColor: 'var(--alert-red-10)', color: 'var(--alert-red)', border: '1px solid var(--alert-red)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Name */}
      <div className="mb-3">
        <label className="block text-xs mono mb-1" style={{ color: 'var(--text-muted)' }}>PIR NAME</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Escalation in Red Sea shipping lanes"
          className="w-full px-3 py-2 rounded text-xs mono border bg-transparent"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
      </div>

      {/* Priority */}
      <div className="mb-4">
        <label className="block text-xs mono mb-1" style={{ color: 'var(--text-muted)' }}>PRIORITY</label>
        <div className="flex gap-2">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              onClick={() => setPriority(p.value)}
              className="px-3 py-1 rounded text-xs mono border transition-colors"
              style={{
                borderColor: priority === p.value ? 'var(--primary)' : 'var(--border)',
                color: priority === p.value ? 'var(--primary)' : 'var(--text-muted)',
                backgroundColor: priority === p.value ? 'var(--primary-10)' : 'transparent',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs mono" style={{ color: 'var(--text-muted)' }}>CONDITIONS (ALL must match)</label>
          <button onClick={addCondition} className="text-xs mono" style={{ color: 'var(--primary)' }}>+ ADD</button>
        </div>

        {conditions.map(condition => (
          <div key={condition.id} className="flex gap-2 mb-2">
            <select
              value={condition.type}
              onChange={e => updateCondition(condition.id, 'type', e.target.value)}
              className="px-2 py-1 rounded text-xs mono border bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', outline: 'none' }}
            >
              {(Object.keys(CONDITION_LABELS) as ConditionType[]).map(t => (
                <option key={t} value={t}>{CONDITION_LABELS[t]}</option>
              ))}
            </select>

            {condition.type === 'event_type' ? (
              <select
                value={condition.value}
                onChange={e => updateCondition(condition.id, 'value', e.target.value)}
                className="flex-1 px-2 py-1 rounded text-xs mono border bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="">Select type...</option>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : condition.type === 'severity_gte' ? (
              <select
                value={condition.value}
                onChange={e => updateCondition(condition.id, 'value', e.target.value)}
                className="flex-1 px-2 py-1 rounded text-xs mono border bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              >
                {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} ({['LOW','MEDIUM','ELEVATED','HIGH','CRITICAL'][n-1]})</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={condition.value}
                onChange={e => updateCondition(condition.id, 'value', e.target.value)}
                placeholder={condition.type === 'country' ? 'e.g. YE, UA, SD' : 'value...'}
                className="flex-1 px-2 py-1 rounded text-xs mono border bg-transparent"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', outline: 'none' }}
              />
            )}

            {conditions.length > 1 && (
              <button onClick={() => removeCondition(condition.id)} className="text-xs mono px-2" style={{ color: 'var(--alert-red)' }}>×</button>
            )}
          </div>
        ))}
      </div>

      {/* Alert channels */}
      <div className="mb-5">
        <label className="block text-xs mono mb-2" style={{ color: 'var(--text-muted)' }}>ALERT CHANNELS</label>
        <div className="flex gap-2">
          {['in_app', 'email', 'webhook'].map(ch => (
            <button
              key={ch}
              onClick={() => toggleChannel(ch)}
              className="px-3 py-1 rounded text-xs mono border transition-colors"
              style={{
                borderColor: channels.includes(ch) ? 'var(--accent-blue)' : 'var(--border)',
                color: channels.includes(ch) ? 'var(--accent-blue)' : 'var(--text-muted)',
              }}
            >
              {ch.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={loading}
        className="w-full py-2 rounded text-xs mono font-bold tracking-wider border transition-colors hover:bg-white/5 disabled:opacity-50"
        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
      >
        {loading ? 'CREATING...' : 'CREATE PIR'}
      </button>
    </div>
  )
}
