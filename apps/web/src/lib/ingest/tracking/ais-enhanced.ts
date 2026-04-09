/**
 * Enhanced AIS Vessel Tracking with Dark Ship Detection and Route Anomalies
 *
 * Builds on the basic ais.ts with:
 * - Dark vessel detection (AIS transponder off in conflict zones)
 * - Unusual route pattern detection
 * - Correlation signal generation for suspicious activity
 * - Integration with sanctions monitoring
 */

import { createServiceClient } from '@/lib/supabase/server'

export const CONFLICT_MARITIME_ZONES = [
  { name: 'Red Sea',           bbox: [[11.0, 32.0], [30.0, 44.0]], country: 'YE', risk_level: 'high' as const },
  { name: 'Gulf of Aden',      bbox: [[10.0, 43.0], [15.0, 52.0]], country: 'YE', risk_level: 'high' as const },
  { name: 'Strait of Hormuz',  bbox: [[22.0, 55.0], [27.0, 60.0]], country: 'IR', risk_level: 'critical' as const },
  { name: 'Persian Gulf',      bbox: [[24.0, 47.0], [30.0, 57.0]], country: 'IR', risk_level: 'critical' as const },
  { name: 'Black Sea',         bbox: [[40.5, 27.5], [47.5, 41.5]], country: 'RU', risk_level: 'high' as const },
  { name: 'Mediterranean',     bbox: [[30.0, 5.0], [46.0, 42.0]], country: 'SY', risk_level: 'medium' as const },
  { name: 'South China Sea',   bbox: [[0.0, 99.0], [25.0, 125.0]], country: 'CN', risk_level: 'medium' as const },
  { name: 'Taiwan Strait',     bbox: [[21.0, 119.0], [27.0, 122.0]], country: 'TW', risk_level: 'high' as const },
] as const

export type DarkVesselAlert = {
  mmsi: number
  ship_name: string | null
  flag: string | null
  last_known_zone: string
  last_seen: string
  hours_silent: number
  suspected_evasion: boolean
}

export type RouteAnomalyAlert = {
  mmsi: number
  ship_name: string | null
  flag: string | null
  current_zone: string
  deviation_type: 'sudden_course_change' | 'unrealistic_speed' | 'unscheduled_stop'
  description: string
}

/**
 * Detect vessels that have gone dark in conflict zones
 * A vessel is "dark" if it was transmitting in a conflict zone but now silent for >6 hours
 */
export async function detectDarkVessels(): Promise<DarkVesselAlert[]> {
  const supabase = createServiceClient()
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Find vessels that were seen in conflict zones but have gone silent
  const { data: darkVessels } = await supabase
    .from('maritime_tracks')
    .select('mmsi, ship_name, flag, zone_name, last_seen, speed, nav_status')
    .lt('last_seen', sixHoursAgo)
    .gt('last_seen', twentyFourHoursAgo)
    .not('zone_name', 'is', null)

  if (!darkVessels?.length) return []

  const alerts: DarkVesselAlert[] = []
  const now = new Date()

  for (const vessel of darkVessels) {
    const lastSeenDate = new Date(vessel.last_seen as string)
    const hoursSilent = Math.round((now.getTime() - lastSeenDate.getTime()) / (60 * 60 * 1000))

    // Check if vessel is in a high-risk zone
    const zoneInfo = CONFLICT_MARITIME_ZONES.find(z => z.name === vessel.zone_name)
    if (!zoneInfo) continue

    // Determine if this looks like sanctions evasion
    // Vessels evading often have: no flag (stateless), anomalous speed patterns, or sudden stops
    const suspectedEvasion = !vessel.flag || vessel.flag === 'UNKNOWN' ||
                            (vessel.speed as number) === 0 && (vessel.nav_status as number) !== 1

    const alert: DarkVesselAlert = {
      mmsi: vessel.mmsi as number,
      ship_name: vessel.ship_name as string | null,
      flag: vessel.flag as string | null,
      last_known_zone: vessel.zone_name as string,
      last_seen: vessel.last_seen as string,
      hours_silent: hoursSilent,
      suspected_evasion: suspectedEvasion,
    }

    alerts.push(alert)

    // Generate correlation signal for dark vessels in critical zones
    if (zoneInfo.risk_level === 'critical' || suspectedEvasion) {
      await supabase.from('correlation_signals').insert({
        signal_type: 'vessel_dark_critical',
        title: `DARK VESSEL: ${vessel.ship_name || vessel.mmsi} in ${vessel.zone_name}`,
        description: `Vessel has not transmitted AIS for ${hoursSilent} hours. Last position: ${vessel.zone_name}. Flag: ${vessel.flag || 'Unknown'}. ${suspectedEvasion ? 'Indicators consistent with sanctions evasion.' : ''}`,
        severity: suspectedEvasion ? 'critical' : 'high',
        region: zoneInfo.country,
        confidence: 0.85,
        signal_sources: {
          mmsi: vessel.mmsi,
          zone: vessel.zone_name,
          hours_silent: hoursSilent,
          suspected_evasion: suspectedEvasion,
        },
      })
    }
  }

  return alerts
}

/**
 * Detect unusual routing patterns:
 * 1. Sudden course changes in conflict zones
 * 2. Unrealistic speeds (too fast for ship type or too slow given heading)
 * 3. Unscheduled stops in anomalous locations
 */
export async function detectRouteAnomalies(): Promise<RouteAnomalyAlert[]> {
  const supabase = createServiceClient()
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Get recent vessel positions in conflict zones
  const { data: recentVessels } = await supabase
    .from('maritime_tracks')
    .select('mmsi, ship_name, flag, zone_name, last_seen, speed, course, heading, nav_status')
    .gte('last_seen', twoHoursAgo)
    .not('zone_name', 'is', null)

  if (!recentVessels?.length) return []

  const alerts: RouteAnomalyAlert[] = []

  for (const vessel of recentVessels) {
    const zoneInfo = CONFLICT_MARITIME_ZONES.find(z => z.name === vessel.zone_name)
    if (!zoneInfo) continue

    // Pattern 1: Unrealistic speed
    // Most cargo ships: 10-20 knots, tankers: 12-16, fishing: 5-10, military: up to 35
    const speed = vessel.speed as number
    const course = vessel.course as number
    const heading = vessel.heading as number
    const navStatus = vessel.nav_status as number

    if (speed > 40 && zoneInfo.risk_level === 'critical') {
      alerts.push({
        mmsi: vessel.mmsi as number,
        ship_name: vessel.ship_name as string | null,
        flag: vessel.flag as string | null,
        current_zone: vessel.zone_name as string,
        deviation_type: 'unrealistic_speed',
        description: `Vessel traveling at ${speed} knots in ${vessel.zone_name}. High-speed transits may indicate military activity or evasion.`,
      })
    }

    // Pattern 2: Sudden stops in anomalous locations (nav_status 0=underway, 1=anchored, 5=moored)
    if (speed === 0 && navStatus !== 1 && navStatus !== 5 && zoneInfo.risk_level !== 'critical') {
      // Stopped but nav_status suggests underway or undefined - anomalous
      alerts.push({
        mmsi: vessel.mmsi as number,
        ship_name: vessel.ship_name as string | null,
        flag: vessel.flag as string | null,
        current_zone: vessel.zone_name as string,
        deviation_type: 'unscheduled_stop',
        description: `Vessel stopped unexpectedly in ${vessel.zone_name}. No anchoring notification. May indicate emergency, mechanical failure, or deliberate evasion.`,
      })
    }

    // Pattern 3: Course deviation analysis
    // If course and heading differ significantly, may indicate system tampering or distress
    const courseDiff = Math.abs((course as number) - (heading as number))
    if (courseDiff > 30 && speed > 5 && zoneInfo.risk_level === 'critical') {
      alerts.push({
        mmsi: vessel.mmsi as number,
        ship_name: vessel.ship_name as string | null,
        flag: vessel.flag as string | null,
        current_zone: vessel.zone_name as string,
        deviation_type: 'sudden_course_change',
        description: `Large discrepancy between course (${course}°) and heading (${heading}°). May indicate GPS spoofing, system failure, or manual override.`,
      })
    }
  }

  return alerts
}

/**
 * Cross-reference dark vessels with sanctions entities
 * If a dark vessel's flag or name matches a sanctioned entity, escalate severity
 */
export async function flagSanctionedDarkVessels(): Promise<number> {
  const supabase = createServiceClient()
  const darkVessels = await detectDarkVessels()

  let flagged = 0

  for (const vessel of darkVessels) {
    // Look for sanctions matches on vessel flag or name
    const searchTerms = [vessel.flag, vessel.ship_name].filter(Boolean) as string[]

    for (const term of searchTerms) {
      const { data: sanctions } = await supabase
        .from('sanctions_entities')
        .select('id, entity_name, program')
        .ilike('entity_name', `%${term}%`)
        .limit(1)

      if (sanctions?.length) {
        // This vessel matches a sanctioned entity - escalate
        const zoneInfo = CONFLICT_MARITIME_ZONES.find(z => z.name === vessel.last_known_zone)
        const sanctionsRecord = sanctions[0] as Record<string, unknown>

        await supabase.from('correlation_signals').insert({
          signal_type: 'sanctioned_vessel_dark',
          title: `CRITICAL: Sanctioned vessel dark - ${vessel.ship_name || vessel.mmsi}`,
          description: `Vessel "${vessel.ship_name || vessel.mmsi}" (Flag: ${vessel.flag}) matches sanctioned entity "${String(sanctionsRecord.entity_name)}" (Program: ${String(sanctionsRecord.program)}). Has been silent for ${vessel.hours_silent} hours in ${vessel.last_known_zone}. Possible sanctions evasion in progress.`,
          severity: 'critical',
          region: zoneInfo?.country || 'UN',
          confidence: 0.95,
          signal_sources: {
            mmsi: vessel.mmsi,
            sanctions_entity_id: sanctionsRecord.id,
            vessel_flag: vessel.flag,
            hours_silent: vessel.hours_silent,
          },
        })

        flagged++
      }
    }
  }

  return flagged
}

/**
 * Main enhancement function: run all detections
 */
export async function enhanceVesselIntelligence(): Promise<{
  dark_vessels: DarkVesselAlert[]
  route_anomalies: RouteAnomalyAlert[]
  sanctioned_dark_flagged: number
}> {
  const [darkVessels, anomalies, sanctionedCount] = await Promise.all([
    detectDarkVessels(),
    detectRouteAnomalies(),
    flagSanctionedDarkVessels(),
  ])

  return {
    dark_vessels: darkVessels,
    route_anomalies: anomalies,
    sanctioned_dark_flagged: sanctionedCount,
  }
}
