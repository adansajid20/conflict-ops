'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bell, Pencil, Plus, Save, Trash2 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// Types matching actual user_alerts table in Supabase
// Columns: id, user_id, name, watchlist_id, regions[], severities[],
//   keywords[], actor_ids[], include_flights, include_vessels,
//   frequency, delivery_email, delivery_webhook, active,
//   last_triggered_at, trigger_count, created_at
// ═══════════════════════════════════════════════════════════════
type UserAlert = {
  id: string
  user_id: string
  name: string
  regions?: string[] | null
  severities?: string[] | null
  keywords?: string[] | null
  frequency?: string | null
  delivery_email?: string | null
  delivery_webhook?: string | null
  active: boolean
  last_triggered_at?: string | null
  trigger_count?: number
  created_at: string
}

type FormState = {
  name: string
  delivery_email: string
  severities: string[]
  regions: string[]
  keywords: string
  frequency: string
}

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

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
  name: '',
  delivery_email: '',
  severities: [],
  regions: [],
  keywords: '',
  frequency: 'instant',
}

function formatTime(input?: string | null) {
  if (!input) return 'Never'
  return new Date(input).toLocaleString()
}

/** Build POST/PATCH payload matching actual user_alerts columns */
function buildPayload(form: FormState) {
  const keywords = form.keywords.split(',').map((s) => s.trim()).filter(Boolean)
  const payload: Record<string, unknown> = {
    name: form.name.trim() || 'My Alert',
    frequency: form.frequency,
  }
  if (form.regions.length) payload.regions = form.regions
  if (form.severities.length) payload.severities = form.severities
  if (keywords.length) payload.keywords = keywords
  if (form.delivery_email.trim()) payload.delivery_email = form.delivery_email.trim()
  return payload
}

/** Populate form from an existing alert row */
function formFromAlert(alert: UserAlert): FormState {
  return {
    name: alert.name ?? '',
    delivery_email: alert.delivery_email ?? '',
    severities: alert.severities ?? [],
    regions: alert.regions ?? [],
    keywords: (alert.keywords ?? []).join(', '),
    frequency: alert.frequency ?? 'instant',
  }
}

export function AlertsManager() {
  const BellIcon = Bell as any
  const PencilIcon = Pencil as any
  const Trash2Icon = Trash2 as any
  const SaveIcon = Save as any
  const PlusIcon = Plus as any

  const [alerts, setAlerts] = useState<UserAlert[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // ── Load user alert rules ──
  async function loadAlerts() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/alerts?type=rules', { cache: 'no-store' })
      const json = await res.json() as { data?: UserAlert[]; error?: string }
      if (!res.ok) {
        setMessage(json.error ?? 'Failed to load')
        setAlerts([])
      } else {
        setAlerts(json.data ?? [])
        setMessage(null)
      }
    } catch {
      setMessage('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadAlerts() }, [])

  const activeCount = useMemo(() => alerts.filter((a) => a.active !== false).length, [alerts])

  // ── Create or update ──
  async function submitForm() {
    if (!form.name.trim()) {
      setMessage('Alert name is required')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const payload = buildPayload(form)
      const url = editingId ? `/api/v1/alerts/${editingId}` : '/api/v1/alerts'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json() as { data?: UserAlert; error?: string }
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

  // ── Toggle active/inactive ──
  async function toggleAlert(alert: UserAlert) {
    const res = await fetch(`/api/v1/alerts/${alert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !alert.active }),
    })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      setMessage(json.error ?? 'Toggle failed')
      return
    }
    await loadAlerts()
  }

  // ── Delete ──
  async function deleteAlert(id: string) {
    const res = await fetch(`/api/v1/alerts/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json() as { error?: string }
      setMessage(json.error ?? 'Delete failed')
      return
    }
    if (editingId === id) { setEditingId(null); setForm(EMPTY_FORM) }
    await loadAlerts()
    setMessage('Alert deleted')
  }

  function startEdit(alert: UserAlert) {
    setEditingId(alert.id)
    setForm(formFromAlert(alert))
    setMessage(null)
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setMessage(null)
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Creation / edit form ── */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-4 hover:bg-white/[0.03]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BellIcon size={16} /> Alert Rules
            </div>
            <p className="mt-1 text-sm text-white/80">
              {activeCount} active rule{activeCount === 1 ? '' : 's'} watching the board for matching events.
            </p>
          </div>
          {editingId ? (
            <button onClick={resetForm} className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.08]">
              Cancel edit
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            placeholder="Alert name *"
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20"
          />
          <input
            value={form.delivery_email}
            onChange={(e) => setForm((c) => ({ ...c, delivery_email: e.target.value }))}
            placeholder="Email (optional)"
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20"
          />
          <select
            value={form.frequency}
            onChange={(e) => setForm((c) => ({ ...c, frequency: e.target.value }))}
            className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white"
          >
            <option value="instant">Instant</option>
            <option value="hourly">Hourly digest</option>
            <option value="daily">Daily digest</option>
          </select>
        </div>

        {/* Severity filter */}
        <div className="mt-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">Severity</div>
          <div className="flex flex-wrap gap-2">
            {SEVERITY_OPTIONS.map((sev) => {
              const selected = form.severities.includes(sev.value)
              return (
                <button
                  key={sev.value}
                  type="button"
                  onClick={() => setForm((c) => ({
                    ...c,
                    severities: selected
                      ? c.severities.filter((s) => s !== sev.value)
                      : [...c.severities, sev.value],
                  }))}
                  className={`rounded-full border px-3 py-1.5 text-xs ${selected
                    ? sev.value === 'critical' ? 'border-red-400 bg-red-500/20 text-red-400'
                      : sev.value === 'high' ? 'border-orange-400 bg-orange-500/20 text-orange-400'
                        : sev.value === 'medium' ? 'border-yellow-400 bg-yellow-500/20 text-yellow-400'
                          : 'border-blue-400 bg-blue-500/20 text-blue-400'
                    : 'border-white/[0.08] bg-white/[0.05] text-white/60 hover:bg-white/[0.08]'
                  }`}
                >
                  {sev.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Regions */}
        <div className="mt-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.15em] text-white/25">Regions</div>
          <div className="flex flex-wrap gap-2">
            {REGION_OPTIONS.map((region) => {
              const selected = form.regions.includes(region.value)
              return (
                <button
                  key={region.value}
                  type="button"
                  onClick={() => setForm((c) => ({
                    ...c,
                    regions: selected
                      ? c.regions.filter((r) => r !== region.value)
                      : [...c.regions, region.value],
                  }))}
                  className={`rounded-full border px-3 py-1.5 text-xs ${selected ? 'border-blue-400 bg-blue-500/20 text-blue-400' : 'border-white/[0.08] bg-white/[0.05] text-white/60 hover:bg-white/[0.08]'}`}
                >
                  {region.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Keywords */}
        <div className="mt-3">
          <textarea
            value={form.keywords}
            onChange={(e) => setForm((c) => ({ ...c, keywords: e.target.value }))}
            placeholder="Keywords, comma separated. Example: iran, drone, ceasefire"
            rows={3}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20"
          />
        </div>

        {/* Submit */}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void submitForm()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {editingId ? <SaveIcon size={14} /> : <PlusIcon size={14} />}
            {saving ? 'Saving…' : editingId ? 'Update alert' : 'Create alert'}
          </button>
          {message ? (
            <span className={`text-sm ${message.includes('fail') || message.includes('required') || message.includes('error') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Existing alerts list ── */}
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03]">
        <div className="border-b border-white/[0.05] px-4 py-3 text-sm font-semibold text-white">
          Existing alert rules
        </div>
        <div className="divide-y divide-white/[0.05]">
          {loading ? (
            <div className="px-4 py-6 text-sm text-white/80">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/80">No alert rules yet. Create one above and let the system watch for matching events.</div>
          ) : alerts.map((alert) => (
            <div key={alert.id} className="px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white">{alert.name || 'My Alert'}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${alert.active ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.05] text-white/40'}`}>
                      {alert.active ? 'Active' : 'Paused'}
                    </span>
                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/50">
                      {alert.frequency ?? 'instant'}
                    </span>
                  </div>
                  {alert.delivery_email && (
                    <div className="mt-1 text-sm text-white/60">{alert.delivery_email}</div>
                  )}
                  <div className="mt-2 text-xs text-white/50">
                    Severity: {alert.severities?.length ? alert.severities.join(', ') : 'Any'}
                    {' · '}
                    Regions: {alert.regions?.length ? alert.regions.join(', ') : 'Any'}
                    {' · '}
                    Keywords: {alert.keywords?.length ? alert.keywords.join(', ') : 'None'}
                  </div>
                  <div className="mt-2 text-xs text-white/50">
                    Triggered {alert.trigger_count ?? 0}× · Last: {formatTime(alert.last_triggered_at)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => void toggleAlert(alert)} className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-xs font-medium text-white hover:bg-white/[0.08]">
                    {alert.active ? 'Turn off' : 'Turn on'}
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
