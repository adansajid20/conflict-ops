import { createServiceClient } from '@/lib/supabase/server'
import { deliverWebhook } from '@/lib/webhooks/deliver'

export type AlertRuleCondition = {
  field: 'country_code' | 'event_type' | 'severity_gte' | 'keyword_match' | 'region'
  value: string | number
}

export type AlertRuleDefinition = {
  logic: 'AND' | 'OR'
  conditions: AlertRuleCondition[]
}

type EventRecord = {
  id: string
  title?: string | null
  description?: string | null
  country_code?: string | null
  event_type?: string | null
  severity?: number | null
  region?: string | null
}

function matchesCondition(event: EventRecord, condition: AlertRuleCondition): boolean {
  switch (condition.field) {
    case 'country_code':
      return (event.country_code ?? '').toUpperCase() === String(condition.value).toUpperCase()
    case 'event_type':
      return (event.event_type ?? '').toLowerCase() === String(condition.value).toLowerCase()
    case 'severity_gte':
      return Number(event.severity ?? 0) >= Number(condition.value)
    case 'keyword_match': {
      const haystack = `${event.title ?? ''} ${event.description ?? ''}`.toLowerCase()
      return haystack.includes(String(condition.value).toLowerCase())
    }
    case 'region':
      return (event.region ?? '').toLowerCase().includes(String(condition.value).toLowerCase())
    default:
      return false
  }
}

function matchesRule(event: EventRecord, definition: AlertRuleDefinition): boolean {
  if (definition.conditions.length === 0) return false
  if (definition.logic === 'OR') return definition.conditions.some((condition) => matchesCondition(event, condition))
  return definition.conditions.every((condition) => matchesCondition(event, condition))
}

export async function evaluateAlertRules(orgId: string, events: EventRecord[]): Promise<void> {
  if (!orgId || events.length === 0) return

  const supabase = createServiceClient()
  const { data: rules, error } = await supabase.from('alert_rules').select('id,name,conditions,action,active').eq('org_id', orgId).eq('active', true)
  if (error || !rules || rules.length === 0) return

  for (const rule of rules) {
    const definition = (rule.conditions ?? { logic: 'AND', conditions: [] }) as AlertRuleDefinition
    const matched = events.filter((event) => matchesRule(event, definition))
    if (matched.length === 0) continue

    const alertTitle = `Rule matched: ${String(rule.name ?? 'Untitled rule')}`
    const alertBody = `${matched.length} event(s) matched custom alert rule.`

    await supabase.from('alerts').insert({
      org_id: orgId,
      title: alertTitle,
      body: alertBody,
      alert_type: 'threshold',
      severity: Math.max(...matched.map((event) => Number(event.severity ?? 1))),
      delivered_at: new Date().toISOString(),
      read: false,
      metadata: { rule_id: rule.id, event_ids: matched.map((event) => event.id), action: rule.action },
    })

    if (rule.action === 'webhook') {
      await deliverWebhook(orgId, 'alert.rule_matched', { rule_id: rule.id, event_ids: matched.map((event) => event.id) })
    }
  }
}
