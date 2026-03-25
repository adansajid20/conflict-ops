// NOTE: Server-only functions (computeTravelRisk) live at the bottom.
// Client-safe exports (types, constants, generateTravelBrief) are pure.

/**
 * Travel Risk Engine — ISO 31030 aligned
 * ISO 31030:2021 — Travel risk management guidance for organizations
 *
 * Risk Levels:
 * 1 — LOW:      Standard precautions
 * 2 — MODERATE: Heightened awareness, enhanced security measures
 * 3 — HIGH:     Non-essential travel not recommended, security protocols required
 * 4 — EXTREME:  Essential travel only, approved security escort required
 * 5 — DO NOT TRAVEL: Evacuation recommended, no entry
 *
 * Inputs: event data + forecast score + escalation level + AIS/FIRMS signals
 */

export type TravelRiskLevel = 1 | 2 | 3 | 4 | 5

export const RISK_LABELS: Record<TravelRiskLevel, string> = {
  1: 'LOW',
  2: 'MODERATE',
  3: 'HIGH',
  4: 'EXTREME',
  5: 'DO NOT TRAVEL',
}

export const RISK_COLORS: Record<TravelRiskLevel, string> = {
  1: '#10B981',
  2: '#3B82F6',
  3: '#F59E0B',
  4: '#EF4444',
  5: '#FF0000',
}

export const RISK_ICONS: Record<TravelRiskLevel, string> = {
  1: '●', 2: '◈', 3: '▲', 4: '⬥', 5: '✕',
}

export type CountryRisk = {
  country_code: string
  country_name: string
  risk_level: TravelRiskLevel
  risk_score: number       // 0-100
  summary: string
  key_threats: string[]
  entry_conditions: string[]
  medical_risk: 'low' | 'moderate' | 'high'
  crime_risk: 'low' | 'moderate' | 'high'
  terrorism_risk: 'low' | 'moderate' | 'high'
  armed_conflict: boolean
  evacuation_routes: string[]
  embassy_contacts: Array<{ country: string; phone: string; emergency: string }>
  last_updated: string
  data_sources: string[]
}

export type TravelBrief = {
  traveler_name: string | null
  destination: string
  country_code: string
  departure: string
  return: string
  purpose: string
  risk_level: TravelRiskLevel
  pre_departure_checklist: string[]
  emergency_contacts: string[]
  medical_requirements: string[]
  communications_plan: string
  extraction_plan: string
  check_in_schedule: string
  generated_at: string
}

/**
 * Compute travel risk for a country from ingested event data
 * Returns null if insufficient data
 */
export async function computeTravelRisk(countryCode: string): Promise<{
  risk_level: TravelRiskLevel
  risk_score: number
  key_threats: string[]
} | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createServiceClient } = require('@/lib/supabase/server') as typeof import('@/lib/supabase/server')
  const supabase = createServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [eventsResult, escalationResult, forecastResult] = await Promise.allSettled([
    supabase
      .from('events')
      .select('severity, event_type')
      .eq('country_code', countryCode)
      .gte('occurred_at', thirtyDaysAgo),
    supabase
      .from('escalation_levels')
      .select('level')
      .eq('country_code', countryCode)
      .single(),
    supabase
      .from('forecasts')
      .select('score')
      .eq('country_code', countryCode)
      .eq('forecast_type', 'escalation')
      .single(),
  ])

  const events = eventsResult.status === 'fulfilled' ? (eventsResult.value.data ?? []) : []
  if (events.length < 3) return null

  const escalationLevel = escalationResult.status === 'fulfilled'
    ? (escalationResult.value.data?.level ?? 1)
    : 1

  const forecastScore = forecastResult.status === 'fulfilled'
    ? (forecastResult.value.data?.score ?? null)
    : null

  const avgSeverity = events.reduce((s, e) => s + (e.severity ?? 1), 0) / events.length
  const maxSeverity = Math.max(...events.map(e => e.severity ?? 1))
  const eventCount = events.length

  const freqNorm = Math.min(eventCount / 50, 1)
  const sevNorm = avgSeverity / 5
  const escNorm = escalationLevel / 5
  const forecastNorm = forecastScore ?? sevNorm

  const rawScore =
    0.25 * freqNorm +
    0.30 * sevNorm +
    0.25 * escNorm +
    0.20 * forecastNorm

  const riskScore = Math.round(rawScore * 100)

  const riskLevel: TravelRiskLevel =
    riskScore >= 80 ? 5 :
    riskScore >= 60 ? 4 :
    riskScore >= 40 ? 3 :
    riskScore >= 20 ? 2 : 1

  // Identify key threats from event types
  const eventTypes = [...new Set(events.map(e => e.event_type))]
  const keyThreats: string[] = []
  if (eventTypes.includes('conflict')) keyThreats.push('Active armed conflict')
  if (eventTypes.includes('terrorism')) keyThreats.push('Terrorism / IED threat')
  if (eventTypes.includes('political')) keyThreats.push('Political instability')
  if (eventTypes.includes('humanitarian')) keyThreats.push('Humanitarian crisis / displacement')
  if (eventTypes.includes('cyber')) keyThreats.push('Cyber/infrastructure attacks')
  if (maxSeverity >= 5) keyThreats.push('Mass casualty events reported')
  if (maxSeverity >= 4 && !keyThreats.length) keyThreats.push('High-severity security incidents')

  return { risk_level: riskLevel, risk_score: riskScore, key_threats: keyThreats }
}

/**
 * Generate a pre-departure travel brief (template — no LLM)
 */
export function generateTravelBrief(params: {
  travelerName: string | null
  destination: string
  countryCode: string
  departure: string
  return: string
  purpose: string
  riskLevel: TravelRiskLevel
}): TravelBrief {
  const { travelerName, destination, countryCode, departure, return: returnDate, purpose, riskLevel } = params

  const checkInSchedule = riskLevel >= 4
    ? 'Every 12 hours via designated comms channel. Miss = emergency protocol activated.'
    : riskLevel >= 3
    ? 'Every 24 hours — morning check-in via Signal/WhatsApp.'
    : 'Daily check-in preferred. Missed check-in triggers 4-hour follow-up.'

  const preDeparture = [
    'Register with home country embassy/consulate (STEP program or equivalent)',
    'Obtain comprehensive travel insurance including medical evacuation',
    'Carry physical copies of passport, visa, insurance docs',
    'Brief next-of-kin on itinerary and emergency contact procedures',
    'Download offline maps for destination region',
    ...(riskLevel >= 3 ? [
      'Complete hostile environment awareness training (HEAT) if not current',
      'Establish emergency extraction plan with security team',
      'Brief organization security officer on itinerary',
      'Purchase satellite communicator (Garmin inReach or equivalent)',
    ] : []),
    ...(riskLevel >= 4 ? [
      'Obtain security escort approval from organization leadership',
      'Pre-position emergency funds at destination',
      'Establish safe houses / alternative accommodations',
      'Brief medical team on blood type and allergies',
    ] : []),
  ]

  return {
    traveler_name: travelerName,
    destination,
    country_code: countryCode,
    departure,
    return: returnDate,
    purpose,
    risk_level: riskLevel,
    pre_departure_checklist: preDeparture,
    emergency_contacts: [
      'Organization Security Officer: [SET IN ORG SETTINGS]',
      `Local embassy emergency: [SET IN COUNTRY SETTINGS]`,
      'GEOS Global Emergency: +1-713-334-3837',
      'International SOS: +1-215-942-8000',
    ],
    medical_requirements: [
      'Verify routine vaccinations are up to date',
      ...(riskLevel >= 3 ? ['Travel health consultation recommended 4-6 weeks prior'] : []),
    ],
    communications_plan: riskLevel >= 4
      ? 'Primary: encrypted messaging (Signal). Secondary: satellite phone. Tertiary: embassy contact.'
      : 'Primary: WhatsApp/Signal. Check-in with designated contact per schedule.',
    extraction_plan: riskLevel >= 4
      ? 'Extraction route pre-identified. Rally point: [SET IN MISSION SETTINGS]. Code word: [CONFIGURE IN SETTINGS].'
      : 'Follow standard organizational emergency procedures. Contact security officer.',
    check_in_schedule: checkInSchedule,
    generated_at: new Date().toISOString(),
  }
}
