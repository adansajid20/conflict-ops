'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Bell, ChevronDown, ChevronRight, Code2,
  Eye, Layers, Pencil, Plus, Save, Shield, Sliders,
  ToggleLeft, ToggleRight, Trash2, Zap, Mail, Webhook, X,
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
  if (!input) return '—'
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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AlertsManager() {
  const [alerts, setAlerts] = useState<UserAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [mode, setMode] = useState<EditorMode>('simple')
  const [simpleForm, setSimpleForm] = useState(EMPTY_SIMPLE)
  const [advancedForm, setAdvancedForm] = useState(EMPTY_ADVANCED)
  const [expertForm, setExpertForm] = useState(EMPTY_EXPERT)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Load rules
  const load = async () => {
    try {
      const res = await fetch('/api/v1/alerts?type=rules', { cache: 'no-store' })
      const json = await res.json() as { data?: UserAlert[] }
      setAlerts(json.data ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  // Save rule
  const saveRule = async () => {
    if (!simpleForm.name) return alert('Rule name required')

    const payload: Record<string, unknown> = {
      name: simpleForm.name,
      regions: simpleForm.regions,
      severities: simpleForm.severities,
      keywords: simpleForm.keywords.split(',').filter(k => k.trim()),
      frequency: simpleForm.frequency,
      delivery_email: simpleForm.delivery_email || undefined,
    }

    if (mode === 'advanced' || mode === 'expert') {
      payload.event_types = advancedForm.event_types
      payload.delivery_webhook = advancedForm.delivery_webhook || undefined
      payload.include_flights = advancedForm.include_flights
      payload.include_vessels = advancedForm.include_vessels
      payload.tags = advancedForm.tags.split(',').filter(t => t.trim())
      payload.dedupe_config = {
        strategy: advancedForm.dedupe_strategy,
        window_minutes: advancedForm.dedupe_window,
      }
      if (advancedForm.threshold_enabled) {
        payload.threshold_trigger = {
          type: advancedForm.threshold_type,
          threshold: advancedForm.threshold_value,
          window_minutes: advancedForm.threshold_window,
        }
      }
    }

    if (mode === 'expert') {
      try {
        if (expertForm.rule_json) {
          payload.rule_definition = JSON.parse(expertForm.rule_json)
        }
      } catch {
        return alert('Invalid JSON in expert mode')
      }
      if (expertForm.escalation_enabled) {
        payload.escalation_policy = {
          ack_timeout_minutes: expertForm.escalation_timeout,
          escalate_to: expertForm.escalation_channel,
          escalate_target: expertForm.escalation_target,
          max_escalations: expertForm.escalation_max,
        }
      }
    }

    try {
      const res = await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (res.ok) {
        setAlerts(prev => [json.data as UserAlert, ...prev])
        setCreating(false)
        setSimpleForm(EMPTY_SIMPLE)
        setAdvancedForm(EMPTY_ADVANCED)
        setExpertForm(EMPTY_EXPERT)
      } else {
        alert('Failed to create rule')
      }
    } catch (err) {
      console.error(err)
      alert('Error saving rule')
    }
  }

  // Delete rule
  const deleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return
    try {
      await fetch(`/api/v1/alerts?id=${id}`, { method: 'DELETE' })
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch { /* silent */ }
  }

  // Toggle rule active
  const toggleRuleActive = async (id: string, active: boolean) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !active } : a))
    // In production, would call PATCH endpoint
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-6xl mx-auto" style={{ background: '#070B11' }}>
      {/* Header */}
      <motion.div
        className="px-8 py-6 border-b border-white/[0.06]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Alert Rules</h1>
            <p className="text-sm text-white/40 mt-1">Create and manage alert rules with advanced filtering</p>
          </div>
          <motion.button
            onClick={() => {
              setCreating(!creating)
              if (!creating) {
                setMode('simple')
                setSimpleForm(EMPTY_SIMPLE)
                setAdvancedForm(EMPTY_ADVANCED)
                setExpertForm(EMPTY_EXPERT)
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 font-semibold hover:bg-blue-500/30 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" /> Create Rule
          </motion.button>
        </div>

        {/* Mode selector */}
        {creating && (
          <motion.div
            className="flex gap-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {(['simple', 'advanced', 'expert'] as EditorMode[]).map(m => (
              <motion.button
                key={m}
                onClick={() => setMode(m)}
                className="px-4 py-2 rounded-lg text-sm font-semibold uppercase tracking-wider transition-all"
                style={{
                  color: mode === m ? '#3b82f6' : 'rgba(255,255,255,0.25)',
                  background: mode === m ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: mode === m ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                }}
                whileHover={{ scale: 1.02 }}
              >
                {m === 'simple' && '≋'}
                {m === 'advanced' && '≡'}
                {m === 'expert' && '⚙'}
                {m}
              </motion.button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Create Form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            className="px-8 py-6 border-b border-white/[0.06] bg-white/[0.01]"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Rule Name */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-white mb-2">Rule Name</label>
              <input
                type="text"
                value={simpleForm.name}
                onChange={e => setSimpleForm({ ...simpleForm, name: e.target.value })}
                placeholder="e.g., Critical Middle East Conflicts"
                className="w-full px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 focus:outline-none focus:bg-white/[0.08] focus:border-white/[0.15]"
              />
            </div>

            {/* Simple Mode */}
            {mode === 'simple' && (
              <SimpleRuleForm
                form={simpleForm}
                onChange={setSimpleForm}
              />
            )}

            {/* Advanced Mode */}
            {(mode === 'advanced' || mode === 'expert') && (
              <AdvancedRuleForm
                simpleForm={simpleForm}
                advancedForm={advancedForm}
                onSimpleChange={setSimpleForm}
                onAdvancedChange={setAdvancedForm}
              />
            )}

            {/* Expert Mode */}
            {mode === 'expert' && (
              <ExpertRuleForm
                form={expertForm}
                onChange={setExpertForm}
              />
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-white/[0.06] mt-6">
              <motion.button
                onClick={() => void saveRule()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 font-semibold hover:bg-blue-500/30 transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Save className="w-4 h-4" /> Save Rule
              </motion.button>
              <motion.button
                onClick={() => setCreating(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/60 font-semibold hover:bg-white/[0.08] transition-all"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules List */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
              <Bell className="w-8 h-8 text-blue-500/40" />
            </motion.div>
          </div>
        ) : alerts.length === 0 ? (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AlertTriangle className="w-12 h-12 text-white/15 mx-auto mb-4" />
            <p className="text-white/40 font-medium">No rules yet</p>
            <p className="text-white/25 text-sm mt-1">Create your first alert rule to get started</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {alerts.map((alert, idx) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <motion.button
                          onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                          className="p-1 text-white/40 hover:text-white/60"
                          whileHover={{ scale: 1.1 }}
                        >
                          {expandedId === alert.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </motion.button>
                        <h3 className="text-sm font-semibold text-white">{alert.name}</h3>
                        <span
                          className="text-[11px] font-bold uppercase px-2 py-0.5 rounded"
                          style={{
                            color: alert.active ? '#22c55e' : '#6b7280',
                            background: alert.active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                          }}
                        >
                          {alert.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {alert.trigger_count !== undefined && (
                        <p className="text-xs text-white/25 ml-6">
                          {alert.trigger_count}x triggered · {timeAgo(alert.last_triggered_at)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => toggleRuleActive(alert.id, alert.active)}
                        className="p-1.5 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/60"
                        whileHover={{ scale: 1.1 }}
                      >
                        {alert.active ? (
                          <ToggleRight className="w-4 h-4 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-white/30" />
                        )}
                      </motion.button>
                      <motion.button
                        onClick={() => void deleteRule(alert.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        whileHover={{ scale: 1.1 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Details */}
                  {expandedId === alert.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-6 pl-4 border-l border-white/[0.06] space-y-3 pt-3"
                    >
                      {/* Conditions */}
                      {alert.severities && alert.severities.length > 0 && (
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Severities</p>
                          <div className="flex flex-wrap gap-1.5">
                            {alert.severities.map(sev => {
                              const cfg = SEVERITY_OPTIONS.find(s => s.value === sev)
                              return (
                                <span
                                  key={sev}
                                  className="text-xs font-semibold px-2 py-1 rounded"
                                  style={{
                                    color: cfg?.color || '#fff',
                                    background: (cfg?.color || '#fff') + '15',
                                    border: `1px solid ${(cfg?.color || '#fff')}30`,
                                  }}
                                >
                                  {cfg?.label || sev}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {alert.regions && alert.regions.length > 0 && (
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Regions</p>
                          <div className="flex flex-wrap gap-1.5">
                            {alert.regions.map(region => (
                              <span
                                key={region}
                                className="text-xs px-2 py-1 rounded bg-white/[0.05] text-white/70 border border-white/[0.1]"
                              >
                                {region.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Delivery */}
                      {(alert.delivery_email || alert.delivery_webhook) && (
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Delivery</p>
                          <div className="flex flex-wrap gap-2">
                            {alert.delivery_email && (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Mail className="w-3 h-3" /> Email
                              </span>
                            )}
                            {alert.delivery_webhook && (
                              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                <Webhook className="w-3 h-3" /> Webhook
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Frequency */}
                      {alert.frequency && (
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Frequency</p>
                          <p className="text-sm text-white/70">{alert.frequency}</p>
                        </div>
                      )}

                      {/* Tags */}
                      {alert.tags && alert.tags.length > 0 && (
                        <div>
                          <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-2">Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {alert.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FORM COMPONENTS
// ═══════════════════════════════════════════════════════════════
function SimpleRuleForm({
  form,
  onChange
}: {
  form: SimpleForm
  onChange: (form: SimpleForm) => void
}) {
  return (
    <>
      {/* Severities */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-3">Severity Levels</label>
        <div className="grid grid-cols-2 gap-3">
          {SEVERITY_OPTIONS.map(sev => (
            <motion.button
              key={sev.value}
              onClick={() => {
                const updated = form.severities.includes(sev.value)
                  ? form.severities.filter(s => s !== sev.value)
                  : [...form.severities, sev.value]
                onChange({ ...form, severities: updated })
              }}
              className="p-3 rounded-lg border text-sm font-semibold transition-all"
              style={{
                color: sev.color,
                borderColor: form.severities.includes(sev.value) ? sev.color : `${sev.color}30`,
                background: form.severities.includes(sev.value) ? `${sev.color}15` : 'transparent',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {sev.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Regions */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-3">Regions</label>
        <div className="grid grid-cols-3 gap-2">
          {REGION_OPTIONS.map(region => (
            <motion.button
              key={region.value}
              onClick={() => {
                const updated = form.regions.includes(region.value)
                  ? form.regions.filter(r => r !== region.value)
                  : [...form.regions, region.value]
                onChange({ ...form, regions: updated })
              }}
              className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all"
              style={{
                color: form.regions.includes(region.value) ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                borderColor: form.regions.includes(region.value) ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.1)',
                background: form.regions.includes(region.value) ? 'rgba(59,130,246,0.15)' : 'transparent',
              }}
              whileHover={{ scale: 1.02 }}
            >
              {region.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Keywords */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-2">Keywords (comma-separated)</label>
        <input
          type="text"
          value={form.keywords}
          onChange={e => onChange({ ...form, keywords: e.target.value })}
          placeholder="conflict, attack, military, ..."
          className="w-full px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20"
        />
      </div>

      {/* Frequency */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-3">Notification Frequency</label>
        <div className="grid grid-cols-2 gap-3">
          {FREQUENCY_OPTIONS.map(freq => (
            <motion.button
              key={freq.value}
              onClick={() => onChange({ ...form, frequency: freq.value })}
              className="p-3 rounded-lg border text-left transition-all"
              style={{
                borderColor: form.frequency === freq.value ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                background: form.frequency === freq.value ? 'rgba(59,130,246,0.15)' : 'transparent',
              }}
              whileHover={{ scale: 1.01 }}
            >
              <p className="text-sm font-semibold text-white">{freq.label}</p>
              <p className="text-xs text-white/40 mt-0.5">{freq.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">Email Delivery</label>
        <input
          type="email"
          value={form.delivery_email}
          onChange={e => onChange({ ...form, delivery_email: e.target.value })}
          placeholder="your@email.com"
          className="w-full px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20"
        />
      </div>
    </>
  )
}

function AdvancedRuleForm({
  simpleForm,
  advancedForm,
  onSimpleChange,
  onAdvancedChange
}: {
  simpleForm: SimpleForm
  advancedForm: AdvancedForm
  onSimpleChange: (form: SimpleForm) => void
  onAdvancedChange: (form: AdvancedForm) => void
}) {
  return (
    <>
      <SimpleRuleForm form={simpleForm} onChange={onSimpleChange} />

      {/* Event Types */}
      <div className="mb-6 mt-6 pt-6 border-t border-white/[0.06]">
        <label className="block text-sm font-semibold text-white mb-3">Event Types</label>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_TYPE_OPTIONS.map(evt => (
            <motion.button
              key={evt.value}
              onClick={() => {
                const updated = advancedForm.event_types.includes(evt.value)
                  ? advancedForm.event_types.filter(e => e !== evt.value)
                  : [...advancedForm.event_types, evt.value]
                onAdvancedChange({ ...advancedForm, event_types: updated })
              }}
              className="px-3 py-2 rounded-lg border text-xs font-semibold transition-all"
              style={{
                color: advancedForm.event_types.includes(evt.value) ? '#a855f7' : 'rgba(255,255,255,0.3)',
                borderColor: advancedForm.event_types.includes(evt.value) ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)',
                background: advancedForm.event_types.includes(evt.value) ? 'rgba(168,85,247,0.15)' : 'transparent',
              }}
              whileHover={{ scale: 1.02 }}
            >
              {evt.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Threshold */}
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-white mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={advancedForm.threshold_enabled}
            onChange={e => onAdvancedChange({ ...advancedForm, threshold_enabled: e.target.checked })}
            className="w-4 h-4 rounded border-white/[0.2] bg-white/[0.05]"
          />
          Enable Threshold Triggering
        </label>
        {advancedForm.threshold_enabled && (
          <div className="grid grid-cols-3 gap-3 ml-6">
            <div>
              <p className="text-xs text-white/40 mb-1">Type</p>
              <select
                value={advancedForm.threshold_type}
                onChange={e => onAdvancedChange({ ...advancedForm, threshold_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-xs"
              >
                <option value="count">Count</option>
                <option value="rate_of_change">Rate of Change</option>
                <option value="anomaly">Anomaly</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-1">Threshold</p>
              <input
                type="number"
                value={advancedForm.threshold_value}
                onChange={e => onAdvancedChange({ ...advancedForm, threshold_value: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-xs"
              />
            </div>
            <div>
              <p className="text-xs text-white/40 mb-1">Window (min)</p>
              <input
                type="number"
                value={advancedForm.threshold_window}
                onChange={e => onAdvancedChange({ ...advancedForm, threshold_window: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* Deduplication */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-3">Deduplication</label>
        <div className="grid grid-cols-2 gap-3">
          {DEDUPE_OPTIONS.map(dedupe => (
            <motion.button
              key={dedupe.value}
              onClick={() => onAdvancedChange({ ...advancedForm, dedupe_strategy: dedupe.value })}
              className="p-3 rounded-lg border text-left transition-all"
              style={{
                borderColor: advancedForm.dedupe_strategy === dedupe.value ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                background: advancedForm.dedupe_strategy === dedupe.value ? 'rgba(59,130,246,0.15)' : 'transparent',
              }}
              whileHover={{ scale: 1.01 }}
            >
              <p className="text-sm font-semibold text-white">{dedupe.label}</p>
              <p className="text-xs text-white/40 mt-0.5">{dedupe.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Webhook */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-white mb-2">Webhook Delivery (optional)</label>
        <input
          type="url"
          value={advancedForm.delivery_webhook}
          onChange={e => onAdvancedChange({ ...advancedForm, delivery_webhook: e.target.value })}
          placeholder="https://..."
          className="w-full px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">Tags (comma-separated)</label>
        <input
          type="text"
          value={advancedForm.tags}
          onChange={e => onAdvancedChange({ ...advancedForm, tags: e.target.value })}
          placeholder="custom, tags, here"
          className="w-full px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20"
        />
      </div>
    </>
  )
}

function ExpertRuleForm({
  form,
  onChange
}: {
  form: ExpertForm
  onChange: (form: ExpertForm) => void
}) {
  return (
    <>
      <AdvancedRuleForm
        simpleForm={form}
        advancedForm={form}
        onSimpleChange={(f) => onChange({ ...form, ...f })}
        onAdvancedChange={(f) => onChange({ ...form, ...f })}
      />

      {/* Escalation */}
      <div className="mb-6 mt-6 pt-6 border-t border-white/[0.06]">
        <label className="flex items-center gap-2 text-sm font-semibold text-white mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.escalation_enabled}
            onChange={e => onChange({ ...form, escalation_enabled: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          Enable Escalation Policy
        </label>
        {form.escalation_enabled && (
          <div className="grid grid-cols-2 gap-3 ml-6">
            <div>
              <p className="text-xs text-white/40 mb-1">Timeout (minutes)</p>
              <input
                type="number"
                value={form.escalation_timeout}
                onChange={e => onChange({ ...form, escalation_timeout: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-xs"
              />
            </div>
            <div>
              <p className="text-xs text-white/40 mb-1">Channel</p>
              <select
                value={form.escalation_channel}
                onChange={e => onChange({ ...form, escalation_channel: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white text-xs"
              >
                <option value="email">Email</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Rule JSON */}
      <div>
        <label className="block text-sm font-semibold text-white mb-2">Advanced Rule Definition (JSON)</label>
        <textarea
          value={form.rule_json}
          onChange={e => onChange({ ...form, rule_json: e.target.value })}
          placeholder='{"version": 2, "root": ...}'
          className="w-full h-32 px-4 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/20 font-mono text-xs focus:outline-none"
        />
      </div>
    </>
  )
}
