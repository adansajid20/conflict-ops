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
  name: string | null
  alert_type: string
  config: AlertConditions
  channels?: string[]
  cooldown_minutes?: number
  active: boolean
  last_triggered?: string | null
  trigger_count?: number
  created_at: string
  // Legacy fields for backward compat
  email?: string
  conditions?: AlertConditions
  frequency?: 'realtime' | 'hourly' | 'daily'
  is_active?: boolean
  last_sent_at?: string | null
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
  const config: Record<string, unknown> = {}
  if (form.severity_min) config.min_severity = Number(form.severity_min)
  if (form.regions.length) config.regions = form.regions
  if (keywords.length) config.keywords = keywords

  // Determine alert_type from what the user filled in
  let alert_type = 'custom'
  if (config.regions && !config.keywords && !config.min_severity) alert_type = 'region'
  else if (config.min_severity && !config.regions && !config.keywords) alert_type = 'severity'
  else if (config.keywords && !config.regions && !config.min_severity) alert_type = 'keyword'

  return {
    name: form.name.trim() || 'My Alert',
    alert_type,
    config,
    channels: form.email.trim() ? ['email', 'in_app'] : ['in_app'],
    cooldown_minutes: form.frequency === 'realtime' ? 5 : form.frequency === 'hourly' ? 60 : 1440,
  }
}

function formFromAlert(alert: AlertSubscription): FormState {
  const cfg = alert.config ?? alert.conditions ?? {}
  const minSev = (cfg as Record<string, unknown>).min_severity ?? cfg.severity_min
  const cooldown = alert.cooldown_minutes ?? 5
  const freq = alert.frequency ?? (cooldown <= 10 ? 'realtime' : cooldown <= 120 ? 'hourly' : 'daily')
  const emailChannel = (alert.channels ?? []).includes('email')
  return {
    email: alert.email ?? (emailChannel ? 'alert@' : ''),
    name: alert.name ?? '',
    severity_min: minSev === 3 || minSev === 4 ? String(minSev) as '3' | '4' : '',
    regions: cfg.regions ?? [],
    keywords: (cfg.keywords ?? []).join(', '),
    frequency: freq as FormState['frequency'],
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
      const res = await fetch('/api/v1/alerts?type=rules', { cache: 'no-store' })
      const json = await res.json() as { data?: AlertSubscription[]; alerts?: AlertSubscription[]; note?: string; error?: string }
      setAlerts(json.data ?? json.alerts ?? [])
      setMessage(json.note ?? json.error ?? null)
    } catch {
      setMessage('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAlerts() }, [])

  const activeCount = useMemo(() => alerts.filter((alert) => alert.active !== false && alert.is_active !== false).length, [alerts])

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
      body: JSON.stringify({ active: !(alert.active !== false) }),
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
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BellIcon size={16} /> Email Alerts
            </div>
            <p className="mt-1 text-sm text-white/80">
              {activeCount} active alert{activeCount === 1 ? '' : 's'} watching the board for matching events.
            </p>
          </div>
          {editingId ? (
            <button onClick={resetForm} className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.08]">
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder="Alert name" className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
          <input value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} placeholder="operator@company.com" className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
          <select value={form.severity_min} onChange={(e) => setForm((current) => ({ ...current, severity_min: e.target.value as FormState['severity_min'] }))} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white">
            <option value="">Any severity</option>
            <option value="3">High+</option>
            <option value="4">Critical only</option>
          </select>
          <select value={form.frequency} onChange={(e) => setForm((current) => ({ ...current, frequency: e.target.value as FormState['frequency'] }))} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white">
            <option value="realtime">Real-time</option>
            <option value="hourly">Hourly digest</option>
            <option value="daily">Daily digest</option>
          </select>
        </div>

        <div className="mt-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">Regions</div>
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
                  className={`rounded-full border px-3 py-1.5 text-xs ${selected ? 'border-blue-400 bg-blue-500/20 text-blue-400' : 'border-white/[0.08] bg-white/[0.05] text-white/60 hover:bg-white/[0.08]'}`}
                >
                  {region.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3">
          <textarea value={form.keywords} onChange={(e) => setForm((current) => ({ ...current, keywords: e.target.value }))} placeholder="Keywords, comma separated. Example: iran, drone, ceasefire" rows={3} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => void submitForm()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50">
            {editingId ? <SaveIcon size={14} /> : <PlusIcon size={14} />}
            {saving ? 'Saving…' : editingId ? 'Update alert' : 'Create alert'}
          </button>
          {message ? <span className="text-sm text-white/80">{message}</span> : null}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03]">
        <div className="border-b border-white/[0.05] px-4 py-3 text-sm font-semibold text-white">
          Existing alerts
        </div>
        <div className="divide-y divide-white/[0.05]">
          {loading ? (
            <div className="px-4 py-6 text-sm text-white/80">Loading alerts…</div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/80">No alerts yet. Set one up and let the machine nag you only when it matters.</div>
          ) : alerts.map((alert) => (
            <div key={alert.id} className="px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white">{alert.name || 'My Alert'}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${alert.active !== false ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.05] text-white/40'}`}>
                      {alert.active !== false ? 'Active' : 'Paused'}
                    </span>
                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/50">
                      {alert.alert_type ?? alert.frequency ?? 'custom'}
                    </span>
                  </div>
                  {alert.channels?.includes('email') && alert.email && (
                    <div className="mt-1 text-sm text-white/80">{alert.email}</div>
                  )}
                  <div className="mt-2 text-xs text-white/50">
                    {(() => {
                      const cfg = alert.config ?? alert.conditions ?? {}
                      const minSev = (cfg as Record<string, unknown>).min_severity ?? cfg.severity_min
                      return <>
                        Severity: {minSev === 4 ? 'Critical only' : minSev === 3 ? 'High+' : 'Any'}
                        {' · '}
                        Regions: {cfg.regions?.length ? cfg.regions.join(', ') : 'Any'}
                        {' · '}
                        Keywords: {cfg.keywords?.length ? cfg.keywords.join(', ') : 'None'}
                      </>
                    })()}
                  </div>
                  <div className="mt-2 text-xs text-white/50">
                    Triggered {alert.trigger_count ?? 0}× · Last: {formatTime(alert.last_triggered ?? alert.last_sent_at)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => void toggleAlert(alert)} className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.08]">
                    {alert.active !== false ? 'Turn off' : 'Turn on'}
                  </button>
                  <button onClick={() => startEdit(alert)} className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.08]">
                    <PencilIcon size={13} /> Edit
                  </button>
                  <button onClick={() => void deleteAlert(alert.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20">
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
