/**
 * Geolocation Verification Engine
 * Techniques: shadow analysis, metadata extraction, landmark matching,
 * reverse geocoding, satellite cross-reference
 *
 * This is a structured workflow for OSINT analysts — NOT fully automated.
 * The engine scaffolds the process; humans make final calls.
 *
 * CONFIDENCE TIERS:
 * - CONFIRMED: Multiple independent sources agree, metadata consistent
 * - PROBABLE: Strong indicators, minor inconsistencies
 * - POSSIBLE: Some evidence, requires further corroboration
 * - UNVERIFIED: Insufficient evidence
 * - FALSE: Evidence contradicts claimed location/time
 */

export type GeoVerificationTier = 'confirmed' | 'probable' | 'possible' | 'unverified' | 'false'

export type VerificationCheck = {
  method: string
  result: 'pass' | 'fail' | 'inconclusive' | 'pending'
  notes: string
  analyst?: string
  timestamp: string
}

export type GeoVerification = {
  id: string
  source_url: string
  claimed_location: string | null
  claimed_time: string | null
  assigned_lat: number | null
  assigned_lng: number | null
  tier: GeoVerificationTier
  confidence_score: number  // 0-100
  checks: VerificationCheck[]
  notes: string
  analyst_id: string | null
  created_at: string
  updated_at: string
}

export type CreateVerificationInput = {
  source_url: string
  claimed_location?: string
  claimed_time?: string
  initial_lat?: number
  initial_lng?: number
  notes?: string
  analyst_id?: string
}

export const VERIFICATION_METHODS = [
  { id: 'metadata', label: 'EXIF / Metadata', description: 'Extract and verify image/video metadata (timestamps, GPS, device)' },
  { id: 'shadow', label: 'Shadow Analysis', description: 'Compare shadow angles to sun position at claimed time/location' },
  { id: 'landmark', label: 'Landmark Matching', description: 'Match buildings, terrain, signage to satellite/street imagery' },
  { id: 'satellite', label: 'Satellite Cross-ref', description: 'Compare with Sentinel-2, Planet, or Maxar imagery from same date' },
  { id: 'reverse_geo', label: 'Reverse Geocoding', description: 'Cross-reference claimed location against administrative boundaries' },
  { id: 'social_context', label: 'Social Context', description: 'Cross-reference with other posts from same location/time window' },
  { id: 'weather', label: 'Weather Verification', description: 'Compare visible weather conditions to historical meteorological data' },
  { id: 'language', label: 'Language/Signs', description: 'Verify language on signs, license plates, uniforms against claimed country' },
] as const

/**
 * Compute confidence score from completed checks
 * Weighted by method reliability
 */
export function computeConfidenceScore(checks: VerificationCheck[]): number {
  const weights: Record<string, number> = {
    metadata: 25, shadow: 20, landmark: 25, satellite: 30,
    reverse_geo: 10, social_context: 15, weather: 15, language: 10,
  }

  let score = 0
  let maxPossible = 0

  for (const check of checks) {
    const method = VERIFICATION_METHODS.find(m => m.label.toLowerCase().includes(check.method.toLowerCase()))
    const weight = method ? (weights[method.id] ?? 10) : 10
    maxPossible += weight

    if (check.result === 'pass') score += weight
    else if (check.result === 'inconclusive') score += weight * 0.3
    else if (check.result === 'fail') score -= weight * 0.5 // penalty for contradictions
  }

  if (maxPossible === 0) return 0
  return Math.max(0, Math.min(100, Math.round((score / maxPossible) * 100)))
}

/**
 * Determine verification tier from confidence score + checks
 */
export function scoreToTier(score: number, checks: VerificationCheck[]): GeoVerificationTier {
  const hasFail = checks.some(c => c.result === 'fail')
  const failCount = checks.filter(c => c.result === 'fail').length
  const passCount = checks.filter(c => c.result === 'pass').length

  if (failCount > passCount) return 'false'
  if (score >= 80) return 'confirmed'
  if (score >= 60) return 'probable'
  if (score >= 35) return 'possible'
  return 'unverified'
}

export const TIER_COLORS: Record<GeoVerificationTier, string> = {
  confirmed: '#10B981',
  probable: '#3B82F6',
  possible: '#F59E0B',
  unverified: '#8B949E',
  false: '#EF4444',
}

export const TIER_LABELS: Record<GeoVerificationTier, string> = {
  confirmed: '✓ CONFIRMED',
  probable: '◈ PROBABLE',
  possible: '◯ POSSIBLE',
  unverified: '? UNVERIFIED',
  false: '✗ FALSE',
}
