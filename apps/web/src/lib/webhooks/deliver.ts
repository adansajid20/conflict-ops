import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export async function deliverWebhook(
  orgId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient()
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('id,url,event_types,secret,failure_count')
    .eq('org_id', orgId)
    .eq('active', true)

  if (error || !webhooks) {
    if (error) console.warn('[webhooks] load failed', error.message)
    return
  }

  const matching = webhooks.filter((webhook) => Array.isArray(webhook.event_types) && webhook.event_types.includes(eventType))

  await Promise.all(matching.map(async (webhook) => {
    const body = JSON.stringify(payload)
    const signature = crypto.createHmac('sha256', String(webhook.secret)).update(body).digest('hex')

    try {
      const res = await fetch(String(webhook.url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ConflictOps-Signature': `sha256=${signature}`,
          'X-ConflictOps-Event': eventType,
        },
        body,
      })

      if (!res.ok) {
        const nextFailures = (Number(webhook.failure_count ?? 0) + 1)
        await supabase
          .from('webhooks')
          .update({
            failure_count: nextFailures,
            active: nextFailures >= 5 ? false : true,
            last_error: `HTTP ${res.status}`,
          })
          .eq('id', webhook.id)
        return
      }

      await supabase
        .from('webhooks')
        .update({ failure_count: 0, last_error: null, last_triggered: new Date().toISOString() })
        .eq('id', webhook.id)
    } catch (error: unknown) {
      const nextFailures = (Number(webhook.failure_count ?? 0) + 1)
      await supabase
        .from('webhooks')
        .update({
          failure_count: nextFailures,
          active: nextFailures >= 5 ? false : true,
          last_error: error instanceof Error ? error.message : 'Unknown delivery failure',
        })
        .eq('id', webhook.id)
    }
  }))
}
