/**
 * Escalation Ladder Model
 * Inspired by NATO/ICRC escalation frameworks
 * 
 * Levels:
 * 1 — STABLE:      No significant conflict indicators
 * 2 — TENSION:     Political instability, protests, low-level incidents
 * 3 — CRISIS:      Armed clashes, significant displacement, international attention
 * 4 — CONFLICT:    Active armed conflict, significant casualties
 * 5 — WAR:         Full-scale war, mass atrocities, international intervention
 * 
 * Transitions trigger alerts when level changes ±1 or more
 */

import { createServiceClient } from '@/lib/supabase/server'

export type EscalationLevel = 1 | 2 | 3 | 4 | 5

export const ESCALATION_LABELS: Record<EscalationLevel, string> = {
  1: 'STABLE',
  2: 'TENSION',
  3: 'CRISIS',
  4: 'CONFLICT',
  5: 'WAR',
}

export const ESCALATION_COLORS: Record<EscalationLevel, string> = {
  1: '#10B981',
  2: '#3B82F6',
  3: '#F59E0B',
  4: '#EF4444',
  5: '#FF0000',
}

type EscalationWindow = {
  eventCount: number
  avgSeverity: number
  maxSeverity: number
  fatalityEstimate: number
  displacementSignal: boolean
}

/**
 * Compute escalation level for a country based on recent event window
 * 7-day rolling window — pure rule-based, no LLM
 */
export async function computeEscalationLevel(
  countryCode: string
): Promise<{ level: EscalationLevel; previous: EscalationLevel | null; changed: boolean }> {
  const supabase = createServiceClient()

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: events } = await supabase
    .from('events')
    .select('severity, event_type, provenance_raw')
    .eq('country_code', countryCode)
    .gte('occurred_at', sevenDaysAgo)

  if (!events?.length) {
    return { level: 1, previous: null, changed: false }
  }

  const window: EscalationWindow = {
    eventCount: events.length,
    avgSeverity: events.reduce((s, e) => s + (e.severity ?? 1), 0) / events.length,
    maxSeverity: Math.max(...events.map(e => e.severity ?? 1)),
    fatalityEstimate: events.reduce((s, e) => {
      const raw = e.provenance_raw as Record<string, unknown> | null
      return s + (parseInt(String(raw?.['fatalities'] ?? '0')) || 0)
    }, 0),
    displacementSignal: events.some(e =>
      ['humanitarian', 'displacement'].includes(e.event_type ?? '')
    ),
  }

  const level = scoreToLevel(window)

  // Get previous level
  const { data: prev } = await supabase
    .from('escalation_levels')
    .select('level')
    .eq('country_code', countryCode)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  const previousLevel = (prev?.level ?? null) as EscalationLevel | null
  const changed = previousLevel !== null && previousLevel !== level

  // Upsert current level
  await supabase.from('escalation_levels').upsert(
    {
      country_code: countryCode,
      level,
      label: ESCALATION_LABELS[level],
      window_days: 7,
      event_count: window.eventCount,
      avg_severity: Math.round(window.avgSeverity * 100) / 100,
      fatality_estimate: window.fatalityEstimate,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'country_code' }
  )

  return { level, previous: previousLevel, changed }
}

function scoreToLevel(window: EscalationWindow): EscalationLevel {
  const { eventCount, avgSeverity, maxSeverity, fatalityEstimate } = window

  // Level 5 — WAR
  if (fatalityEstimate > 200 || maxSeverity === 5 && eventCount > 20) return 5

  // Level 4 — CONFLICT
  if (fatalityEstimate > 50 || (maxSeverity >= 4 && eventCount > 10) || avgSeverity >= 4) return 4

  // Level 3 — CRISIS
  if (fatalityEstimate > 10 || (maxSeverity >= 3 && eventCount > 5) || avgSeverity >= 3) return 3

  // Level 2 — TENSION
  if (eventCount >= 3 || avgSeverity >= 2) return 2

  // Level 1 — STABLE
  return 1
}
