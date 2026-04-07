export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

/**
 * Evaluate active user_alerts rules against recent events.
 * Matching actual user_alerts table schema:
 *   id, user_id, name, regions[], severities[], keywords[],
 *   frequency, delivery_email, active, last_triggered_at, trigger_count
 */
export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()

  // Look back 5 minutes for new events
  const h5m = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const [{ data: alertRules }, { data: recentEvents }] = await Promise.all([
    supabase.from('user_alerts').select('*').eq('active', true),
    supabase.from('events')
      .select('id, title, severity, region, event_type, category, occurred_at')
      .gte('occurred_at', h5m)
      .order('occurred_at', { ascending: false })
      .limit(100),
  ])

  let triggered = 0

  for (const rule of alertRules ?? []) {
    const ruleRegions = (rule.regions as string[] | null) ?? []
    const ruleSeverities = (rule.severities as string[] | null) ?? []
    const ruleKeywords = (rule.keywords as string[] | null) ?? []

    // Cooldown: frequency-based
    // instant = 5min, hourly = 60min, daily = 1440min
    const freq = (rule.frequency as string) ?? 'instant'
    const cooldownMs = freq === 'daily' ? 1440 * 60 * 1000
      : freq === 'hourly' ? 60 * 60 * 1000
      : 5 * 60 * 1000

    if (rule.last_triggered_at) {
      if (Date.now() - new Date(rule.last_triggered_at as string).getTime() < cooldownMs) continue
    }

    // Evaluate against each recent event
    for (const event of recentEvents ?? []) {
      let match = true // Start true, filter down

      // If regions specified, event must match at least one
      if (ruleRegions.length > 0) {
        const eventRegion = ((event.region as string) ?? '').toLowerCase()
        const regionMatch = ruleRegions.some(r => eventRegion.includes(r.toLowerCase().replace('_', ' ')) || eventRegion.includes(r.toLowerCase()))
        if (!regionMatch) { match = false }
      }

      // If severities specified, event severity level name must match
      if (match && ruleSeverities.length > 0) {
        const sevNum = (event.severity as number) ?? 0
        const sevName = sevNum >= 4 ? 'critical' : sevNum >= 3 ? 'high' : sevNum >= 2 ? 'medium' : 'low'
        if (!ruleSeverities.includes(sevName)) { match = false }
      }

      // If keywords specified, at least one must appear in title
      if (match && ruleKeywords.length > 0) {
        const title = ((event.title as string) ?? '').toLowerCase()
        const keywordMatch = ruleKeywords.some(k => title.includes(k.toLowerCase()))
        if (!keywordMatch) { match = false }
      }

      // If no filters at all, don't match everything — require at least one filter
      if (ruleRegions.length === 0 && ruleSeverities.length === 0 && ruleKeywords.length === 0) {
        match = false
      }

      if (match) {
        const sevNum = (event.severity as number) ?? 1

        await supabase.from('alert_history').insert({
          alert_id: rule.id,
          user_id: rule.user_id as string,
          event_id: event.id,
          title: `[${rule.name}] ${((event.title as string) ?? '').slice(0, 120)}`,
          body: `Alert triggered for ${(event.region as string) ?? 'Unknown'}. Severity: ${sevNum}.`,
          severity: String(sevNum),
          channel: (rule.delivery_email as string) ? 'email' : 'in_app',
          read: false,
        })

        await supabase.from('user_alerts').update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: ((rule.trigger_count as number) ?? 0) + 1,
        }).eq('id', rule.id)

        triggered++
        break // One match per rule per cycle
      }
    }
  }

  return NextResponse.json({ triggered, alerts_checked: alertRules?.length ?? 0 })
}
