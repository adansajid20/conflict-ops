/**
 * Advanced Alert System — Shared Types
 * ConflictRadar Intelligence Platform
 *
 * Covers: composite rules, deduplication, escalation routing,
 * multi-channel delivery, acknowledgment workflows
 */

// ═══════════════════════════════════════════════════════════════
// RULE TYPES
// ═══════════════════════════════════════════════════════════════

/** Operators for individual conditions */
export type ConditionOperator =
  | 'eq' | 'neq'           // equals / not equals
  | 'contains' | 'not_contains'
  | 'gte' | 'lte' | 'gt' | 'lt'
  | 'in' | 'not_in'        // value in array
  | 'regex'                 // regex match
  | 'exists' | 'not_exists' // field presence

/** Supported fields for conditions */
export type ConditionField =
  | 'severity' | 'region' | 'country_code'
  | 'event_type' | 'category' | 'title'
  | 'description' | 'actor' | 'source'
  | 'fatalities' | 'displacement'
  | 'escalation_level' | 'escalation_change'

/** A single atomic condition */
export interface RuleCondition {
  field: ConditionField
  operator: ConditionOperator
  value: string | number | string[] | number[]
  /** Negate the entire condition (NOT) */
  negate?: boolean
}

/** Composite rule group with AND/OR logic and nesting */
export interface RuleGroup {
  logic: 'AND' | 'OR'
  conditions: Array<RuleCondition | RuleGroup>
  /** Negate the entire group (NOT) */
  negate?: boolean
}

/** Threshold / rate-of-change trigger */
export interface ThresholdTrigger {
  type: 'count' | 'rate_of_change' | 'anomaly'
  /** For 'count': min number of matching events in window */
  threshold?: number
  /** Rolling window in minutes */
  window_minutes: number
  /** For 'rate_of_change': % change that triggers */
  percent_change?: number
  /** For 'anomaly': number of standard deviations */
  sigma?: number
}

/** Geofence definition */
export interface Geofence {
  type: 'circle' | 'polygon'
  /** For circle: [lat, lng] */
  center?: [number, number]
  /** Radius in km for circle geofences */
  radius_km?: number
  /** For polygon: array of [lat, lng] */
  points?: [number, number][]
  /** Human-readable label */
  label?: string
}

/** Complete rule definition for the advanced engine */
export interface AdvancedRuleDefinition {
  /** Version for forward compatibility */
  version: 2
  /** The core condition tree */
  root: RuleGroup
  /** Optional threshold/rate triggers */
  threshold?: ThresholdTrigger
  /** Optional geofence constraints */
  geofence?: Geofence
  /** Tags for organizational grouping */
  tags?: string[]
}

// ═══════════════════════════════════════════════════════════════
// DELIVERY & CHANNEL TYPES
// ═══════════════════════════════════════════════════════════════

export type DeliveryChannel = 'in_app' | 'email' | 'webhook' | 'slack'

/** Per-channel routing rules */
export interface ChannelRouting {
  channel: DeliveryChannel
  /** Only route if severity meets this threshold */
  min_severity?: number
  /** Specific delivery target (email address, webhook URL, slack channel) */
  target?: string
  /** Whether to use digest mode for this channel */
  digest?: boolean
}

/** Suppression window (maintenance mode) */
export interface SuppressionWindow {
  start: string // ISO timestamp or cron expression
  end: string
  reason?: string
}

// ═══════════════════════════════════════════════════════════════
// DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

export type DedupeStrategy =
  | 'exact'        // exact same event_id
  | 'title_sim'    // title similarity > threshold
  | 'region_window' // same region within time window
  | 'content_hash'  // hash of normalized content

export interface DedupeConfig {
  strategy: DedupeStrategy
  /** Time window in minutes for dedup check */
  window_minutes: number
  /** For title_sim: similarity threshold 0-1 */
  similarity_threshold?: number
}

// ═══════════════════════════════════════════════════════════════
// ESCALATION & ACKNOWLEDGMENT
// ═══════════════════════════════════════════════════════════════

export type AckStatus = 'pending' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive'

export interface EscalationPolicy {
  /** Minutes to wait before escalating unacknowledged alerts */
  ack_timeout_minutes: number
  /** Channel to escalate to after timeout */
  escalate_to: DeliveryChannel
  /** Additional target for escalation (email, webhook url) */
  escalate_target?: string
  /** Max escalation attempts */
  max_escalations: number
}

// ═══════════════════════════════════════════════════════════════
// ALERT HISTORY (enriched)
// ═══════════════════════════════════════════════════════════════

export interface EnrichedAlert {
  id: string
  alert_id: string  // links to user_alerts rule
  user_id: string
  event_id?: string | null
  prediction_id?: string | null
  title: string
  body: string
  severity: string | number
  channel: string
  read: boolean
  ack_status: AckStatus
  ack_at?: string | null
  ack_by?: string | null
  ack_note?: string | null
  escalation_count: number
  dedupe_key?: string | null
  metadata?: Record<string, unknown>
  created_at: string
}

// ═══════════════════════════════════════════════════════════════
// ENGINE EVALUATION TYPES
// ═══════════════════════════════════════════════════════════════

export interface EventRecord {
  id: string
  title?: string | null
  description?: string | null
  severity?: number | null
  region?: string | null
  country_code?: string | null
  event_type?: string | null
  category?: string | null
  source?: string | null
  occurred_at?: string | null
  ingested_at?: string | null
  latitude?: number | null
  longitude?: number | null
  provenance_raw?: Record<string, unknown> | null
  provenance_inferred?: Record<string, unknown> | null
}

export interface EvaluationResult {
  rule_id: string
  rule_name: string
  matched_events: EventRecord[]
  trigger_reason: 'condition_match' | 'threshold_breach' | 'rate_change' | 'anomaly_detected' | 'escalation_change'
  severity: number
  dedupe_key: string
  metadata: Record<string, unknown>
}

/** Stats returned from a cron evaluation cycle */
export interface EvaluationCycleStats {
  rules_checked: number
  events_scanned: number
  matches_found: number
  alerts_created: number
  alerts_deduplicated: number
  alerts_suppressed: number
  duration_ms: number
}
