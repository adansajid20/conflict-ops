export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { evaluateAllRules } from '@/lib/alerts/advanced-engine'
import { computeEscalationLevel, ESCALATION_LABELS } from '@/lib/alerts/escalation'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (token && token === process.env.INTERNAL_SECRET) return true
  const auth = req.headers.get('authorization')
  if (auth && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) return true
  if (auth && process.env.INTERNAL_SECRET && auth === `Bearer ${process.env.INTERNAL_SECRET}`) return true
  return false
}

/**
 * Advanced Alert Evaluation Cron
 *
 * 1. Evaluates all active user_alerts rules against recent events
 *    - Composite AND/OR/NOT condition trees
 *    - Legacy regions/severities/keywords compat
 *    - Threshold + rate-of-change + anomaly triggers
 *    - Geofence constraints
 *    - 4-layer deduplication
 *    - Cooldown enforcement
 *
 * 2. Checks escalation ladder for active conflict countries
 *    - Creates escalation-change alerts when level shifts
 *
 * 3. Multi-channel delivery (in_app, email, webhook)
 */
export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── Phase 1: Rule evaluation ──
    const stats = await evaluateAllRules(24) // 24-hour lookback

    // ── Phase 2: Escalation ladder check ──
    let escalationAlerts = 0
    try {
      escalationAlerts = await checkEscalationChanges()
    } catch (err) {
      console.error('[evaluate-alerts] escalation check error:', err)
    }

    return NextResponse.json({
      success: true,
      ...stats,
      escalation_alerts: escalationAlerts,
      evaluated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[evaluate-alerts] critical error:', err)
    return NextResponse.json({
      error: 'Evaluation failed',
      message: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}

/**
 * Check escalation level changes for countries with recent events
 * and create alerts for users who have relevant region/country rules
 */
async function checkEscalationChanges(): Promise<number> {
  const supabase = createServiceClient()

  // Get countries with recent events (last 24h)
  const lookback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: countries } = await supabase
    .from('events')
    .select('country_code')
    .gte('ingested_at', lookback)
    .not('country_code', 'is', null)

  if (!countries?.length) return 0

  // Deduplicate country codes
  const uniqueCountries = [...new Set(countries.map(c => c.country_code as string).filter(Boolean))]
  let alertsCreated = 0

  for (const countryCode of uniqueCountries.slice(0, 30)) { // Cap at 30 countries per cycle
    try {
      const result = await computeEscalationLevel(countryCode)

      if (result.changed && result.previous !== null) {
        const direction = result.level > result.previous ? 'ESCALATED' : 'DE-ESCALATED'
        const prevLabel = ESCALATION_LABELS[result.previous] ?? 'UNKNOWN'
        const newLabel = ESCALATION_LABELS[result.level] ?? 'UNKNOWN'

        // Find users who have rules monitoring this country/region
        const { data: relevantRules } = await supabase
          .from('user_alerts')
          .select('id, user_id, name, delivery_email')
          .eq('active', true)

        for (const rule of relevantRules ?? []) {
          await supabase.from('alert_history').insert({
            alert_id: rule.id,
            user_id: rule.user_id as string,
            title: `[ESCALATION] ${countryCode} ${direction}: ${prevLabel} → ${newLabel}`,
            body: `${countryCode} escalation level changed from ${prevLabel} (${result.previous}) to ${newLabel} (${result.level}). This indicates a significant shift in conflict dynamics.`,
            severity: String(Math.min(result.level, 4)),
            channel: (rule.delivery_email as string) ? 'email' : 'in_app',
            read: false,
            dedupe_key: `escalation:${countryCode}:${result.level}:${Math.floor(Date.now() / (6 * 60 * 60 * 1000))}`,
            metadata: {
              trigger_reason: 'escalation_change',
              country_code: countryCode,
              previous_level: result.previous,
              new_level: result.level,
              direction,
            },
          })
          alertsCreated++
        }
      }
    } catch (err) {
      console.error(`[escalation] failed for ${countryCode}:`, err)
    }
  }

  return alertsCreated
}
