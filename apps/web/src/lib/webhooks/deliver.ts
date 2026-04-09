import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

function isValidWebhookUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)

    // Only allow https
    if (url.protocol !== 'https:') {
      return false
    }

    // Block private IP ranges
    const hostname = url.hostname
    const privatePatterns = [
      /^127\./,                           // 127.0.0.0/8
      /^10\./,                            // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[01])\./,   // 172.16.0.0/12
      /^192\.168\./,                      // 192.168.0.0/16
      /^169\.254\./,                      // 169.254.0.0/16
      /^localhost$/i,
      /^metadata\.google\.internal$/i,
      /^\.local$/i,
    ]

    if (privatePatterns.some(p => p.test(hostname))) {
      return false
    }

    // Block non-standard ports (allow only 443 for https, 80 for http)
    // Since we enforce https, only 443 is allowed (or empty = default 443)
    const port = url.port
    if (port && port !== '443') {
      return false
    }

    return true
  } catch {
    return false
  }
}

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
    // Validate URL before making request
    if (!isValidWebhookUrl(String(webhook.url))) {
      const nextFailures = (Number(webhook.failure_count ?? 0) + 1)
      await supabase
        .from('webhooks')
        .update({
          failure_count: nextFailures,
          active: nextFailures >= 5 ? false : true,
          last_error: 'Invalid webhook URL (SSRF protection)',
        })
        .eq('id', webhook.id)
      return
    }

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
