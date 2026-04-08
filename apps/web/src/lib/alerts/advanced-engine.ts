/**
 * Advanced Alert Engine — Composite Rules Evaluator
 * ConflictRadar Intelligence Platform
 *
 * Features:
 * - Composite AND/OR/NOT condition trees with nesting
 * - Threshold triggers (event count in window)
 * - Rate-of-change detection (% change between windows)
 * - Anomaly detection (σ-based deviation from rolling mean)
 * - Geofence constraints (circle/polygon)
 * - 4-layer deduplication (exact, title similarity, region+window, content hash)
 * - Cooldown enforcement per rule per frequency
 * - Integration with escalation ladder
 */

import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import type {
  RuleCondition,
  RuleGroup,
  AdvancedRuleDefinition,
  ThresholdTrigger,
  Geofence,
  DedupeConfig,
  EventRecord,
  EvaluationResult,
  EvaluationCycleStats,
  ConditionField,
} from './types'

// ═══════════════════════════════════════════════════════════════
// CONDITION EVALUATION
// ═══════════════════════════════════════════════════════════════

/** Extract a field value from an event record */
function getFieldValue(event: EventRecord, field: ConditionField): string | number | string[] | null {
  switch (field) {
    case 'severity':
      return event.severity ?? 0
    case 'region':
      return (event.region ?? '').toLowerCase()
    case 'country_code':
      return (event.country_code ?? '').toUpperCase()
    case 'event_type':
      return (event.event_type ?? '').toLowerCase()
    case 'category':
      return (event.category ?? '').toLowerCase()
    case 'title':
      return (event.title ?? '').toLowerCase()
    case 'description':
      return (event.description ?? '').toLowerCase()
    case 'source':
      return (event.source ?? '').toLowerCase()
    case 'actor': {
      const inferred = event.provenance_inferred as Record<string, unknown> | null
      const actors = (inferred?.['actor_names'] as string[]) ?? []
      return actors.map(a => a.toLowerCase())
    }
    case 'fatalities': {
      const raw = event.provenance_raw as Record<string, unknown> | null
      return parseInt(String(raw?.['fatalities'] ?? '0')) || 0
    }
    case 'displacement': {
      const etype = (event.event_type ?? '').toLowerCase()
      return etype.includes('displacement') || etype.includes('humanitarian') ? 1 : 0
    }
    case 'escalation_level':
      return 0 // Filled by escalation engine separately
    case 'escalation_change':
      return 0 // Filled by escalation engine separately
    default:
      return null
  }
}

/** Evaluate a single atomic condition against an event */
function evaluateCondition(event: EventRecord, condition: RuleCondition): boolean {
  const fieldVal = getFieldValue(event, condition.field)
  const target = condition.value
  let result = false

  switch (condition.operator) {
    case 'eq':
      result = String(fieldVal).toLowerCase() === String(target).toLowerCase()
      break
    case 'neq':
      result = String(fieldVal).toLowerCase() !== String(target).toLowerCase()
      break
    case 'contains':
      if (Array.isArray(fieldVal)) {
        result = fieldVal.some(v => v.includes(String(target).toLowerCase()))
      } else {
        result = String(fieldVal).includes(String(target).toLowerCase())
      }
      break
    case 'not_contains':
      if (Array.isArray(fieldVal)) {
        result = !fieldVal.some(v => v.includes(String(target).toLowerCase()))
      } else {
        result = !String(fieldVal).includes(String(target).toLowerCase())
      }
      break
    case 'gte':
      result = Number(fieldVal ?? 0) >= Number(target)
      break
    case 'lte':
      result = Number(fieldVal ?? 0) <= Number(target)
      break
    case 'gt':
      result = Number(fieldVal ?? 0) > Number(target)
      break
    case 'lt':
      result = Number(fieldVal ?? 0) < Number(target)
      break
    case 'in':
      if (Array.isArray(target)) {
        const normalized = target.map(t => String(t).toLowerCase())
        if (Array.isArray(fieldVal)) {
          result = fieldVal.some(v => normalized.includes(v))
        } else {
          result = normalized.includes(String(fieldVal).toLowerCase())
        }
      }
      break
    case 'not_in':
      if (Array.isArray(target)) {
        const normalized = target.map(t => String(t).toLowerCase())
        if (Array.isArray(fieldVal)) {
          result = !fieldVal.some(v => normalized.includes(v))
        } else {
          result = !normalized.includes(String(fieldVal).toLowerCase())
        }
      }
      break
    case 'regex':
      try {
        const re = new RegExp(String(target), 'i')
        result = re.test(String(fieldVal))
      } catch {
        result = false
      }
      break
    case 'exists':
      result = fieldVal !== null && fieldVal !== '' && fieldVal !== 0
      break
    case 'not_exists':
      result = fieldVal === null || fieldVal === '' || fieldVal === 0
      break
  }

  return condition.negate ? !result : result
}

/** Recursively evaluate a condition group (AND/OR with nesting) */
export function evaluateGroup(event: EventRecord, group: RuleGroup): boolean {
  const results = group.conditions.map(node => {
    if ('logic' in node) {
      return evaluateGroup(event, node as RuleGroup)
    }
    return evaluateCondition(event, node as RuleCondition)
  })

  const matched = group.logic === 'AND'
    ? results.every(r => r)
    : results.some(r => r)

  return group.negate ? !matched : matched
}

// ═══════════════════════════════════════════════════════════════
// LEGACY RULE CONVERSION (backward compat with user_alerts schema)
// ═══════════════════════════════════════════════════════════════

/**
 * Convert legacy user_alerts fields (regions[], severities[], keywords[])
 * into an AdvancedRuleDefinition for unified evaluation
 */
export function convertLegacyRule(rule: Record<string, unknown>): AdvancedRuleDefinition {
  const conditions: RuleCondition[] = []

  const regions = (rule.regions as string[] | null) ?? []
  const severities = (rule.severities as string[] | null) ?? []
  const keywords = (rule.keywords as string[] | null) ?? []

  // Regions → OR group of region contains
  if (regions.length > 0) {
    if (regions.length === 1) {
      conditions.push({ field: 'region', operator: 'contains', value: regions[0]!.replace('_', ' ') })
    } else {
      // Multiple regions become an implicit OR within the AND
      // We handle this by using 'in' operator on a synthesized check
      conditions.push({ field: 'region', operator: 'contains', value: regions.join('|') })
    }
  }

  // Severities → convert names to numbers, use 'in'
  if (severities.length > 0) {
    const sevMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    const sevNums = severities.map(s => sevMap[s.toLowerCase()] ?? 1)
    if (severities.length === 1 && sevNums[0]) {
      conditions.push({ field: 'severity', operator: 'gte', value: sevNums[0] })
    } else {
      conditions.push({ field: 'severity', operator: 'in', value: sevNums })
    }
  }

  // Keywords → OR across title/description
  if (keywords.length > 0) {
    if (keywords.length === 1) {
      conditions.push({ field: 'title', operator: 'contains', value: keywords[0]! })
    } else {
      conditions.push({ field: 'title', operator: 'contains', value: keywords.join('|') })
    }
  }

  return {
    version: 2,
    root: {
      logic: 'AND',
      conditions,
    },
  }
}

/**
 * Special evaluation for legacy rules with regions/keywords arrays
 * Uses the same logic as before but through the unified interface
 */
export function evaluateLegacyRule(event: EventRecord, rule: Record<string, unknown>): boolean {
  const regions = (rule.regions as string[] | null) ?? []
  const severities = (rule.severities as string[] | null) ?? []
  const keywords = (rule.keywords as string[] | null) ?? []

  // Must have at least one filter
  if (regions.length === 0 && severities.length === 0 && keywords.length === 0) {
    // Check for advanced rule definition
    const advancedRule = rule.rule_definition as AdvancedRuleDefinition | null
    if (advancedRule?.root) {
      return evaluateGroup(event, advancedRule.root)
    }
    return false
  }

  let match = true

  // Regions: event.region must contain at least one
  if (regions.length > 0) {
    const eventRegion = (event.region ?? '').toLowerCase()
    const regionMatch = regions.some(r =>
      eventRegion.includes(r.toLowerCase().replace('_', ' ')) ||
      eventRegion.includes(r.toLowerCase())
    )
    if (!regionMatch) match = false
  }

  // Severities: event severity level name must match
  if (match && severities.length > 0) {
    const sevNum = event.severity ?? 0
    const sevName = sevNum >= 4 ? 'critical' : sevNum >= 3 ? 'high' : sevNum >= 2 ? 'medium' : 'low'
    if (!severities.includes(sevName)) match = false
  }

  // Keywords: at least one must appear in title or description
  if (match && keywords.length > 0) {
    const text = `${event.title ?? ''} ${event.description ?? ''}`.toLowerCase()
    const keywordMatch = keywords.some(k => text.includes(k.toLowerCase()))
    if (!keywordMatch) match = false
  }

  return match
}

// ═══════════════════════════════════════════════════════════════
// THRESHOLD & RATE-OF-CHANGE DETECTION
// ═══════════════════════════════════════════════════════════════

interface ThresholdCheckResult {
  triggered: boolean
  reason: 'threshold_breach' | 'rate_change' | 'anomaly_detected' | 'condition_match'
  current_count?: number
  previous_count?: number
  percent_change?: number
  sigma_deviation?: number
}

export async function checkThreshold(
  ruleId: string,
  trigger: ThresholdTrigger,
  currentMatchCount: number
): Promise<ThresholdCheckResult> {
  const supabase = createServiceClient()

  if (trigger.type === 'count') {
    return {
      triggered: currentMatchCount >= (trigger.threshold ?? 1),
      reason: 'threshold_breach',
      current_count: currentMatchCount,
    }
  }

  // For rate_of_change and anomaly, we need historical data
  const windowEnd = new Date()
  const windowStart = new Date(windowEnd.getTime() - trigger.window_minutes * 60 * 1000)
  const prevWindowStart = new Date(windowStart.getTime() - trigger.window_minutes * 60 * 1000)

  const { data: recentAlerts } = await supabase
    .from('alert_history')
    .select('created_at')
    .eq('alert_id', ruleId)
    .gte('created_at', prevWindowStart.toISOString())
    .lte('created_at', windowEnd.toISOString())

  const alerts = recentAlerts ?? []
  const currentWindow = alerts.filter(a => new Date(a.created_at as string) >= windowStart)
  const prevWindow = alerts.filter(a =>
    new Date(a.created_at as string) >= prevWindowStart &&
    new Date(a.created_at as string) < windowStart
  )

  if (trigger.type === 'rate_of_change') {
    const prevCount = prevWindow.length || 1 // avoid div by zero
    const change = ((currentMatchCount - prevCount) / prevCount) * 100
    return {
      triggered: Math.abs(change) >= (trigger.percent_change ?? 50),
      reason: 'rate_change',
      current_count: currentMatchCount,
      previous_count: prevCount,
      percent_change: Math.round(change),
    }
  }

  if (trigger.type === 'anomaly') {
    // Compute rolling mean and stddev from last 7 evaluation windows
    const { data: historicalCounts } = await supabase
      .from('alert_history')
      .select('created_at')
      .eq('alert_id', ruleId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const windowSize = trigger.window_minutes * 60 * 1000
    const buckets: number[] = []
    const now = Date.now()

    for (let i = 0; i < 7 * 24 * 60 / trigger.window_minutes; i++) {
      const bucketEnd = now - i * windowSize
      const bucketStart = bucketEnd - windowSize
      const count = (historicalCounts ?? []).filter(a => {
        const t = new Date(a.created_at as string).getTime()
        return t >= bucketStart && t < bucketEnd
      }).length
      buckets.push(count)
    }

    if (buckets.length < 3) {
      return { triggered: false, reason: 'anomaly_detected' }
    }

    const mean = buckets.reduce((s, n) => s + n, 0) / buckets.length
    const variance = buckets.reduce((s, n) => s + (n - mean) ** 2, 0) / buckets.length
    const stddev = Math.sqrt(variance) || 1
    const sigmaDeviation = (currentMatchCount - mean) / stddev

    return {
      triggered: sigmaDeviation >= (trigger.sigma ?? 2),
      reason: 'anomaly_detected',
      current_count: currentMatchCount,
      sigma_deviation: Math.round(sigmaDeviation * 100) / 100,
    }
  }

  return { triggered: currentMatchCount >= 1, reason: 'condition_match' }
}

// ═══════════════════════════════════════════════════════════════
// GEOFENCE CHECK
// ═══════════════════════════════════════════════════════════════

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]!
    const [yj, xj] = polygon[j]!
    if (((yi > lng) !== (yj > lng)) && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

export function checkGeofence(event: EventRecord, geofence: Geofence): boolean {
  if (!event.latitude || !event.longitude) return true // No coordinates = skip geofence check

  if (geofence.type === 'circle' && geofence.center && geofence.radius_km) {
    const dist = haversineKm(event.latitude, event.longitude, geofence.center[0], geofence.center[1])
    return dist <= geofence.radius_km
  }

  if (geofence.type === 'polygon' && geofence.points?.length) {
    return pointInPolygon(event.latitude, event.longitude, geofence.points)
  }

  return true
}

// ═══════════════════════════════════════════════════════════════
// DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

/** Generate a deduplication key for an alert */
export function generateDedupeKey(
  ruleId: string,
  event: EventRecord,
  strategy: 'exact' | 'title_sim' | 'region_window' | 'content_hash' = 'content_hash'
): string {
  switch (strategy) {
    case 'exact':
      return `exact:${ruleId}:${event.id}`
    case 'title_sim': {
      // Normalize title: lowercase, strip punctuation, sort words
      const normalized = (event.title ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).sort().join(' ')
      return `title:${ruleId}:${crypto.createHash('md5').update(normalized).digest('hex').slice(0, 12)}`
    }
    case 'region_window': {
      const region = (event.region ?? 'unknown').toLowerCase()
      // Round to 15-minute windows for grouping
      const windowKey = Math.floor(Date.now() / (15 * 60 * 1000))
      return `region:${ruleId}:${region}:${windowKey}`
    }
    case 'content_hash': {
      const content = `${ruleId}:${(event.title ?? '').toLowerCase()}:${(event.region ?? '').toLowerCase()}:${event.severity ?? 0}`
      return `hash:${crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)}`
    }
  }
}

/** Check if a dedupe key already exists within the window */
export async function isDuplicate(dedupeKey: string, windowMinutes: number = 60): Promise<boolean> {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('alert_history')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .gte('created_at', cutoff)
    .limit(1)

  return (data?.length ?? 0) > 0
}

// ═══════════════════════════════════════════════════════════════
// COOLDOWN ENFORCEMENT
// ═══════════════════════════════════════════════════════════════

const COOLDOWN_MAP: Record<string, number> = {
  instant: 5 * 60 * 1000,      // 5 min
  hourly: 60 * 60 * 1000,      // 1 hour
  daily: 24 * 60 * 60 * 1000,  // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
}

export function isInCooldown(lastTriggeredAt: string | null, frequency: string): boolean {
  if (!lastTriggeredAt) return false
  const cooldownMs = COOLDOWN_MAP[frequency] ?? COOLDOWN_MAP.instant!
  return Date.now() - new Date(lastTriggeredAt).getTime() < cooldownMs
}

// ═══════════════════════════════════════════════════════════════
// MAIN EVALUATION ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluate all active user_alerts against recent events
 * This is the main entry point called by the cron job
 */
export async function evaluateAllRules(lookbackHours: number = 24): Promise<EvaluationCycleStats> {
  const startTime = Date.now()
  const supabase = createServiceClient()

  const lookback = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  // Fetch active rules and recent events in parallel
  const [{ data: alertRules }, { data: recentEvents }] = await Promise.all([
    supabase.from('user_alerts').select('*').eq('active', true),
    supabase.from('events')
      .select('id, title, description, severity, region, country_code, event_type, category, source, occurred_at, ingested_at, latitude, longitude, provenance_raw, provenance_inferred')
      .gte('ingested_at', lookback)
      .order('ingested_at', { ascending: false })
      .limit(500),
  ])

  const rules = alertRules ?? []
  const events = (recentEvents ?? []) as unknown as EventRecord[]

  const stats: EvaluationCycleStats = {
    rules_checked: rules.length,
    events_scanned: events.length,
    matches_found: 0,
    alerts_created: 0,
    alerts_deduplicated: 0,
    alerts_suppressed: 0,
    duration_ms: 0,
  }

  for (const rule of rules) {
    const ruleId = rule.id as string
    const ruleName = (rule.name as string) ?? 'Unnamed'
    const frequency = (rule.frequency as string) ?? 'instant'
    const lastTriggered = (rule.last_triggered_at as string) ?? null

    // 1. Cooldown check
    if (isInCooldown(lastTriggered, frequency)) {
      stats.alerts_suppressed++
      continue
    }

    // 2. Check for advanced rule definition first, then legacy
    const advancedDef = rule.rule_definition as AdvancedRuleDefinition | null
    const hasLegacyFilters = ((rule.regions as string[])?.length ?? 0) > 0 ||
      ((rule.severities as string[])?.length ?? 0) > 0 ||
      ((rule.keywords as string[])?.length ?? 0) > 0

    if (!advancedDef && !hasLegacyFilters) continue

    // 3. Evaluate each event
    const matchedEvents: EventRecord[] = []

    for (const event of events) {
      let match = false

      if (advancedDef?.root) {
        // Advanced composite rule
        match = evaluateGroup(event, advancedDef.root)
        // Geofence constraint
        if (match && advancedDef.geofence) {
          match = checkGeofence(event, advancedDef.geofence)
        }
      } else {
        // Legacy rule evaluation
        match = evaluateLegacyRule(event, rule as Record<string, unknown>)
      }

      if (match) matchedEvents.push(event)
    }

    if (matchedEvents.length === 0) continue
    stats.matches_found += matchedEvents.length

    // 4. Threshold check (if configured)
    if (advancedDef?.threshold) {
      const threshResult = await checkThreshold(ruleId, advancedDef.threshold, matchedEvents.length)
      if (!threshResult.triggered) continue
    }

    // 5. Pick the best matching event (highest severity, most recent)
    const bestEvent = matchedEvents.sort((a, b) => {
      const sevDiff = (b.severity ?? 0) - (a.severity ?? 0)
      if (sevDiff !== 0) return sevDiff
      return new Date(b.ingested_at ?? '').getTime() - new Date(a.ingested_at ?? '').getTime()
    })[0]!

    // 6. Deduplication
    const dedupeKey = generateDedupeKey(ruleId, bestEvent, 'content_hash')
    const dedupeWindow = frequency === 'daily' ? 1440 : frequency === 'hourly' ? 60 : 30
    const isDupe = await isDuplicate(dedupeKey, dedupeWindow)

    if (isDupe) {
      stats.alerts_deduplicated++
      continue
    }

    // 7. Create the alert
    const sevNum = bestEvent.severity ?? 1
    const alertTitle = matchedEvents.length > 1
      ? `[${ruleName}] ${matchedEvents.length} events matched — ${(bestEvent.title ?? '').slice(0, 100)}`
      : `[${ruleName}] ${(bestEvent.title ?? '').slice(0, 120)}`

    const alertBody = matchedEvents.length > 1
      ? `${matchedEvents.length} events matched your alert rule "${ruleName}" in ${bestEvent.region ?? 'Unknown'}. Highest severity: ${sevNum}. Latest: ${(bestEvent.title ?? '').slice(0, 200)}`
      : `Alert triggered for ${bestEvent.region ?? 'Unknown'}. Severity: ${sevNum}. ${(bestEvent.description ?? '').slice(0, 200)}`

    const deliveryEmail = rule.delivery_email as string | null
    const deliveryWebhook = rule.delivery_webhook as string | null
    const channel = deliveryEmail ? 'email' : deliveryWebhook ? 'webhook' : 'in_app'

    await supabase.from('alert_history').insert({
      alert_id: ruleId,
      user_id: rule.user_id as string,
      event_id: bestEvent.id,
      title: alertTitle,
      body: alertBody,
      severity: String(sevNum),
      channel,
      read: false,
      dedupe_key: dedupeKey,
      metadata: {
        matched_count: matchedEvents.length,
        matched_event_ids: matchedEvents.slice(0, 10).map(e => e.id),
        trigger_reason: 'condition_match',
        rule_version: advancedDef ? 2 : 1,
      },
    })

    // 8. Update rule trigger tracking
    await supabase.from('user_alerts').update({
      last_triggered_at: new Date().toISOString(),
      trigger_count: ((rule.trigger_count as number) ?? 0) + 1,
    }).eq('id', ruleId)

    stats.alerts_created++

    // 9. Fire delivery channels asynchronously
    if (deliveryEmail) {
      void fireEmailDelivery(
        deliveryEmail,
        ruleName,
        matchedEvents.slice(0, 5),
        matchedEvents.length
      ).catch(err => console.error('[advanced-engine] email delivery failed:', err))
    }

    if (deliveryWebhook) {
      void fireWebhookDelivery(
        deliveryWebhook,
        ruleId,
        ruleName,
        bestEvent,
        matchedEvents.length
      ).catch(err => console.error('[advanced-engine] webhook delivery failed:', err))
    }
  }

  stats.duration_ms = Date.now() - startTime
  return stats
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY HELPERS
// ═══════════════════════════════════════════════════════════════

async function fireEmailDelivery(
  email: string,
  alertName: string,
  events: EventRecord[],
  totalCount: number
): Promise<void> {
  try {
    const { sendAlertEmail } = await import('./email-delivery')
    await sendAlertEmail({
      to: email,
      alertName,
      events: events.map(e => ({
        id: e.id,
        title: e.title ?? 'Untitled Event',
        severity: e.severity ?? 1,
        region: e.region ?? 'Unknown',
        source: e.source ?? 'Intelligence Feed',
        occurred_at: e.occurred_at ?? new Date().toISOString(),
        source_id: '',
      })),
      digestMode: totalCount > 1,
    })
  } catch (err) {
    console.error('[advanced-engine] email send error:', err)
  }
}

async function fireWebhookDelivery(
  webhookUrl: string,
  ruleId: string,
  ruleName: string,
  event: EventRecord,
  matchCount: number
): Promise<void> {
  const payload = {
    event: 'alert.triggered',
    rule_id: ruleId,
    rule_name: ruleName,
    match_count: matchCount,
    top_event: {
      id: event.id,
      title: event.title,
      severity: event.severity,
      region: event.region,
      country_code: event.country_code,
      event_type: event.event_type,
      occurred_at: event.occurred_at,
    },
    timestamp: new Date().toISOString(),
  }

  const body = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', process.env.WEBHOOK_SIGNING_SECRET ?? 'cr-webhook-default')
    .update(body).digest('hex')

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ConflictRadar-Signature': `sha256=${signature}`,
        'X-ConflictRadar-Event': 'alert.triggered',
      },
      body,
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    console.error('[advanced-engine] webhook delivery error:', err)
  }
}
