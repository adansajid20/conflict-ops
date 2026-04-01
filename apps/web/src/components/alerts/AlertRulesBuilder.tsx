'use client'

import { useEffect, useState } from 'react'

type Condition = { field: 'country_code' | 'event_type' | 'severity_gte' | 'keyword_match' | 'region'; value: string }
type Rule = { id: string; name: string; action: 'notify' | 'webhook' | 'email'; active: boolean; conditions: { logic: 'AND' | 'OR'; conditions: Condition[] } }

type OrgResponse = { data?: { org?: { plan_id?: string } } }

function getRuleLimit(planId?: string): string {
  if (planId === 'pro') return '5'
  if (planId === 'business' || planId === 'enterprise') return 'Unlimited'
  return '0'
}

export function AlertRulesBuilder() {
  const [name, setName] = useState('')
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [action, setAction] = useState<'notify' | 'webhook' | 'email'>('notify')
  const [conditions, setConditions] = useState<Condition[]>([{ field: 'country_code', value: '' }])
  const [rules, setRules] = useState<Rule[]>([])
  const [planId, setPlanId] = useState<string>('individual')
  const [message, setMessage] = useState('')

  async function load() {
    const [rulesResponse, orgResponse] = await Promise.all([
      fetch('/api/v1/alert-rules', { cache: 'no-store' }),
      fetch('/api/v1/enterprise/org', { cache: 'no-store' }),
    ])
    const rulesJson = await rulesResponse.json() as { data?: Rule[]; error?: string }
    const orgJson = await orgResponse.json() as OrgResponse
    setRules(rulesJson.data ?? [])
    setPlanId(orgJson.data?.org?.plan_id ?? 'individual')
    if (rulesJson.error) setMessage(rulesJson.error)
  }

  useEffect(() => { void load() }, [])

  async function saveRule() {
    const response = await fetch('/api/v1/alert-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, action, active: true, conditions: { logic, conditions } }),
    })
    const json = await response.json() as { success: boolean; error?: string }
    setMessage(json.success ? 'Rule saved' : (json.error ?? 'Save failed'))
    if (json.success) {
      setName('')
      setConditions([{ field: 'country_code', value: '' }])
      await load()
    }
  }

  async function removeRule(id: string) {
    const response = await fetch(`/api/v1/alert-rules?id=${id}`, { method: 'DELETE' })
    const json = await response.json() as { success: boolean; error?: string }
    setMessage(json.success ? 'Rule removed' : (json.error ?? 'Delete failed'))
    await load()
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Alert rules</div>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{rules.length} / {getRuleLimit(planId)} rules</div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Rule name" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} />
        <select value={logic} onChange={(event) => setLogic(event.target.value as 'AND' | 'OR')} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><option value="AND">AND</option><option value="OR">OR</option></select>
        <select value={action} onChange={(event) => setAction(event.target.value as 'notify' | 'webhook' | 'email')} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}><option value="notify">In-app notify</option><option value="webhook">Webhook</option><option value="email">Email</option></select>
        <button onClick={() => void saveRule()} className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Save rule</button>
      </div>

      <div className="mt-4 space-y-3">
        {conditions.map((condition, index) => (
          <div key={`${condition.field}-${index}`} className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
            <select value={condition.field} onChange={(event) => setConditions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value as Condition['field'] } : item))} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
              <option value="country_code">country_code</option>
              <option value="event_type">event_type</option>
              <option value="severity_gte">severity_gte</option>
              <option value="keyword_match">keyword_match</option>
              <option value="region">region</option>
            </select>
            <input value={condition.value} onChange={(event) => setConditions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="Value" className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} />
            <button onClick={() => setConditions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>Remove</button>
          </div>
        ))}
        <button onClick={() => setConditions((current) => [...current, { field: 'country_code', value: '' }])} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>Add condition</button>
      </div>

      <div className="mt-6 space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{rule.name}</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{rule.conditions.logic} • {rule.action} • {rule.conditions.conditions.map((condition) => `${condition.field}:${condition.value}`).join(', ')}</div>
              </div>
              <button onClick={() => void removeRule(rule.id)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {message ? <div className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</div> : null}
    </div>
  )
}
