'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Bell, ChevronDown, ChevronRight, Code2,
  Eye, Layers, Pencil, Plus, Save, Shield, Sliders,
  ToggleLeft, ToggleRight, Trash2, Zap,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
type UserAlert = {
  id: string
  user_id: string
  name: string
  regions?: string[] | null
  severities?: string[] | null
  keywords?: string[] | null
  actor_ids?: string[] | null
  frequency?: string | null
  delivery_email?: string | null
  delivery_webhook?: string | null
  active: boolean
  last_triggered_at?: string | null
  trigger_count?: number
  created_at: string
  // Advanced fields
  rule_definition?: RuleDefinition | null
  channel_routing?: ChannelRoute[] | null
  dedupe_config?: DedupeConfig | null
  escalation_policy?: EscalationPolicy | null
  tags?: string[] | null
  include_flights?: boolean
  include_vessels?: boolean
}

type RuleCondition = {
  field: string
  operator: string
  value: string | number | string[] | number[]
  negate?: boolean
}

type RuleGroup = {
  logic: 'AND' | 'OR'
  conditions: Array<RuleCondition | RuleGroup>
  negate?: boolean
}

type ThresholdTrigger = {
  type: 'count' | 'rate_of_change' | 'anomaly'
  threshold?: number
  window_minutes: number
  percent_change?: number
  sigma?: number
}

type RuleDefinition = {
  version: 2
  root: RuleGroup
  threshold?: ThresholdTrigger
  tags?: string[]
}

type ChannelRoute = {
  channel: 'in_app' | 'email' | 'webhook' | 'slack'
  min_severity?: number
  target?: string
  digest?: boolean
}

type DedupeConfig = {
  strategy: 'exact' | 'title_sim' | 'region_window' | 'content_hash'
  window_minutes: number
  similarity_threshold?: number
}

type EscalationPolicy = {
  ack_timeout_minutes: number
  escalate_to: string
  escalate_target?: string
  max_escalations: number
}

type EditorMode = 'simple' | 'advanced' | 'expert'

// ═══════════════════════════════════════════════════════════════
// FORM STATE
// ═══════════════════════════════════════════════════════════════
type SimpleForm = {
  name: string
  delivery_email: string
  severities: string[]
  regions: string[]
  keywords: string
  frequency: string
}

type AdvancedForm = SimpleForm & {
  event_types: string[]
  actors: string
  threshold_enabled: boolean
  threshold_type: 'count' | 'rate_of_change' | 'anomaly'
  threshold_value: number
  threshold_window: number
  delivery_webhook: string
  channel_routing: ChannelRoute[]
  dedupe_strategy: string
  dedupe_window: number
  include_flights: boolean
  include_vessels: boolean
  tags: string
}

type ExpertForm = AdvancedForm & {
  rule_json: string
  escalation_enabled: boolean
  escalation_timeout: number
  escalation_channel: string
  escalation_target: string
  escalation_max: number
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: '#ef4444', bg: 'bg-red-500/20', border: 'border-red-400' },
  { value: 'high', label: 'High', color: '#f97316', bg: 'bg-orange-500/20', border: 'border-orange-400' },
  { value: 'medium', label: 'Medium', color: '#eab308', bg: 'bg-yellow-500/20', border: 'border-yellow-400' },
  { value: 'low', label: 'Low', color: '#3b82f6', bg: 'bg-blue-500/20', border: 'border-blue-400' },
]

const REGION_OPTIONS = [
  { value: 'middle_east', label: 'Middle East' },
  { value: 'eastern_europe', label: 'E. Europe' },
  { value: 'east_asia', label: 'E. Asia' },
  { value: 'south_asia', label: 'S. Asia' },
  { value: 'southeast_asia', label: 'SE Asia' },
  { value: 'west_africa', label: 'W. Africa' },
  { value: 'east_africa', label: 'E. Africa' },
  { value: 'central_africa', label: 'C. Africa' },
  { value: 'north_africa', label: 'N. Africa' },
  { value: 'latin_america', label: 'Latin America' },
  { value: 'central_asia', label: 'C. Asia' },
  { value: 'caucasus', label: 'Caucasus' },
]

const EVENT_TYPE_OPTIONS = [
  { value: 'armed_conflict', label: 'Armed Conflict' },
  { value: 'protest', label: 'Protest/Civil Unrest' },
  { value: 'terrorism', label: 'Terrorism' },
  { value: 'political', label: 'Political Crisis' },
  { value: 'humanitarian', label: 'Humanitarian' },
  { value: 'displacement', label: 'Displacement' },
  { value: 'sanctions', label: 'Sanctions' },
  { value: 'cyber', label: 'Cyber Incident' },
  { value: 'military', label: 'Military Movement' },
  { value: 'diplomatic', label: 'Diplomatic' },
]

const FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant', desc: 'Within 5 minutes' },
  { value: 'hourly', label: 'Hourly Digest', desc: 'Batched every hour' },
  { value: 'daily', label: 'Daily Digest', desc: 'Once per day' },
  { value: 'weekly', label: 'Weekly Summary', desc: 'Once per week' },
]

const DEDUPE_OPTIONS = [
  { value: 'content_hash', label: 'Content Hash', desc: 'Suppress identical alerts' },
  { value: 'title_sim', label: 'Title Similarity', desc: 'Suppress similar-looking alerts' },
  { value: 'region_window', label: 'Region + Window', desc: 'One per region per time window' },
  { value: 'exact', label: 'Exact Match', desc: 'Only exact event ID duplicates' },
]

const EMPTY_SIMPLE: SimpleForm = {
  name: '', delivery_email: '', severities: [], regions: [], keywords: '', frequency: 'instant',
}

const EMPTY_ADVANCED: AdvancedForm = {
  ...EMPTY_SIMPLE,
  event_types: [], actors: '',
  threshold_enabled: false, threshold_type: 'count', threshold_value: 3, threshold_window: 60,
  delivery_webhook: '', channel_routing: [],
  dedupe_strategy: 'content_hash', dedupe_window: 60,
  include_flights: false, include_vessels: false, tags: '',
}

const EMPTY_EXPERT: ExpertForm = {
  ...EMPTY_ADVANCED,
  rule_json: '',
  escalation_enabled: false, escalation_timeout: 30, escalation_channel: 'email',
  escalation_target: '', escalation_max: 3,
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function timeAgo(input?: string | null): string {
  if (!input) return 'Never'
  const diff = Math.max(0, Date.now() - new Date(input).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function buildPayload(form: ExpertForm, mode: EditorMode) {
  const keywords = form.keywords.split(',').map(s => s.trim()).filter(Boolean)
  const payload: Record<string, unknown> = {
    name: form.name.trim() || 'My Alert',
    frequency: form.frequency,
  }

  // Legacy fields (always included for backward compat)
  if (form.regions.length) payload.regions = form.regions
  if (form.severities.length) payload.severities = form.severities
  if (keywords.length) payload.keywords = keywords
  if (form.delivery_email.trim()) payload.delivery_email = form.delivery_email.trim()

  if (mode === 'simple') return payload

  // Advanced fields
  if (form.delivery_webhook.trim()) payload.delivery_webhook = form.delivery_webhook.trim()
  if (form.include_flights) payload.include_flights = true
  if (form.include_vessels) payload.include_vessels = true
  if (form.tags.trim()) payload.tags = form.tags.split(',').map(s => s.trim()).filter(Boolean)

  // Build advanced rule definition
  if (mode === 'advanced' || mode === 'expert') {
    const conditions: Array<{ field: string; operator: string; value: string | number | string[] | number[] }> = []

    // Event type filter
    if (form.event_types.length > 0) {
      conditions.push({ field: 'event_type', operator: 'in', value: form.event_types })
    }

    // Actor keywords
    const actors = form.actors.split(',').map(s => s.trim()).filter(Boolean)
    if (actors.length > 0) {
      for (const actor of actors) {
        conditions.push({ field: 'actor', operator: 'contains', value: actor })
      }
    }

    // Severity as condition
    if (form.severities.length > 0) {
      const sevMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
      const sevNums = form.severities.map(s => sevMap[s] ?? 1)
      conditions.push({ field: 'severity', operator: 'in', value: sevNums })
    }

    // Region conditions
    if (form.regions.length > 0) {
      for (const region of form.regions) {
        conditions.push({ field: 'region', operator: 'contains', value: region.replace('_', ' ') })
      }
    }

    // Keyword conditions
    if (keywords.length > 0) {
      for (const kw of keywords) {
        conditions.push({ field: 'title', operator: 'contains', value: kw })
      }
    }

    const ruleDef: RuleDefinition = {
      version: 2,
      root: { logic: 'AND', conditions },
    }

    // Threshold trigger
    if (form.threshold_enabled) {
      ruleDef.threshold = {
        type: form.threshold_type,
        window_minutes: form.threshold_window,
        ...(form.threshold_type === 'count' ? { threshold: form.threshold_value } : {}),
        ...(form.threshold_type === 'rate_of_change' ? { percent_change: form.threshold_value } : {}),
        ...(form.threshold_type === 'anomaly' ? { sigma: form.threshold_value } : {}),
      }
    }

    payload.rule_definition = ruleDef

    // Dedupe config
    payload.dedupe_config = {
      strategy: form.dedupe_strategy,
      window_minutes: form.dedupe_window,
    }
  }

  // Expert-only: custom JSON override
  if (mode === 'expert' && form.rule_json.trim()) {
    try {
      const customDef = JSON.parse(form.rule_json)
      payload.rule_definition = customDef
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Escalation policy
  if (mode === 'expert' && form.escalation_enabled) {
    payload.escalation_policy = {
      ack_timeout_minutes: form.escalation_timeout,
      escalate_to: form.escalation_channel,
      escalate_target: form.escalation_target || undefined,
      max_escalations: form.escalation_max,
    }
  }

  return payload
}

function formFromAlert(alert: UserAlert): ExpertForm {
  const ruleDef = alert.rule_definition
  const eventTypes = (ruleDef?.root?.conditions ?? [])
    .filter((c): c is RuleCondition => 'field' in c && c.field === 'event_type' && c.operator === 'in')
    .flatMap(c => (Array.isArray(c.value) ? c.value : [c.value]).map(String))

  return {
    name: alert.name ?? '',
    delivery_email: alert.delivery_email ?? '',
    severities: alert.severities ?? [],
    regions: alert.regions ?? [],
    keywords: (alert.keywords ?? []).join(', '),
    frequency: alert.frequency ?? 'instant',
    event_types: eventTypes,
    actors: (alert.actor_ids ?? []).join(', '),
    threshold_enabled: !!ruleDef?.threshold,
    threshold_type: ruleDef?.threshold?.type ?? 'count',
    threshold_value: ruleDef?.threshold?.threshold ?? ruleDef?.threshold?.percent_change ?? ruleDef?.threshold?.sigma ?? 3,
    threshold_window: ruleDef?.threshold?.window_minutes ?? 60,
    delivery_webhook: alert.delivery_webhook ?? '',
    channel_routing: alert.channel_routing ?? [],
    dedupe_strategy: alert.dedupe_config?.strategy ?? 'content_hash',
    dedupe_window: alert.dedupe_config?.window_minutes ?? 60,
    include_flights: alert.include_flights ?? false,
    include_vessels: alert.include_vessels ?? false,
    tags: (alert.tags ?? []).join(', '),
    rule_json: ruleDef ? JSON.stringify(ruleDef, null, 2) : '',
    escalation_enabled: !!alert.escalation_policy,
    escalation_timeout: alert.escalation_policy?.ack_timeout_minutes ?? 30,
    escalation_channel: alert.escalation_policy?.escalate_to ?? 'email',
    escalation_target: alert.escalation_policy?.escalate_target ?? '',
    escalation_max: alert.escalation_policy?.max_escalations ?? 3,
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT: PILL TOGGLE
// ═══════════════════════════════════════════════════════════════
function PillToggle({ options, selected, onToggle, colorMap }: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  colorMap?: Record<string, { bg: string; border: string; color: string }>
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => {
        const active = selected.includes(opt.value)
        const colors = colorMap?.[opt.value]
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
              active
                ? colors ? `${colors.bg} ${colors.border}` : 'border-blue-400 bg-blue-500/20 text-blue-400'
                : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/60'
            }`}
            style={active && colors ? { color: colors.color } : undefined}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT: SECTION HEADER
// ═══════════════════════════════════════════════════════════════
function SectionHeader({ icon: Icon, label, collapsed, onToggle }: {
  icon: React.ElementType
  label: string
  collapsed?: boolean
  onToggle?: () => void
}) {
  const Chevron = collapsed ? ChevronRight : ChevronDown
  return (
    <button type="button" onClick={onToggle}
      className="flex items-center gap-2 w-full text-left group">
      <Icon className="w-3.5 h-3.5 text-white/25" />
      <span className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold flex-1">{label}</span>
      {onToggle && <Chevron className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition" />}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export function AlertsManager() {
  const [alerts, setAlerts] = useState<UserAlert[]>([])
  const [form, setForm] = useState<ExpertForm>(EMPTY_EXPERT)
  const [mode, setMode] = useState<EditorMode>('simple')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    delivery: true, threshold: false, dedupe: false, escalation: false, json: false,
  })

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Data ──
  async function loadAlerts() {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/alerts?type=rules', { cache: 'no-store' })
      const json = await res.json() as { data?: UserAlert[] }
      setAlerts(json.data ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }

  useEffect(() => { void loadAlerts() }, [])

  const activeCount = useMemo(() => alerts.filter(a => a.active !== false).length, [alerts])

  function updateForm<K extends keyof ExpertForm>(key: K, value: ExpertForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleArrayItem(key: 'severities' | 'regions' | 'event_types', value: string) {
    setForm(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(v => v !== value) : [...prev[key], value],
    }))
  }

  // ── CRUD ──
  async function submitForm() {
    if (!form.name.trim()) { setMessage('Alert name is required'); return }
    setSaving(true); setMessage(null)
    try {
      const payload = buildPayload(form, mode)
      const url = editingId ? `/api/v1/alerts/${editingId}` : '/api/v1/alerts'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setMessage(json.error ?? 'Save failed'); return }
      setForm(EMPTY_EXPERT); setEditingId(null)
      await loadAlerts()
      setMessage(editingId ? 'Alert updated successfully' : 'Alert created successfully')
    } catch { setMessage('Save failed') }
    finally { setSaving(false) }
  }

  async function toggleAlert(alert: UserAlert) {
    await fetch(`/api/v1/alerts/${alert.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !alert.active }),
    })
    await loadAlerts()
  }

  async function deleteAlert(id: string) {
    await fetch(`/api/v1/alerts/${id}`, { method: 'DELETE' })
    if (editingId === id) { setEditingId(null); setForm(EMPTY_EXPERT) }
    await loadAlerts()
  }

  function startEdit(alert: UserAlert) {
    setEditingId(alert.id)
    setForm(formFromAlert(alert))
    setMessage(null)
    // Auto-detect mode based on rule complexity
    if (alert.escalation_policy || alert.rule_definition?.root?.conditions?.some(c => 'logic' in c)) {
      setMode('expert')
    } else if (alert.rule_definition || alert.delivery_webhook || alert.dedupe_config) {
      setMode('advanced')
    } else {
      setMode('simple')
    }
  }

  function resetForm() {
    setEditingId(null); setForm(EMPTY_EXPERT); setMessage(null)
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── MODE SELECTOR + FORM ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-white">
                {editingId ? 'Edit Alert Rule' : 'Create Alert Rule'}
              </h3>
              <p className="text-[10px] text-white/35 mt-0.5">
                {activeCount} active rule{activeCount === 1 ? '' : 's'} · Evaluated every 3 minutes
              </p>
            </div>
          </div>

          {/* Mode switcher */}
          <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
            {([
              { key: 'simple' as const, label: 'Simple', icon: Zap },
              { key: 'advanced' as const, label: 'Advanced', icon: Sliders },
              { key: 'expert' as const, label: 'Expert', icon: Code2 },
            ]).map(({ key, label, icon: ModeIcon }) => (
              <button key={key} onClick={() => setMode(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  mode === key
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                    : 'text-white/30 hover:text-white/50'
                }`}>
                <ModeIcon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Form body */}
        <div className="px-5 py-4 space-y-4">

          {/* Row 1: Name + Frequency */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Rule Name *</label>
              <input
                value={form.name} onChange={e => updateForm('name', e.target.value)}
                placeholder="e.g. Middle East Crisis Monitor"
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/15 focus:border-blue-500/30 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Frequency</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FREQUENCY_OPTIONS.map(f => (
                  <button key={f.value} onClick={() => updateForm('frequency', f.value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                      form.frequency === f.value
                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                        : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'
                    }`}>
                    <div className="text-[11px] font-semibold">{f.label}</div>
                    <div className="text-[9px] opacity-60 mt-0.5">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Severity Levels</label>
            <PillToggle
              options={SEVERITY_OPTIONS}
              selected={form.severities}
              onToggle={v => toggleArrayItem('severities', v)}
              colorMap={Object.fromEntries(SEVERITY_OPTIONS.map(s => [s.value, { bg: s.bg, border: s.border, color: s.color }]))}
            />
          </div>

          {/* Regions */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Regions</label>
            <PillToggle
              options={REGION_OPTIONS}
              selected={form.regions}
              onToggle={v => toggleArrayItem('regions', v)}
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Keywords</label>
            <input
              value={form.keywords} onChange={e => updateForm('keywords', e.target.value)}
              placeholder="iran, drone strike, ceasefire, sanctions"
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/15 focus:border-blue-500/30 focus:outline-none transition"
            />
            <p className="text-[9px] text-white/20 mt-1">Comma-separated. Matches event titles and descriptions.</p>
          </div>

          {/* ═══════ ADVANCED MODE ═══════ */}
          {(mode === 'advanced' || mode === 'expert') && (
            <>
              {/* Event Types */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Event Types</label>
                <PillToggle
                  options={EVENT_TYPE_OPTIONS}
                  selected={form.event_types}
                  onToggle={v => toggleArrayItem('event_types', v)}
                />
              </div>

              {/* Actors */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Actor Keywords</label>
                <input
                  value={form.actors} onChange={e => updateForm('actors', e.target.value)}
                  placeholder="e.g. Houthi, Wagner, Hamas"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/15 focus:border-blue-500/30 focus:outline-none transition"
                />
              </div>

              {/* Data Sources */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => updateForm('include_flights', !form.include_flights)}>
                  {form.include_flights
                    ? <ToggleRight className="w-5 h-5 text-blue-400" />
                    : <ToggleLeft className="w-5 h-5 text-white/20 group-hover:text-white/40" />
                  }
                  <span className={`text-[11px] ${form.include_flights ? 'text-white/70' : 'text-white/30'}`}>Include flight data</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group" onClick={() => updateForm('include_vessels', !form.include_vessels)}>
                  {form.include_vessels
                    ? <ToggleRight className="w-5 h-5 text-blue-400" />
                    : <ToggleLeft className="w-5 h-5 text-white/20 group-hover:text-white/40" />
                  }
                  <span className={`text-[11px] ${form.include_vessels ? 'text-white/70' : 'text-white/30'}`}>Include vessel data</span>
                </label>
              </div>

              {/* Threshold Trigger */}
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                <SectionHeader icon={AlertTriangle} label="Threshold Trigger"
                  collapsed={!expandedSections.threshold} onToggle={() => toggleSection('threshold')} />
                {expandedSections.threshold && (
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer" onClick={() => updateForm('threshold_enabled', !form.threshold_enabled)}>
                      {form.threshold_enabled
                        ? <ToggleRight className="w-5 h-5 text-blue-400" />
                        : <ToggleLeft className="w-5 h-5 text-white/20" />
                      }
                      <span className={`text-[11px] ${form.threshold_enabled ? 'text-white/70' : 'text-white/30'}`}>
                        Enable threshold-based triggering
                      </span>
                    </label>
                    {form.threshold_enabled && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-white/20 mb-1 block">Type</label>
                          <select value={form.threshold_type}
                            onChange={e => updateForm('threshold_type', e.target.value as 'count' | 'rate_of_change' | 'anomaly')}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white">
                            <option value="count">Event Count</option>
                            <option value="rate_of_change">Rate of Change</option>
                            <option value="anomaly">Anomaly (σ)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-white/20 mb-1 block">
                            {form.threshold_type === 'count' ? 'Min Events' : form.threshold_type === 'rate_of_change' ? '% Change' : 'Sigma (σ)'}
                          </label>
                          <input type="number" value={form.threshold_value}
                            onChange={e => updateForm('threshold_value', Number(e.target.value))}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-white/20 mb-1 block">Window (min)</label>
                          <input type="number" value={form.threshold_window}
                            onChange={e => updateForm('threshold_window', Number(e.target.value))}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Channels */}
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                <SectionHeader icon={Layers} label="Delivery Channels"
                  collapsed={!expandedSections.delivery} onToggle={() => toggleSection('delivery')} />
                {expandedSections.delivery && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-[9px] text-white/20 mb-1 block">Email</label>
                      <input value={form.delivery_email} onChange={e => updateForm('delivery_email', e.target.value)}
                        placeholder="alerts@company.com"
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/15" />
                    </div>
                    <div>
                      <label className="text-[9px] text-white/20 mb-1 block">Webhook URL</label>
                      <input value={form.delivery_webhook} onChange={e => updateForm('delivery_webhook', e.target.value)}
                        placeholder="https://hooks.slack.com/..."
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/15" />
                    </div>
                  </div>
                )}
              </div>

              {/* Deduplication */}
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                <SectionHeader icon={Shield} label="Deduplication & Suppression"
                  collapsed={!expandedSections.dedupe} onToggle={() => toggleSection('dedupe')} />
                {expandedSections.dedupe && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {DEDUPE_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => updateForm('dedupe_strategy', opt.value)}
                          className={`rounded-lg border p-2.5 text-left transition-all ${
                            form.dedupe_strategy === opt.value
                              ? 'border-blue-500/30 bg-blue-500/8'
                              : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                          }`}>
                          <div className={`text-[10px] font-semibold ${form.dedupe_strategy === opt.value ? 'text-blue-400' : 'text-white/50'}`}>{opt.label}</div>
                          <div className="text-[9px] text-white/25 mt-0.5">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="text-[9px] text-white/20 mb-1 block">Suppression Window (minutes)</label>
                      <input type="number" value={form.dedupe_window}
                        onChange={e => updateForm('dedupe_window', Number(e.target.value))}
                        className="w-32 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] text-white/25 mb-1.5 block">Tags</label>
                <input
                  value={form.tags} onChange={e => updateForm('tags', e.target.value)}
                  placeholder="e.g. high-priority, ops-team, middle-east-desk"
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/15 focus:border-blue-500/30 focus:outline-none transition"
                />
              </div>
            </>
          )}

          {/* ═══════ EXPERT MODE ═══════ */}
          {mode === 'expert' && (
            <>
              {/* Escalation Policy */}
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                <SectionHeader icon={AlertTriangle} label="Escalation Policy"
                  collapsed={!expandedSections.escalation} onToggle={() => toggleSection('escalation')} />
                {expandedSections.escalation && (
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer" onClick={() => updateForm('escalation_enabled', !form.escalation_enabled)}>
                      {form.escalation_enabled
                        ? <ToggleRight className="w-5 h-5 text-blue-400" />
                        : <ToggleLeft className="w-5 h-5 text-white/20" />
                      }
                      <span className={`text-[11px] ${form.escalation_enabled ? 'text-white/70' : 'text-white/30'}`}>
                        Escalate unacknowledged alerts
                      </span>
                    </label>
                    {form.escalation_enabled && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-white/20 mb-1 block">Timeout (minutes)</label>
                          <input type="number" value={form.escalation_timeout}
                            onChange={e => updateForm('escalation_timeout', Number(e.target.value))}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white" />
                        </div>
                        <div>
                          <label className="text-[9px] text-white/20 mb-1 block">Escalate To</label>
                          <select value={form.escalation_channel}
                            onChange={e => updateForm('escalation_channel', e.target.value)}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white">
                            <option value="email">Email</option>
                            <option value="webhook">Webhook</option>
                            <option value="slack">Slack</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-white/20 mb-1 block">Target</label>
                          <input value={form.escalation_target}
                            onChange={e => updateForm('escalation_target', e.target.value)}
                            placeholder="manager@company.com"
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white placeholder:text-white/15" />
                        </div>
                        <div>
                          <label className="text-[9px] text-white/20 mb-1 block">Max Escalations</label>
                          <input type="number" value={form.escalation_max}
                            onChange={e => updateForm('escalation_max', Number(e.target.value))}
                            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-[11px] text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rule JSON Editor */}
              <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3">
                <SectionHeader icon={Code2} label="Rule Definition (JSON Override)"
                  collapsed={!expandedSections.json} onToggle={() => toggleSection('json')} />
                {expandedSections.json && (
                  <div className="mt-3">
                    <textarea
                      value={form.rule_json}
                      onChange={e => updateForm('rule_json', e.target.value)}
                      rows={10}
                      placeholder='{"version": 2, "root": {"logic": "AND", "conditions": [...]}}'
                      className="w-full rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[11px] text-green-400 font-mono placeholder:text-white/10 focus:border-blue-500/30 focus:outline-none transition"
                    />
                    <p className="text-[9px] text-white/20 mt-1">
                      Advanced: Override auto-generated rules with custom JSON. Supports nested AND/OR groups, NOT negation, regex matching, and geofence constraints.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
            <button onClick={() => void submitForm()} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-[12px] font-semibold text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
              {editingId ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : editingId ? 'Update Rule' : 'Create Rule'}
            </button>
            {editingId && (
              <button onClick={resetForm}
                className="rounded-lg border border-white/[0.08] px-3 py-2 text-[11px] text-white/50 hover:bg-white/[0.04] transition">
                Cancel
              </button>
            )}
            {message && (
              <span className={`text-[11px] ${message.includes('fail') || message.includes('required') || message.includes('error') ? 'text-red-400' : 'text-green-400'}`}>
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── EXISTING RULES LIST ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
        <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-white/25" />
            <span className="text-[13px] font-semibold text-white">Active Rules</span>
            <span className="text-[10px] text-white/30">({alerts.length})</span>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-8 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[12px] text-white/40">No alert rules configured yet.</p>
            <p className="text-[10px] text-white/20 mt-1">Create your first rule above to start receiving intelligence alerts.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {alerts.map(alert => {
              const r = alert as unknown as Record<string, unknown>
              const regions = (r.regions as string[]) ?? []
              const severities = (r.severities as string[]) ?? []
              const keywords = (r.keywords as string[]) ?? []
              const tags = (r.tags as string[]) ?? []
              const freq = (r.frequency as string) ?? 'instant'
              const triggerCount = (r.trigger_count as number) ?? 0
              const lastTriggered = (r.last_triggered_at as string) ?? null
              const hasAdvanced = !!alert.rule_definition
              const hasEscalation = !!alert.escalation_policy
              const hasWebhook = !!alert.delivery_webhook

              return (
                <div key={alert.id} className="px-5 py-4 group hover:bg-white/[0.01] transition">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${alert.active ? 'bg-green-500' : 'bg-white/20'}`} />
                      <span className="text-[13px] text-white font-semibold truncate">{alert.name}</span>
                      <span className="text-[9px] text-white/25 bg-white/[0.04] px-1.5 py-0.5 rounded flex-shrink-0">{freq}</span>
                      {hasAdvanced && <span className="text-[8px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/15 flex-shrink-0">ADV</span>}
                      {hasEscalation && <span className="text-[8px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/15 flex-shrink-0">ESC</span>}
                      {hasWebhook && <span className="text-[8px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/15 flex-shrink-0">WH</span>}
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => void toggleAlert(alert)}
                        className="p-1.5 rounded-md hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition" title={alert.active ? 'Pause' : 'Activate'}>
                        {alert.active ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => startEdit(alert)}
                        className="p-1.5 rounded-md hover:bg-white/[0.05] text-white/30 hover:text-white/60 transition" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => void deleteAlert(alert.id)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-white/30 hover:text-red-400 transition" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Filter pills */}
                  <div className="flex flex-wrap gap-1.5 mt-2.5 ml-5">
                    {severities.map(s => (
                      <span key={s} className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                        ${s === 'critical' ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                          : s === 'high' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/15'
                          : s === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/15'}`}>{s}</span>
                    ))}
                    {regions.map(r => (
                      <span key={r} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/35 border border-white/[0.06]">
                        {r.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {keywords.map(k => (
                      <span key={k} className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/15">{k}</span>
                    ))}
                    {tags.map(t => (
                      <span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/15">#{t}</span>
                    ))}
                    {severities.length === 0 && regions.length === 0 && keywords.length === 0 && !hasAdvanced && (
                      <span className="text-[9px] text-white/15 italic">No filters configured</span>
                    )}
                  </div>

                  {/* Stats footer */}
                  <div className="flex items-center gap-4 mt-2.5 ml-5">
                    <span className="text-[9px] text-white/20">
                      Triggered {triggerCount}× · Last: {timeAgo(lastTriggered)}
                    </span>
                    {alert.delivery_email && (
                      <span className="text-[9px] text-white/15">→ {alert.delivery_email}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
