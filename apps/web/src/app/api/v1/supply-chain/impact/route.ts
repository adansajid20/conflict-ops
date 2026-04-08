export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/* ================================================================ */
/*  COUNTRY NAME MAPPING                                            */
/* ================================================================ */
const COUNTRY_NAMES: Record<string, string> = {
  // Africa
  'DZ': 'Algeria', 'AO': 'Angola', 'BJ': 'Benin', 'BW': 'Botswana', 'BF': 'Burkina Faso',
  'BI': 'Burundi', 'CM': 'Cameroon', 'CV': 'Cabo Verde', 'CF': 'Central African Republic',
  'TD': 'Chad', 'KM': 'Comoros', 'CG': 'Congo', 'CD': 'Democratic Republic of the Congo',
  'CI': 'Côte d\'Ivoire', 'DJ': 'Djibouti', 'EG': 'Egypt', 'GQ': 'Equatorial Guinea',
  'ER': 'Eritrea', 'SZ': 'Eswatini', 'ET': 'Ethiopia', 'GA': 'Gabon', 'GM': 'Gambia',
  'GH': 'Ghana', 'GN': 'Guinea', 'GW': 'Guinea-Bissau', 'KE': 'Kenya', 'LS': 'Lesotho',
  'LR': 'Liberia', 'LY': 'Libya', 'MG': 'Madagascar', 'MW': 'Malawi', 'ML': 'Mali',
  'MR': 'Mauritania', 'MU': 'Mauritius', 'MA': 'Morocco', 'MZ': 'Mozambique', 'NA': 'Namibia',
  'NE': 'Niger', 'NG': 'Nigeria', 'RW': 'Rwanda', 'ST': 'São Tomé and Príncipe',
  'SN': 'Senegal', 'SC': 'Seychelles', 'SL': 'Sierra Leone', 'SO': 'Somalia', 'ZA': 'South Africa',
  'SS': 'South Sudan', 'SD': 'Sudan', 'TZ': 'Tanzania', 'TG': 'Togo', 'TN': 'Tunisia',
  'UG': 'Uganda', 'EH': 'Western Sahara', 'ZM': 'Zambia', 'ZW': 'Zimbabwe',

  // Americas
  'AG': 'Antigua and Barbuda', 'AR': 'Argentina', 'BS': 'Bahamas', 'BB': 'Barbados',
  'BZ': 'Belize', 'BO': 'Bolivia', 'BR': 'Brazil', 'CA': 'Canada', 'CL': 'Chile',
  'CO': 'Colombia', 'CR': 'Costa Rica', 'CU': 'Cuba', 'DM': 'Dominica',
  'DO': 'Dominican Republic', 'EC': 'Ecuador', 'SV': 'El Salvador', 'GD': 'Grenada',
  'GT': 'Guatemala', 'GY': 'Guyana', 'HT': 'Haiti', 'HN': 'Honduras', 'JM': 'Jamaica',
  'MX': 'Mexico', 'NI': 'Nicaragua', 'PA': 'Panama', 'PY': 'Paraguay', 'PE': 'Peru',
  'KN': 'Saint Kitts and Nevis', 'LC': 'Saint Lucia', 'VC': 'Saint Vincent and the Grenadines',
  'SR': 'Suriname', 'TT': 'Trinidad and Tobago', 'US': 'United States', 'UY': 'Uruguay', 'VE': 'Venezuela',

  // Asia
  'AF': 'Afghanistan', 'AM': 'Armenia', 'AZ': 'Azerbaijan', 'BH': 'Bahrain', 'BD': 'Bangladesh',
  'BT': 'Bhutan', 'BN': 'Brunei', 'KH': 'Cambodia', 'CN': 'China', 'GE': 'Georgia',
  'HK': 'Hong Kong', 'IN': 'India', 'ID': 'Indonesia', 'IR': 'Iran', 'IQ': 'Iraq',
  'IL': 'Israel', 'JP': 'Japan', 'JO': 'Jordan', 'KZ': 'Kazakhstan', 'KP': 'North Korea',
  'KR': 'South Korea', 'KW': 'Kuwait', 'KG': 'Kyrgyzstan', 'LA': 'Laos', 'LB': 'Lebanon',
  'MO': 'Macao', 'MY': 'Malaysia', 'MV': 'Maldives', 'MN': 'Mongolia', 'MM': 'Myanmar',
  'NP': 'Nepal', 'OM': 'Oman', 'PK': 'Pakistan', 'PS': 'Palestine', 'PH': 'Philippines',
  'QA': 'Qatar', 'SA': 'Saudi Arabia', 'SG': 'Singapore', 'LK': 'Sri Lanka', 'SY': 'Syria',
  'TW': 'Taiwan', 'TJ': 'Tajikistan', 'TH': 'Thailand', 'TL': 'Timor-Leste', 'TR': 'Turkey',
  'TM': 'Turkmenistan', 'AE': 'United Arab Emirates', 'UZ': 'Uzbekistan', 'VN': 'Vietnam', 'YE': 'Yemen',

  // Europe
  'AL': 'Albania', 'AD': 'Andorra', 'AT': 'Austria', 'BY': 'Belarus', 'BE': 'Belgium',
  'BA': 'Bosnia and Herzegovina', 'BG': 'Bulgaria', 'HR': 'Croatia', 'CY': 'Cyprus',
  'CZ': 'Czech Republic', 'DK': 'Denmark', 'EE': 'Estonia', 'FI': 'Finland', 'FR': 'France',
  'DE': 'Germany', 'GR': 'Greece', 'HU': 'Hungary', 'IS': 'Iceland', 'IE': 'Ireland',
  'IT': 'Italy', 'XK': 'Kosovo', 'LV': 'Latvia', 'LI': 'Liechtenstein', 'LT': 'Lithuania',
  'LU': 'Luxembourg', 'MT': 'Malta', 'MD': 'Moldova', 'MC': 'Monaco', 'ME': 'Montenegro',
  'NL': 'Netherlands', 'MK': 'North Macedonia', 'NO': 'Norway', 'PL': 'Poland', 'PT': 'Portugal',
  'RO': 'Romania', 'RU': 'Russia', 'SM': 'San Marino', 'RS': 'Serbia', 'SK': 'Slovakia',
  'SI': 'Slovenia', 'ES': 'Spain', 'SE': 'Sweden', 'CH': 'Switzerland', 'UA': 'Ukraine',
  'GB': 'United Kingdom', 'VA': 'Vatican City',

  // Oceania
  'AU': 'Australia', 'FJ': 'Fiji', 'KI': 'Kiribati', 'MH': 'Marshall Islands',
  'FM': 'Micronesia', 'NR': 'Nauru', 'NZ': 'New Zealand', 'PW': 'Palau',
  'PG': 'Papua New Guinea', 'WS': 'Samoa', 'SB': 'Solomon Islands', 'TO': 'Tonga',
  'TV': 'Tuvalu', 'VU': 'Vanuatu',
}

/* ================================================================ */
/*  TYPE DEFINITIONS                                                */
/* ================================================================ */
interface SupplyChainNode {
  id: string
  org_id?: string | null
  country?: string | null
  country_code?: string | null
  node_type?: string | null
  criticality?: string | null
  created_at?: string
}

interface CountryEvent {
  country_code: string
  count: number
  severity_sum: number
  max_severity: number
}

interface CriticalAlert {
  country_code: string
  country_name: string
  node_count: number
  risk_level: 'critical' | 'high' | 'medium' | 'low'
  event_count_30d: number
  top_threats: string[]
  impact_summary: string
  recommended_actions: string[]
}

interface SupplyChainImpactResponse {
  assessment_date: string
  total_nodes_monitored: number
  nodes_at_risk: number
  critical_alerts: CriticalAlert[]
  global_risk_summary: string
  supply_chain_resilience_score: number
}

/* ================================================================ */
/*  HELPER: Determine Risk Level                                    */
/* ================================================================ */
function getRiskLevel(
  eventCount: number,
  maxSeverity: number,
  avgSeverity: number
): 'critical' | 'high' | 'medium' | 'low' {
  if (maxSeverity >= 5 || avgSeverity >= 4 || eventCount > 50) return 'critical'
  if (maxSeverity >= 4 || avgSeverity >= 3 || eventCount > 20) return 'high'
  if (maxSeverity >= 3 || eventCount > 5) return 'medium'
  return 'low'
}

/* ================================================================ */
/*  HELPER: Generate Impact Summary                                 */
/* ================================================================ */
function generateImpactSummary(
  countryName: string,
  eventCount: number,
  riskLevel: string,
  topThreats: string[]
): string {
  const threatList = topThreats.slice(0, 2).join(' and ')
  const severityDesc = {
    critical: 'severely impacted by',
    high: 'significantly affected by',
    medium: 'experiencing',
    low: 'monitoring',
  }

  const desc = severityDesc[riskLevel as keyof typeof severityDesc] || 'affected by'
  return `Supply chain nodes in ${countryName} are ${desc} ${eventCount} geopolitical event${eventCount !== 1 ? 's' : ''} in the past 30 days, primarily ${threatList}.`
}

/* ================================================================ */
/*  HELPER: Generate Recommended Actions                            */
/* ================================================================ */
function generateRecommendedActions(
  riskLevel: string,
  topThreats: string[],
  nodeCount: number
): string[] {
  const actions: string[] = []

  if (riskLevel === 'critical') {
    actions.push('Initiate immediate business continuity review')
    actions.push('Activate alternative supplier agreements')
    actions.push('Consider temporary relocation of critical operations')
  } else if (riskLevel === 'high') {
    actions.push('Review and stress-test supplier contingency plans')
    actions.push('Increase inventory of critical components')
    actions.push('Establish backup sourcing channels')
  } else if (riskLevel === 'medium') {
    actions.push('Monitor situation closely for escalation')
    actions.push('Verify supplier resilience documentation')
  } else {
    actions.push('Continue routine monitoring')
  }

  if (topThreats.includes('armed_conflict') || topThreats.includes('political_unrest')) {
    actions.push('Assess personnel safety and movement restrictions')
  }

  if (topThreats.includes('infrastructure_damage') || topThreats.includes('displacement')) {
    actions.push('Review logistics routing and infrastructure dependencies')
  }

  return actions
}

/* ================================================================ */
/*  MAIN HANDLER                                                    */
/* ================================================================ */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const url = new URL(req.url)
    const org_id = url.searchParams.get('org_id')

    // Fetch supply chain nodes (global or org-specific)
    let nodesQuery = supabase.from('supply_chain_nodes').select('id, org_id, country, country_code, node_type, criticality, created_at')
    if (org_id) {
      nodesQuery = nodesQuery.eq('org_id', org_id)
    }
    const { data: nodes, error: nodesError } = await nodesQuery

    if (nodesError) {
      return NextResponse.json({ error: nodesError.message }, { status: 500 })
    }

    const nodesList = nodes ?? []

    // If no nodes, return global assessment
    if (nodesList.length === 0) {
      return NextResponse.json(getGlobalAssessment())
    }

    // Build country code → node count mapping
    const nodesByCountry = new Map<string, number>()
    const nodesCriticalByCountry = new Map<string, number>()

    for (const node of nodesList) {
      const cc = (node.country_code as string) || ''
      if (!cc || cc.length !== 2) continue
      nodesByCountry.set(cc, (nodesByCountry.get(cc) ?? 0) + 1)

      const criticality = (node.criticality as string) || ''
      if (criticality.toLowerCase() === 'critical') {
        nodesCriticalByCountry.set(cc, (nodesCriticalByCountry.get(cc) ?? 0) + 1)
      }
    }

    // Fetch events from last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, occurred_at, severity, country_code, event_type, category, casualty_estimate')
      .gte('occurred_at', since)
      .in('country_code', [...nodesByCountry.keys()])

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 })
    }

    const eventsList = events ?? []

    // Aggregate events by country
    const eventsByCountry = new Map<string, CountryEvent>()
    for (const event of eventsList) {
      const cc = (event.country_code as string) || ''
      if (!cc || !nodesByCountry.has(cc)) continue

      if (!eventsByCountry.has(cc)) {
        eventsByCountry.set(cc, {
          country_code: cc,
          count: 0,
          severity_sum: 0,
          max_severity: 0,
        })
      }

      const data = eventsByCountry.get(cc)!
      data.count++
      const sev = (event.severity as number) ?? 1
      data.severity_sum += sev
      if (sev > data.max_severity) data.max_severity = sev
    }

    // Build critical alerts for countries with events
    const criticalAlerts: CriticalAlert[] = []
    let nodesAtRisk = 0

    for (const [cc, eventData] of eventsByCountry) {
      const nodeCount = nodesByCountry.get(cc) ?? 0
      const avgSeverity = eventData.count > 0 ? eventData.severity_sum / eventData.count : 0
      const riskLevel = getRiskLevel(eventData.count, eventData.max_severity, avgSeverity)

      // Determine threat types
      const countryEvents = eventsList.filter(e => e.country_code === cc)
      const threatTypeMap = new Map<string, number>()
      for (const event of countryEvents) {
        const t = (event.event_type as string) || 'unknown'
        threatTypeMap.set(t, (threatTypeMap.get(t) ?? 0) + 1)
      }
      const topThreats = [...threatTypeMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t)

      // Generate summaries and actions
      const countryName = COUNTRY_NAMES[cc] || cc
      const impactSummary = generateImpactSummary(countryName, eventData.count, riskLevel, topThreats)
      const recommendedActions = generateRecommendedActions(riskLevel, topThreats, nodeCount)

      criticalAlerts.push({
        country_code: cc,
        country_name: countryName,
        node_count: nodeCount,
        risk_level: riskLevel,
        event_count_30d: eventData.count,
        top_threats: topThreats,
        impact_summary: impactSummary,
        recommended_actions: recommendedActions,
      })

      if (riskLevel === 'critical' || riskLevel === 'high') {
        nodesAtRisk += nodeCount
      }
    }

    // Sort by risk level (critical > high > medium > low) then by event count
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    criticalAlerts.sort((a, b) => {
      const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level]
      return riskDiff !== 0 ? riskDiff : b.event_count_30d - a.event_count_30d
    })

    // Calculate global risk summary
    const globalRiskSummary = generateGlobalRiskSummary(
      nodesList.length,
      nodesAtRisk,
      criticalAlerts.length,
      criticalAlerts.filter(a => a.risk_level === 'critical').length
    )

    // Calculate supply chain resilience score (0-100)
    const resilienceScore = calculateResilienceScore(
      nodesList.length,
      nodesAtRisk,
      eventsList.length,
      [...nodesByCountry.keys()].length
    )

    const response: SupplyChainImpactResponse = {
      assessment_date: new Date().toISOString(),
      total_nodes_monitored: nodesList.length,
      nodes_at_risk: nodesAtRisk,
      critical_alerts: criticalAlerts.slice(0, 20),
      global_risk_summary: globalRiskSummary,
      supply_chain_resilience_score: resilienceScore,
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ================================================================ */
/*  HELPER: Global Assessment (when no org nodes exist)              */
/* ================================================================ */
function getGlobalAssessment(): SupplyChainImpactResponse {
  return {
    assessment_date: new Date().toISOString(),
    total_nodes_monitored: 0,
    nodes_at_risk: 0,
    critical_alerts: [],
    global_risk_summary: 'No supply chain nodes configured. Set up nodes to receive geopolitical impact assessments.',
    supply_chain_resilience_score: 0,
  }
}

/* ================================================================ */
/*  HELPER: Generate Global Risk Summary                            */
/* ================================================================ */
function generateGlobalRiskSummary(
  totalNodes: number,
  nodesAtRisk: number,
  countryCount: number,
  criticalCountries: number
): string {
  const riskPct = totalNodes > 0 ? Math.round((nodesAtRisk / totalNodes) * 100) : 0

  if (criticalCountries > 0) {
    return `${nodesAtRisk} of ${totalNodes} supply chain nodes (${riskPct}%) are at critical or high risk across ${countryCount} countries. Immediate action recommended for ${criticalCountries} critical locations.`
  }

  if (riskPct > 0) {
    return `${nodesAtRisk} of ${totalNodes} supply chain nodes (${riskPct}%) are experiencing medium risk across ${countryCount} countries. Monitor for escalation.`
  }

  return `All ${totalNodes} supply chain nodes are at low risk. Continue routine monitoring.`
}

/* ================================================================ */
/*  HELPER: Calculate Resilience Score                              */
/* ================================================================ */
function calculateResilienceScore(
  totalNodes: number,
  nodesAtRisk: number,
  eventCount: number,
  countryCount: number
): number {
  if (totalNodes === 0) return 0

  // Base score
  let score = 100

  // Deduct for nodes at risk
  const riskRatio = nodesAtRisk / totalNodes
  score -= riskRatio * 40

  // Deduct for event concentration (high events in few countries = less resilient)
  const avgEventsPerCountry = countryCount > 0 ? eventCount / countryCount : 0
  if (avgEventsPerCountry > 20) score -= 20
  else if (avgEventsPerCountry > 10) score -= 10
  else if (avgEventsPerCountry > 5) score -= 5

  // Event volume penalty
  if (eventCount > 100) score -= 15
  else if (eventCount > 50) score -= 10

  return Math.max(0, Math.round(score))
}
