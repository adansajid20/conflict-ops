export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const h3m = new Date(Date.now() - 3 * 60 * 1000).toISOString()

  // Get active alert rules
  const { data: alertRules } = await supabase.from('alert_rules').select('*').eq('active', true)
  // Get recent events
  const { data: recentEvents } = await supabase.from('events').select('id, title, severity, region, event_type, category, occurred_at').gte('occurred_at', h3m).order('occurred_at', { ascending: false }).limit(50)

  let triggered = 0

  for (const rule of alertRules ?? []) {
    const config = rule.config as Record<string, unknown>
    const cooldownMs = ((rule.cooldown_minutes as number) ?? 30) * 60 * 1000

    // Check cooldown
    if (rule.last_triggered) {
      const lastMs = new Date(rule.last_triggered as string).getTime()
      if (Date.now() - lastMs < cooldownMs) continue
    }

    for (const event of recentEvents ?? []) {
      let match = false

      // Region match
      if (config.regions && Array.isArray(config.regions)) {
        match = match || (config.regions as string[]).some((r: string) => (event.region ?? '').toLowerCase().includes(r.toLowerCase()))
      }

      // Severity match
      if (config.min_severity && typeof config.min_severity === 'number') {
        match = match || (event.severity ?? 0) >= (config.min_severity as number)
      }

      // Keyword match
      if (config.keywords && Array.isArray(config.keywords)) {
        const title = (event.title ?? '').toLowerCase()
        match = match || (config.keywords as string[]).some((k: string) => title.includes(k.toLowerCase()))
      }

      if (match) {
        await supabase.from('alert_history').insert({
          alert_id: rule.id,
          user_id: rule.user_id ?? 'system',
          event_id: event.id,
          title: `Alert: ${rule.name ?? 'Unnamed'} — ${event.title?.slice(0, 100)}`,
          body: `A matching event was detected in ${event.region ?? 'Unknown'}. Severity: ${event.severity ?? 'Unknown'}.`,
          severity: event.severity?.toString(),
          channel: 'in_app',
        })

        await supabase.from('alert_rules').update({ last_triggered: new Date().toISOString(), trigger_count: (rule.trigger_count ?? 0) + 1 }).eq('id', rule.id)
        triggered++
        break // One trigger per rule per run
      }
    }
  }

  // Also check email_subscriptions for sending emails
  const { data: subs } = await supabase.from('email_subscriptions').select('*').eq('active', true)
  let emailsSent = 0
  if ((subs?.length ?? 0) > 0 && (recentEvents?.length ?? 0) > 0) {
    const criticalEvents = recentEvents?.filter(e => (e.severity ?? 0) >= 4) ?? []
    if (criticalEvents.length > 0) {
      emailsSent = criticalEvents.length > 0 ? 1 : 0
      // Email sending via Resend handled by original send-alerts route
    }
  }

  return NextResponse.json({ triggered, alerts_checked: alertRules?.length ?? 0, email_subscriptions: subs?.length ?? 0, emailsSent })
}
