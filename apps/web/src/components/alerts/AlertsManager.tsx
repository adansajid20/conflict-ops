'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Pencil, Plus, Save, Trash2 } from 'lucide-react'

type AlertConditions = {
  severity_min?: number
  regions?: string[]
  event_types?: string[]
  keywords?: string[]
}

type AlertSubscription = {
  id: string
  user_id: string
  email: string
  name: string | null
  conditions: AlertConditions
  frequency: 'realtime' | 'hourly' | 'daily'
  is_active: boolean
  last_sent_at: string | null
  created_at: string
  updated_at: string
}

type FormState = {
  email: string
  name: string
  severity_min: '' | '3' | '4'
  regions: string[]
  keywords: string
  frequency: 'realtime' | 'hourly' | 'daily'
}

const REGION_OPTIONS = [
  { value: 'middle_east', label: 'Middle East' },
  { value: 'eastern_europe', label: 'Eastern Europe' },
  { value: 'east_asia', label: 'East Asia' },
  { value: 'south_asia', label: 'South Asia' },
  { value: 'west_africa', label: 'West Africa' },
  { value: 'east_africa', label: 'East Africa' },
  { value: 'central_africa', label: 'Central Africa' },
  { value: 'north_africa', label: 'North Africa' },
  { value: 'latin_america', label: 'Latin America' },
]

const EMPTY_FORM: FormState = {
  email: '',
  name: '',
  severity_min: '',
  regions: [],
  keywords: '',
  frequency: 'realtime',
}

function formatTime(input?: string | null) {
  if (!input) return 'Never'
  return new Date(input).toLocaleString()
}

function buildPayload(form: FormState) {
  const keywords = form.keywords.split(',').map((item) => item.trim()).filter(Boolean)
  const conditions: AlertConditions = {}
  if (form.severity_min) conditions.severity_min = Number(form.severity_min)
  if (form.regions.length) conditions.regions = form.regions
  if (keywords.length) conditions.keywords = keywords

  return {
    email: form.email.trim(),
    name: form.name.trim() || 'My Alert',
    conditions,
    frequency: form.frequency,
  }
}

function formFromAlert(alert: AlertSubscription): FormState {
  return {
    email: alert.email,
    name: alert.name ?? '',
    severity_min: alert.conditions?.severity_min === 3 || alert.conditions?.severity_min === 4 ? String(alert.conditions.severity_min) as '3' | '4' : '',
    regions: alert.conditions?.regions ?? [],
    keywords: (alert.conditions?.keywords ?? []).join(', '),
    frequency: alert.frequency,
  }
}

export function AlertsManager() {
  const BellIcon = Bell as any
  const PencilIcon = Pencil as any
  const Trash2Icon = Trash2 as any
  const SaveIcon = Save as any
  const PlusIcon = Plus as any
  const [alerts, setAlerts] = useState<AlertSubscription[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function loadAlerts() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/alerts', { cache: 'no-store' })
      const json = await res.json() as { alerts?: AlertSubscription[]; note?: string; error?: string }
      setAlerts(json.alerts ?? [])
      setMessage(json.note ?? json.error ?? null)
    } catch {
      setMessage('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAlerts() }, [])

  const activeCount = useMemo(() => alerts.filter((alert) => alert.is_active).length, [alerts])

  async function submitForm() {
    setSaving(true)
    setMessage(null)
    try {
      const payload = buildPayload(form)
      const res = await fetch(editingId ? `/api/v1/alerts/${editingId}` : '/api/v1/alerts', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { alert?: AlertSubscription; error?: string }
      if (!res.ok) {
        setMessage(json.error ?? 'Save failed')
        return
      }
      setForm(EMPTY_FORM)
      setEditingId(null)
      await loadAlerts()
      setMessage(editingId ? 'Alert updated' : 'Alert created')
    } catch {
      setMessage('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAlert(alert: AlertSubscription) {
    const res = await fetch(`/api/v1/alerts/${alert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !alert.is_active }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) {
      setMessage(json.error ?? 'Toggle failed')
      return
    }
    await loadAlerts()
  }

  async function deleteAlert(id: string) {
    const res = await fetch(`/api/v1/alerts/${id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }
    if (!res.ok) {
      setMessage(json.error ?? 'Delete failed')
      return
    }
    if (editingId === id) {
      setEditingId(null)
      setForm(EMPTY_FORM)
    }
    await loadAlerts()
    setMessage('Alert deleted')
  }

  function startEdit(alert: AlertSubscription) {
    setEditingId(alert.id)
    setForm(formFromAlert(alert))
    setMessage(null)
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setMessage(null)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              <BellIcon size={16} /> Email Alerts
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {activeCount} active alert{activeCount === 1 ? '' : 's'} watching the board for matching events.
            </p>
          </div>
          {editingId ? (
            <button onClick={resetForm} className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder="Alert name" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} />
          <input value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} placeholder="operator@company.com" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} />
          <select value={form.severity_min} onChange={(e) => setForm((current) => ({ ...current, severity_min: e.target.value as FormState['severity_min'] }))} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
            <option value="">Any severity</option>
            <option value="3">High+</option>
            <option value="4">Critical only</option>
          </select>
          <select value={form.frequency} onChange={(e) => setForm((current) => ({ ...current, frequency: e.target.value as FormState['frequency'] }))} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }}>
            <option value="realtime">Real-time</option>
            <option value="hourly">Hourly digest</option>
            <option value="daily">Daily digest</option>
          </select>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-xs uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Regions</div>
          <div className="flex flex-wrap gap-2">
            {REGION_OPTIONS.map((region) => {
              const selected = form.regions.includes(region.value)
              return (
                <button
                  key={region.value}
                  type="button"
                  onClick={() => setForm((current) => ({
                    ...current,
                    regions: selected ? current.regions.filter((item) => item !== region.value) : [...current.regions, region.value],
                  }))}
                  className="rounded-full border px-3 py-1.5 text-xs"
                  style={{
                    borderColor: selected ? 'var(--primary)' : 'var(--border)',
                    background: selected ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--bg-surface-2)',
                    color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {region.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3">
          <textarea value={form.keywords} onChange={(e) => setForm((current) => ({ ...current, keywords: e.target.value }))} placeholder="Keywords, comma separated. Example: iran, drone, ceasefire" rows={3} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => void submitForm()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium" style={{ background: 'var(--primary)', color: '#fff', opacity: saving ? 0.7 : 1 }}>
            {editingId ? <SaveIcon size={14} /> : <PlusIcon size={14} />}
            {saving ? 'Saving…' : editingId ? 'Update alert' : 'Create alert'}
          </button>
          {message ? <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{message}</span> : null}
        </div>
      </div>

      <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Existing alerts
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {loading ? (
            <div className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>Loading alerts…</div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No alerts yet. Set one up and let the machine nag you only when it matters.</div>
          ) : alerts.map((alert) => (
            <div key={alert.id} className="px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{alert.name || 'My Alert'}</div>
                    <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: alert.is_active ? 'var(--sev-low-dim)' : 'var(--bg-surface-2)', color: alert.is_active ? 'var(--sev-low)' : 'var(--text-muted)' }}>
                      {alert.is_active ? 'Active' : 'Paused'}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-muted)' }}>
                      {alert.frequency}
                    </span>
                  </div>
                  <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{alert.email}</div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Severity: {alert.conditions?.severity_min === 4 ? 'Critical only' : alert.conditions?.severity_min === 3 ? 'High+' : 'Any'}
                    {' · '}
                    Regions: {alert.conditions?.regions?.length ? alert.conditions.regions.join(', ') : 'Any'}
                    {' · '}
                    Keywords: {alert.conditions?.keywords?.length ? alert.conditions.keywords.join(', ') : 'None'}
                  </div>
                  <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Last sent: {formatTime(alert.last_sent_at)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => void toggleAlert(alert)} className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {alert.is_active ? 'Turn off' : 'Turn on'}
                  </button>
                  <button onClick={() => startEdit(alert)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <PencilIcon size={13} /> Edit
                  </button>
                  <button onClick={() => void deleteAlert(alert.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium" style={{ borderColor: 'rgba(239,68,68,0.35)', color: 'var(--sev-critical)' }}>
                    <Trash2Icon size={13} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
