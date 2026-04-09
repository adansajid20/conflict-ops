export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Population estimates for top 80 countries (approx 2024)
const COUNTRY_PROFILES: Record<string, { name: string; region: string; population: number }> = {
  IN: { name: 'India', region: 'South Asia', population: 1425776000 },
  CN: { name: 'China', region: 'East Asia', population: 1425887337 },
  US: { name: 'United States', region: 'North America', population: 345426571 },
  ID: { name: 'Indonesia', region: 'Southeast Asia', population: 277534122 },
  PK: { name: 'Pakistan', region: 'South Asia', population: 240485658 },
  BR: { name: 'Brazil', region: 'South America', population: 216422446 },
  NG: { name: 'Nigeria', region: 'West Africa', population: 223804632 },
  BD: { name: 'Bangladesh', region: 'South Asia', population: 173562364 },
  RU: { name: 'Russia', region: 'Eastern Europe', population: 144713314 },
  MX: { name: 'Mexico', region: 'North America', population: 128932753 },
  ET: { name: 'Ethiopia', region: 'East Africa', population: 125144276 },
  EG: { name: 'Egypt', region: 'North Africa', population: 110672382 },
  JP: { name: 'Japan', region: 'East Asia', population: 123294513 },
  PH: { name: 'Philippines', region: 'Southeast Asia', population: 120460422 },
  TR: { name: 'Turkey', region: 'Western Asia', population: 87005201 },
  DE: { name: 'Germany', region: 'Central Europe', population: 84457414 },
  TH: { name: 'Thailand', region: 'Southeast Asia', population: 71801915 },
  GB: { name: 'United Kingdom', region: 'Western Europe', population: 67736802 },
  FR: { name: 'France', region: 'Western Europe', population: 65613201 },
  TZ: { name: 'Tanzania', region: 'East Africa', population: 65497748 },
  ZA: { name: 'South Africa', region: 'Southern Africa', population: 60142978 },
  IT: { name: 'Italy', region: 'Southern Europe', population: 57888488 },
  KE: { name: 'Kenya', region: 'East Africa', population: 54027487 },
  MM: { name: 'Myanmar', region: 'Southeast Asia', population: 54612784 },
  CO: { name: 'Colombia', region: 'South America', population: 52085168 },
  ES: { name: 'Spain', region: 'Southern Europe', population: 47617293 },
  UG: { name: 'Uganda', region: 'East Africa', population: 48825209 },
  DZ: { name: 'Algeria', region: 'North Africa', population: 45903656 },
  KR: { name: 'South Korea', region: 'East Asia', population: 51784059 },
  SD: { name: 'Sudan', region: 'Northeast Africa', population: 46873192 },
  UA: { name: 'Ukraine', region: 'Eastern Europe', population: 38000000 },
  IQ: { name: 'Iraq', region: 'Middle East', population: 45504582 },
  AF: { name: 'Afghanistan', region: 'South Asia', population: 40099462 },
  AR: { name: 'Argentina', region: 'South America', population: 46605914 },
  CD: { name: 'Democratic Republic of Congo', region: 'Central Africa', population: 95894113 },
  MA: { name: 'Morocco', region: 'North Africa', population: 37744086 },
  SA: { name: 'Saudi Arabia', region: 'Middle East', population: 34813629 },
  PL: { name: 'Poland', region: 'Central Europe', population: 37840035 },
  AO: { name: 'Angola', region: 'Southern Africa', population: 35588987 },
  UZ: { name: 'Uzbekistan', region: 'Central Asia', population: 35163541 },
  PE: { name: 'Peru', region: 'South America', population: 34352719 },
  MY: { name: 'Malaysia', region: 'Southeast Asia', population: 34451701 },
  YE: { name: 'Yemen', region: 'Middle East', population: 30496017 },
  GH: { name: 'Ghana', region: 'West Africa', population: 34121985 },
  AE: { name: 'United Arab Emirates', region: 'Middle East', population: 9890400 },
  MZ: { name: 'Mozambique', region: 'Southern Africa', population: 32969518 },
  NE: { name: 'Niger', region: 'West Africa', population: 28940103 },
  VN: { name: 'Vietnam', region: 'Southeast Asia', population: 98186856 },
  CI: { name: 'Côte d\'Ivoire', region: 'West Africa', population: 28160357 },
  CM: { name: 'Cameroon', region: 'Central Africa', population: 28915993 },
  MW: { name: 'Malawi', region: 'Southern Africa', population: 20676143 },
  SN: { name: 'Senegal', region: 'West Africa', population: 18165714 },
  ZM: { name: 'Zambia', region: 'Southern Africa', population: 19610313 },
  SO: { name: 'Somalia', region: 'East Africa', population: 18143378 },
  LS: { name: 'Lesotho', region: 'Southern Africa', population: 2305825 },
  LY: { name: 'Libya', region: 'North Africa', population: 7064192 },
  SY: { name: 'Syria', region: 'Middle East', population: 22125249 },
  RS: { name: 'Serbia', region: 'Eastern Europe', population: 6664449 },
  LB: { name: 'Lebanon', region: 'Middle East', population: 5489747 },
  TN: { name: 'Tunisia', region: 'North Africa', population: 12365400 },
  KH: { name: 'Cambodia', region: 'Southeast Asia', population: 17168639 },
  ZW: { name: 'Zimbabwe', region: 'Southern Africa', population: 16665411 },
  RW: { name: 'Rwanda', region: 'East Africa', population: 13776698 },
  BF: { name: 'Burkina Faso', region: 'West Africa', population: 23483469 },
  ML: { name: 'Mali', region: 'West Africa', population: 23701132 },
  CF: { name: 'Central African Republic', region: 'Central Africa', population: 5709126 },
  HN: { name: 'Honduras', region: 'Central America', population: 10627090 },
  JO: { name: 'Jordan', region: 'Middle East', population: 10260009 },
  PS: { name: 'Palestine', region: 'Middle East', population: 5222169 },
  IL: { name: 'Israel', region: 'Middle East', population: 9656842 },
  SV: { name: 'El Salvador', region: 'Central America', population: 6041581 },
  BO: { name: 'Bolivia', region: 'South America', population: 12388571 },
  LA: { name: 'Laos', region: 'Southeast Asia', population: 7529475 },
  NP: { name: 'Nepal', region: 'South Asia', population: 30547580 },
  IR: { name: 'Iran', region: 'Middle East', population: 91567416 },
}

// Neighboring countries mapping (for top conflict countries)
const COUNTRY_NEIGHBORS: Record<string, string[]> = {
  UA: ['RU', 'PL', 'SK', 'HU', 'RO', 'MD'],
  RU: ['UA', 'KZ', 'BY', 'GE', 'AZ', 'KR'],
  SY: ['TR', 'IQ', 'JO', 'LB', 'IL', 'PS'],
  YE: ['SA', 'OM'],
  SD: ['EG', 'ET', 'ER', 'SS', 'TD', 'LY'],
  SS: ['SD', 'ET', 'KE', 'UG', 'CD', 'CG'],
  ET: ['EG', 'ER', 'DJ', 'SO', 'KE', 'SD', 'SS'],
  LY: ['TN', 'DZ', 'SD', 'NE', 'TD'],
  IQ: ['SY', 'TR', 'IR', 'SA', 'KW', 'JO'],
  AF: ['IR', 'TM', 'UZ', 'KG', 'PK', 'CN'],
  MM: ['BD', 'IN', 'TH', 'LA'],
  CD: ['AO', 'ZA', 'ZM', 'TZ', 'UG', 'SS', 'CG', 'GA'],
  SO: ['ET', 'KE'],
  ML: ['MR', 'SN', 'BF', 'CI', 'NE', 'DZ'],
  BF: ['ML', 'NE', 'CI', 'GH', 'BJ', 'BW'],
  NE: ['DZ', 'LY', 'TD', 'NE', 'ML', 'BF'],
  CF: ['CM', 'TD', 'SD', 'SS', 'CD', 'CG'],
  MZ: ['ZA', 'BW', 'ZW', 'ZM', 'TZ', 'KE'],
  NG: ['BJ', 'NE', 'NE', 'CM', 'GA'],
  CM: ['NG', 'NE', 'TD', 'CF', 'CG', 'GQ', 'GA'],
  PS: ['IL', 'JO', 'EG'],
  IL: ['PS', 'JO', 'SY', 'LB'],
  LB: ['SY', 'IL'],
  IR: ['AF', 'AM', 'AZ', 'IQ', 'KW', 'OM', 'PK', 'TM', 'TR'],
  PK: ['AF', 'CN', 'IR', 'IN'],
}

// Risk category to event type/category mapping
const RISK_CATEGORY_MAPPING: Record<string, { eventTypes?: string[]; categories?: string[]; isHumanitarianFlag?: boolean }> = {
  'Political Stability': { eventTypes: ['political_violence', 'election_related', 'protest', 'government_crisis'], categories: ['political_violence', 'government', 'elections'] },
  'Armed Conflict': { eventTypes: ['battle', 'armed_clash', 'explosion', 'violence_against_civilians'], categories: ['armed_conflict', 'military', 'military_action'] },
  'Terrorism': { eventTypes: ['terrorism', 'bombing', 'terrorist_attack'], categories: ['terrorism', 'terrorism_attacks'] },
  'Civil Unrest': { eventTypes: ['protest', 'riot', 'civil_unrest', 'demonstration'], categories: ['civil_unrest', 'demonstrations', 'protest'] },
  'Crime & Safety': { eventTypes: ['crime', 'robbery', 'kidnapping', 'organized_crime'], categories: ['crime', 'organized_crime', 'kidnapping'] },
  'Economic Stability': { eventTypes: ['economic_crisis', 'currency_crisis', 'trade_disruption', 'sanctions'], categories: ['economic_crisis', 'economic_decline', 'trade_disruption'] },
  'Humanitarian Crisis': { categories: ['humanitarian_crisis', 'displacement', 'famine', 'refugee'], isHumanitarianFlag: true },
  'Environmental Risk': { eventTypes: ['earthquake', 'flooding', 'wildfire', 'volcanic_eruption'], categories: ['natural_disaster', 'environmental'] },
  'Cyber Threats': { eventTypes: ['cyberattack', 'data_breach'], categories: ['cyber', 'cybersecurity'] },
  'Regional Spillover': { eventTypes: ['cross_border', 'refugee_crisis'], categories: ['cross_border_conflict', 'refugee_crisis'] },
}

// Travel advisory level (1-4 scale)
function calculateTravelAdvisory(severity: number, eventCount24h: number, criticalCount24h: number): number {
  if (criticalCount24h > 0) return 4 // Highest severity
  if (severity >= 4 || eventCount24h > 10) return 4
  if (severity >= 3 || eventCount24h > 5) return 3
  if (severity >= 2 || eventCount24h > 2) return 2
  if (eventCount24h > 0) return 1
  return 1 // Default
}

interface RiskBreakdown {
  [key: string]: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const countryCode = code.toUpperCase()

    // Validate country code
    if (!COUNTRY_PROFILES[countryCode]) {
      return NextResponse.json(
        { error: `Country code ${countryCode} not found in database` },
        { status: 404 }
      )
    }

    const supabase = createServiceClient()
    const profile = COUNTRY_PROFILES[countryCode]!

    // Query time windows
    const now = new Date()
    const h7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const h30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const h90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const h24d = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // Fetch events for this country
    const { data: eventsAll } = await supabase
      .from('events')
      .select('id, occurred_at, severity, event_type, category, entities, escalation_indicator, significance_score, casualty_estimate, actor_ids, is_humanitarian_report')
      .eq('country_code', countryCode)
      .order('occurred_at', { ascending: false })

    // Calculate statistics
    const events7d = eventsAll?.filter(e => new Date(e.occurred_at || '').getTime() > new Date(h7d).getTime()) || []
    const events30d = eventsAll?.filter(e => new Date(e.occurred_at || '').getTime() > new Date(h30d).getTime()) || []
    const events90d = eventsAll?.filter(e => new Date(e.occurred_at || '').getTime() > new Date(h90d).getTime()) || []
    const events24h = eventsAll?.filter(e => new Date(e.occurred_at || '').getTime() > new Date(h24d).getTime()) || []

    // Calculate max severity
    const maxSeverity = Math.max(...(eventsAll?.map(e => e.severity || 0) || [0]))

    // Risk breakdown by category (0-100 scale)
    const riskBreakdown: RiskBreakdown = {}
    for (const [category, mapping] of Object.entries(RISK_CATEGORY_MAPPING)) {
      const relevantEvents = eventsAll?.filter(e => {
        const eventTypeMatch = mapping.eventTypes?.some(t => e.event_type?.toLowerCase().includes(t))
        const categoryMatch = mapping.categories?.some(c => e.category?.toLowerCase().includes(c))
        const humanitarianMatch = mapping.isHumanitarianFlag && e.is_humanitarian_report
        return eventTypeMatch || categoryMatch || humanitarianMatch
      }) || []

      // Score: based on count and severity
      let score = 0
      if (relevantEvents.length > 0) {
        const avgSeverity = relevantEvents.reduce((sum, e) => sum + (e.severity || 0), 0) / relevantEvents.length
        const recency = relevantEvents.length > 0 ? Math.max(0, (4 - Math.max(1, (now.getTime() - new Date(relevantEvents[0]?.occurred_at || now).getTime()) / (1000 * 60 * 60 * 24))) / 3) : 0
        score = Math.min(100, (relevantEvents.length * 5 + avgSeverity * 15 + recency * 20))
      }
      riskBreakdown[category] = Math.round(score)
    }

    // Severity distribution
    const severityDist = {
      critical: events30d.filter(e => (e.severity || 0) >= 4).length,
      high: events30d.filter(e => (e.severity || 0) === 3).length,
      medium: events30d.filter(e => (e.severity || 0) === 2).length,
      low: events30d.filter(e => (e.severity || 0) === 1).length,
    }

    // Top event types
    const eventTypeCount = new Map<string, number>()
    events30d.forEach(e => {
      const type = e.event_type || 'unknown'
      eventTypeCount.set(type, (eventTypeCount.get(type) || 0) + 1)
    })
    const topEventTypes = Array.from(eventTypeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }))

    // Total casualties
    const totalCasualties = events30d.reduce((sum, e) => sum + (e.casualty_estimate || 0), 0)

    // Top actors
    const actorCount = new Map<string, number>()
    events30d.forEach(e => {
      if (e.actor_ids && Array.isArray(e.actor_ids)) {
        e.actor_ids.forEach((actorId: string) => {
          actorCount.set(actorId, (actorCount.get(actorId) || 0) + 1)
        })
      }
    })
    const topActors = Array.from(actorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([actorId, count]) => ({ actorId, count }))

    // Active threats (top 5 critical/high events)
    const activeThreats = events30d
      .filter(e => (e.severity || 0) >= 3)
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        title: (e.entities as unknown as Record<string, unknown>)?.['title'] || 'Unknown Event',
        severity: e.severity,
        occurred_at: e.occurred_at,
        escalation_indicator: e.escalation_indicator,
        significance_score: e.significance_score,
      }))

    // Trend analysis (comparing 30d vs prior 30d)
    const priorH60d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const events30dPrior = eventsAll?.filter(e => {
      const time = new Date(e.occurred_at || '').getTime()
      return time > new Date(priorH60d).getTime() && time <= new Date(h30d).getTime()
    }) || []
    const trend = events30d.length > events30dPrior.length * 1.2 ? 'escalating' : events30d.length < events30dPrior.length * 0.8 ? 'de_escalating' : 'stable'

    // Neighboring country risks
    const neighbors = (COUNTRY_NEIGHBORS[countryCode] || []).slice(0, 5)
    const { data: neighborRisks } = await supabase
      .from('country_risk_scores')
      .select('country_code, risk_score')
      .in('country_code', neighbors)

    const neighboringRisks = neighbors.map(neighborCode => ({
      country_code: neighborCode,
      country_name: COUNTRY_PROFILES[neighborCode]?.name || neighborCode,
      risk_level: neighborRisks?.find(r => r.country_code === neighborCode)?.risk_score || null,
    }))

    // Travel advisory
    const travelAdvisory = calculateTravelAdvisory(maxSeverity, events24h.length, severityDist.critical)

    return NextResponse.json({
      metadata: {
        generated_at: now.toISOString(),
        country_code: countryCode,
        api_version: 'v1',
      },
      country_profile: {
        name: profile.name,
        region: profile.region,
        population_estimate: profile.population,
        current_risk_level: travelAdvisory,
      },
      risk_breakdown: riskBreakdown,
      active_threats: activeThreats,
      event_statistics: {
        events_7d: events7d.length,
        events_30d: events30d.length,
        events_90d: events90d.length,
        severity_distribution: severityDist,
        top_event_types: topEventTypes,
        total_casualties_30d: totalCasualties,
      },
      trend_analysis: {
        direction: trend,
        events_30d: events30d.length,
        events_30d_prior: events30dPrior.length,
        change_percent: events30dPrior.length > 0 ? Math.round(((events30d.length - events30dPrior.length) / events30dPrior.length) * 100) : 0,
      },
      key_actors: topActors,
      neighboring_risk: neighboringRisks,
      travel_advisory_level: travelAdvisory,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    })
  } catch (error) {
    console.error('Country brief error:', error)
    return NextResponse.json(
      { error: 'Failed to generate country brief', details: String(error) },
      { status: 500 }
    )
  }
}
