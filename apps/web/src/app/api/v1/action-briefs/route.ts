export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateEarlyWarning } from '@/lib/intelligence/early-warning'
import { detectConflictPhase } from '@/lib/intelligence/conflict-phases'
import { generatePrescriptiveActions, RiskContext, UserPersona, ConflictPhase } from '@/lib/intelligence/prescriptive-actions'

// Map country codes to country names
const countryNames: Record<string, string> = {
  'SY': 'Syria',
  'UA': 'Ukraine',
  'YE': 'Yemen',
  'SO': 'Somalia',
  'MM': 'Myanmar',
  'SS': 'South Sudan',
  'AF': 'Afghanistan',
  'PK': 'Pakistan',
  'NG': 'Nigeria',
  'CD': 'Democratic Republic of Congo',
  'ZA': 'South Africa',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'IN': 'India',
  'TH': 'Thailand',
  'VE': 'Venezuela',
  'IQ': 'Iraq',
  'SN': 'Senegal',
  'KE': 'Kenya',
  'ET': 'Ethiopia',
}

/**
 * Convert conflict phase from detector format to prescriptive actions format
 */
function mapConflictPhase(detectedPhase: string): ConflictPhase {
  const mapping: Record<string, ConflictPhase> = {
    'DORMANT': 'dormant',
    'EMERGING': 'emerging',
    'ESCALATION': 'escalation',
    'CRISIS': 'crisis',
    'DE_ESCALATION': 'de-escalation',
  }
  return mapping[detectedPhase] || 'dormant'
}

/**
 * Convert trajectory direction to trend direction
 */
function mapTrendDirection(direction: string): 'improving' | 'stable' | 'deteriorating' {
  if (direction === 'improving' || direction === 'stable' || direction === 'deteriorating') return direction
  return 'stable'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const countryCode = searchParams.get('country_code')
    const personaParam = searchParams.get('persona')

    // country_code is required
    if (!countryCode) {
      return NextResponse.json(
        {
          success: false,
          error: 'country_code query parameter is required',
        },
        { status: 400 }
      )
    }

    const countryCodeUpper = countryCode.toUpperCase()
    const countryName = countryNames[countryCodeUpper] || countryCodeUpper

    // Step 1: Get early warning assessment
    const earlyWarningData = await calculateEarlyWarning(countryCodeUpper)

    // Step 2: Get conflict phase assessment
    const conflictPhaseData = await detectConflictPhase(countryCodeUpper)

    // Step 3: Query recent events to populate activeThreats
    const supabase = createServiceClient()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentEvents } = await supabase
      .from('events')
      .select('id, event_type, severity, casualty_estimate, entities')
      .eq('country_code', countryCodeUpper)
      .gte('occurred_at', thirtyDaysAgo)
      .order('occurred_at', { ascending: false })
      .limit(50)

    // Count casualties and extract top event types
    let totalCasualties = 0
    const eventTypeMap: Record<string, { severity: number; count: number }> = {}

    if (recentEvents) {
      for (const evt of recentEvents) {
        const casualtyEstimate = (evt.casualty_estimate as number) || 0
        totalCasualties += casualtyEstimate

        const eventType = (evt.event_type as string) || 'unknown'
        if (!eventTypeMap[eventType]) {
          eventTypeMap[eventType] = { severity: 0, count: 0 }
        }
        eventTypeMap[eventType].severity = Math.max(eventTypeMap[eventType].severity, (evt.severity as number) || 0)
        eventTypeMap[eventType].count += 1
      }
    }

    const activeThreats = Object.entries(eventTypeMap)
      .map(([eventType, data]) => ({
        title: eventType.replace(/_/g, ' ').toUpperCase(),
        severity: data.severity,
        event_type: eventType,
      }))
      .slice(0, 5)

    // Step 4: Build RiskContext
    const threatCategories = Object.entries(earlyWarningData.threat_scores).map(([category, score]) => ({
      category,
      score,
    }))

    const riskContext: RiskContext = {
      countryCode: countryCodeUpper,
      countryName,
      region: countryCodeUpper, // Simplified; could be enhanced with geo lookup
      warningLevel: earlyWarningData.warning_level,
      threatCategories,
      conflictPhase: mapConflictPhase(conflictPhaseData.currentPhase),
      trendDirection: mapTrendDirection(earlyWarningData.trajectory.direction),
      activeThreats,
      casualtyEstimate30d: totalCasualties,
      eventCount30d: recentEvents?.length || 0,
      topActors: earlyWarningData.trigger_events
        .slice(0, 3)
        .flatMap(evt => evt.primary_actors)
        .filter((v, i, a) => a.indexOf(v) === i),
    }

    // Step 5: Generate prescriptive actions
    const report = generatePrescriptiveActions(riskContext)

    // Step 6: Filter by persona if provided
    if (personaParam && ['corporate', 'humanitarian', 'government', 'investor'].includes(personaParam)) {
      // Map short persona names to full persona names
      const personaMapping: Record<string, UserPersona> = {
        'corporate': 'corporate_risk_manager',
        'humanitarian': 'humanitarian_operator',
        'government': 'government_diplomatic',
        'investor': 'investor_financial',
      }

      const fullPersona = personaMapping[personaParam]
      if (fullPersona) {
        report.actions = report.actions.filter(action => action.personas.includes(fullPersona))

        // Update persona breakdown to show only selected persona
        report.personaBreakdown = report.personaBreakdown.filter(p => p.persona === fullPersona)
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: report,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300',
        },
      }
    )
  } catch (error) {
    console.error('[action-briefs] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate action briefs',
      },
      { status: 500 }
    )
  }
}
