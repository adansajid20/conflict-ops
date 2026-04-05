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

  // Look back 5 minutes for new events
  const h5m = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const [{ data: alertRules }, { data: recentEvents }, { data: recentPredictions }] = await Promise.all([
    supabase.from('user_alerts').select('*').eq('active', true),
    supabase.from('events').select('id, title, severity, region, event_type, category, occurred_at').gte('occurred_at', h5m).order('occurred_at', { ascending: false }).limit(100),
    supabase.from('predictions').select('id, title, region, probability, prediction_type').gt('expires_at', new Date().toISOString()).is('outcome', null).gte('probability', 0.6).limit(20),
  ])

  let triggered = 0

  for (const rule of alertRules ?? []) {
    const config = rule.config as Record<string, unknown>
    const cooldownMs = ((rule.cooldown_minutes as number) ?? 30) * 60 * 1000

    // Respect cooldown
    if (rule.last_triggered) {
      if (Date.now() - new Date(rule.last_triggered as string).getTime() < cooldownMs) continue
    }

    let matched = false
    let matchedEventId: string | null = null
    let matchedTitle = ''
    let matchedSeverity = 0
    let matchedRegion = ''

    const alertType = rule.alert_type as string

    // === Match against events ===
    if (alertType !== 'prediction') {
      for (const event of recentEvents ?? []) {
        let match = false

        if (alertType === 'region' && config.regions) {
          match = (config.regions as string[]).some(r => (event.region ?? '').toLowerCase().includes(r.toLowerCase()))
        } else if (alertType === 'severity' && config.min_severity) {
          match = (event.severity as number ?? 0) >= (config.min_severity as number)
        } else if (alertType === 'keyword' && config.keywords) {
          const title = (event.title ?? '').toLowerCase()
          match = (config.keywords as string[]).some(k => title.includes(k.toLowerCase()))
        } else if (alertType === 'correlation') {
          // Handled below
        } else {
          // Generic: region OR severity OR keyword
          const hasRegion = config.regions && (config.regions as string[]).some(r => (event.region ?? '').toLowerCase().includes(r.toLowerCase()))
          const hasSeverity = config.min_severity && (event.severity as number ?? 0) >= (config.min_severity as number)
          const hasKeyword = config.keywords && (event.title ?? '').toLowerCase().split(' ').some((w: string) => (config.keywords as string[]).map((k: string) => k.toLowerCase()).includes(w))
          match = !!(hasRegion || hasSeverity || hasKeyword)
        }

        if (match) {
          matched = true
          matchedEventId = event.id as string
          matchedTitle = event.title as string ?? ''
          matchedSeverity = event.severity as number ?? 1
          matchedRegion = event.region as string ?? 'Unknown'
          break
        }
      }
    }

    // === Match against predictions ===
    if (!matched && (alertType === 'prediction' || alertType === 'custom')) {
      for (const pred of recentPredictions ?? []) {
        const minProb = (config.min_probability as number) ?? 0.6
        const regions = config.regions as string[] | undefined
        const regionMatch = !regions || regions.some(r => (pred.region ?? '').toLowerCase().includes(r.toLowerCase()))
        if ((pred.probability as number) >= minProb && regionMatch) {
          matched = true
          matchedTitle = `Prediction: ${pred.title}`
          matchedRegion = pred.region as string ?? 'Unknown'
          break
        }
      }
    }

    // === Match correlations ===
    if (!matched && alertType === 'correlation') {
      const h1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { data: corrs } = await supabase.from('correlation_signals').select('id,description,region,confidence').gt('detected_at', h1h).gte('confidence', (config.min_confidence as number) ?? 0.7).limit(5)
      if ((corrs?.length ?? 0) > 0) {
        matched = true
        matchedTitle = corrs![0]!.description as string ?? 'Correlation detected'
        matchedRegion = corrs![0]!.region as string ?? 'Unknown'
      }
    }

    if (matched) {
      await supabase.from('alert_history').insert({
        alert_id: rule.id,
        user_id: rule.user_id as string,
        event_id: matchedEventId,
        title: `[${rule.name}] ${matchedTitle.slice(0, 120)}`,
        body: `Alert triggered for ${matchedRegion}. Severity: ${matchedSeverity || 'N/A'}.`,
        severity: matchedSeverity ? String(matchedSeverity) : null,
        channel: ((rule.channels as string[])?.[0]) ?? 'in_app',
        read: false,
      })

      await supabase.from('user_alerts').update({
        last_triggered: new Date().toISOString(),
        trigger_count: ((rule.trigger_count as number) ?? 0) + 1,
      }).eq('id', rule.id)

      triggered++
    }
  }

  return NextResponse.json({ triggered, alerts_checked: alertRules?.length ?? 0 })
}
