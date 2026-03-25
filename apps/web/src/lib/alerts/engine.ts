/**
 * Alert Engine
 * Evaluates PIR conditions against incoming events
 * Runs as part of heavy lane processing
 * 
 * ALERT TYPES:
 * - pir_match: Event matches a Priority Intelligence Requirement
 * - threshold: Severity or frequency threshold crossed
 * - escalation: Escalation ladder level change
 * - anomaly: Statistical anomaly detected (>2σ from rolling mean)
 */

import { createServiceClient } from '@/lib/supabase/server'

export type PIR = {
  id: string
  org_id: string
  mission_id: string | null
  name: string
  description: string
  conditions: PIRCondition[]
  alert_channels: AlertChannel[]
  active: boolean
  priority: 1 | 2 | 3
}

export type PIRCondition = {
  type: 'country' | 'event_type' | 'severity_gte' | 'keyword' | 'actor'
  value: string | number
}

export type AlertChannel = 'in_app' | 'email' | 'webhook'

export type AlertToCreate = {
  org_id: string
  pir_id: string | null
  event_id: string | null
  alert_type: string
  title: string
  body: string
  severity: 1 | 2 | 3 | 4 | 5
  channels: AlertChannel[]
  metadata: Record<string, unknown>
}

/**
 * Evaluate a single event against all active PIRs for the org
 * Returns alerts to create
 */
export async function evaluatePIRsForEvent(
  eventId: string,
  orgId: string
): Promise<AlertToCreate[]> {
  const supabase = createServiceClient()
  const alerts: AlertToCreate[] = []

  // Get event details
  const { data: event } = await supabase
    .from('events')
    .select('id, title, event_type, severity, country_code, description, provenance_inferred')
    .eq('id', eventId)
    .single()

  if (!event) return alerts

  // Get active PIRs for org
  const { data: pirs } = await supabase
    .from('pirs')
    .select('*')
    .eq('org_id', orgId)
    .eq('active', true)

  if (!pirs?.length) return alerts

  for (const pir of pirs) {
    const conditions = (pir.conditions as PIRCondition[]) ?? []
    if (conditions.length === 0) continue

    // ALL conditions must match (AND logic)
    const matched = conditions.every(condition => {
      switch (condition.type) {
        case 'country':
          return event.country_code === condition.value
        case 'event_type':
          return event.event_type === condition.value
        case 'severity_gte':
          return (event.severity ?? 1) >= (condition.value as number)
        case 'keyword': {
          const text = `${event.title} ${event.description ?? ''}`.toLowerCase()
          return text.includes(String(condition.value).toLowerCase())
        }
        case 'actor': {
          const actors = (event.provenance_inferred as Record<string, unknown>)?.['actor_names'] as string[] ?? []
          return actors.some(a => a.toLowerCase().includes(String(condition.value).toLowerCase()))
        }
        default:
          return false
      }
    })

    if (matched) {
      alerts.push({
        org_id: orgId,
        pir_id: pir.id as string,
        event_id: eventId,
        alert_type: 'pir_match',
        title: `PIR MATCH: ${pir.name as string}`,
        body: `Event "${event.title}" matches your PIR conditions. ${event.description ?? ''}`,
        severity: (event.severity as 1 | 2 | 3 | 4 | 5) ?? 2,
        channels: (pir.alert_channels as AlertChannel[]) ?? ['in_app'],
        metadata: {
          pir_name: pir.name,
          pir_priority: pir.priority,
          event_type: event.event_type,
          country_code: event.country_code,
        },
      })
    }
  }

  return alerts
}

/**
 * Persist alerts and fire webhook channels
 */
export async function createAlerts(alerts: AlertToCreate[]): Promise<void> {
  if (alerts.length === 0) return

  const supabase = createServiceClient()

  const rows = alerts.map(a => ({
    org_id: a.org_id,
    pir_id: a.pir_id,
    event_id: a.event_id,
    alert_type: a.alert_type,
    title: a.title,
    body: a.body,
    severity: a.severity,
    channels: a.channels,
    metadata: a.metadata,
    read: false,
  }))

  await supabase.from('alerts').insert(rows)

  // Fire webhooks + email for orgs that have them configured
  for (const alert of alerts) {
    if (alert.channels.includes('webhook')) {
      void fireWebhooks(alert).catch(err => console.error('[alert-engine] webhook error:', err))
    }
    if (alert.channels.includes('email')) {
      void fireAlertEmail(alert, supabase).catch(err => console.error('[alert-engine] email error:', err))
    }
  }
}

async function fireWebhooks(alert: AlertToCreate): Promise<void> {
  const supabase = createServiceClient()

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('url, secret')
    .eq('org_id', alert.org_id)
    .eq('active', true)
    .eq('event_type', 'alert.created')

  if (!webhooks?.length) return

  const payload = {
    event: 'alert.created',
    alert_type: alert.alert_type,
    title: alert.title,
    body: alert.body,
    severity: alert.severity,
    metadata: alert.metadata,
    timestamp: new Date().toISOString(),
  }

  for (const webhook of webhooks) {
    await fetch(webhook.url as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ConflictOps-Event': 'alert.created',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined) // fire-and-forget, best effort
  }
}

async function fireAlertEmail(alert: AlertToCreate, supabase: ReturnType<typeof createServiceClient>): Promise<void> {
  const { sendEmail } = await import('@/lib/email/client')

  // Get org member emails (owner + admin)
  const { data: members } = await supabase
    .from('users')
    .select('email')
    .eq('org_id', alert.org_id)
    .in('role', ['owner', 'admin'])
    .not('email', 'is', null)

  if (!members?.length) return

  for (const member of members) {
    if (!member.email) continue
    await sendEmail({
      to: member.email,
      template: 'alert_triggered',
      data: {
        alert_name: alert.title,
        description: alert.body,
        escalation_level: (alert.metadata as Record<string, unknown>)?.escalation_level ?? 'ELEVATED',
        event_count: (alert.metadata as Record<string, unknown>)?.event_count ?? '—',
        region: (alert.metadata as Record<string, unknown>)?.region ?? 'Unknown',
      },
    })
  }
}
