export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Signal domain definitions
interface SignalDomain {
  name: string
  eventTypes?: string[]
  categories?: string[]
  isHumanitarianFlag?: boolean
}

const SIGNAL_DOMAINS: Record<string, SignalDomain> = {
  military: {
    name: 'Military/Conflict',
    eventTypes: ['battle', 'armed_clash', 'explosion', 'violence_against_civilians', 'airstrikes', 'military_operation'],
    categories: ['armed_conflict', 'military', 'military_action', 'combat'],
  },
  political: {
    name: 'Political',
    eventTypes: ['political_violence', 'protest', 'election_related', 'government_crisis', 'coup'],
    categories: ['political_violence', 'government', 'elections', 'political_tension'],
  },
  economic: {
    name: 'Economic',
    eventTypes: ['sanctions', 'trade_disruption', 'economic_crisis', 'currency_crisis', 'embargo'],
    categories: ['economic_crisis', 'economic_decline', 'trade_disruption', 'sanctions'],
  },
  humanitarian: {
    name: 'Humanitarian',
    categories: ['humanitarian_crisis', 'displacement', 'famine', 'refugee', 'disease_outbreak'],
    isHumanitarianFlag: true,
  },
  social: {
    name: 'Social',
    eventTypes: ['civil_unrest', 'demonstration', 'riot', 'strike', 'gang_violence'],
    categories: ['civil_unrest', 'demonstrations', 'protest', 'organized_crime'],
  },
}

// Country risk mappings for context
const COUNTRY_NAMES: Record<string, string> = {
  UA: 'Ukraine', RU: 'Russia', SY: 'Syria', YE: 'Yemen', SD: 'Sudan', SS: 'South Sudan',
  ET: 'Ethiopia', LY: 'Libya', IQ: 'Iraq', AF: 'Afghanistan', MM: 'Myanmar', CD: 'Democratic Republic of Congo',
  SO: 'Somalia', ML: 'Mali', BF: 'Burkina Faso', NE: 'Niger', CF: 'Central African Republic',
  MZ: 'Mozambique', NG: 'Nigeria', CM: 'Cameroon', PS: 'Palestine', IL: 'Israel', LB: 'Lebanon',
  IR: 'Iran', PK: 'Pakistan', KH: 'Cambodia', ZW: 'Zimbabwe', RW: 'Rwanda', CI: 'Côte d\'Ivoire',
  HN: 'Honduras', VE: 'Venezuela', TZ: 'Tanzania', ZM: 'Zambia', UG: 'Uganda', KE: 'Kenya',
}

interface CountryEvent {
  id: string
  occurred_at: string
  severity: number
  event_type?: string
  category?: string
  is_humanitarian_report: boolean
  significance_score?: number
  escalation_indicator?: boolean
}

interface SignalSummary {
  domain: string
  event_count: number
  avg_severity: number
  most_recent: string
  top_event_types: Array<{ type: string; count: number }>
}

interface ConvergenceHotspot {
  country_code: string
  country_name: string
  convergence_score: number
  active_domains: string[]
  signal_summary: SignalSummary[]
  recommended_action: string
  escalation_probability: number
  events_14d: number
  critical_events: number
}

async function analyzeCountrySignals(
  countryCode: string,
  events: CountryEvent[]
): Promise<{
  domains: Map<string, SignalDomain & { events: CountryEvent[] }>
  domainCount: number
}> {
  const domainMap = new Map<string, SignalDomain & { events: CountryEvent[] }>()

  for (const [domainKey, domain] of Object.entries(SIGNAL_DOMAINS)) {
    const relevantEvents = events.filter(e => {
      const eventTypeMatch = domain.eventTypes?.some(t => e.event_type?.toLowerCase().includes(t))
      const categoryMatch = domain.categories?.some(c => e.category?.toLowerCase().includes(c))
      const humanitarianMatch = domain.isHumanitarianFlag && e.is_humanitarian_report
      return eventTypeMatch || categoryMatch || humanitarianMatch
    })

    if (relevantEvents.length > 0) {
      domainMap.set(domainKey, { ...domain, events: relevantEvents })
    }
  }

  return {
    domains: domainMap,
    domainCount: domainMap.size,
  }
}

function calculateConvergenceScore(
  domainCount: number,
  events: CountryEvent[],
  domains: Map<string, any>
): number {
  // Base score from domain convergence
  let score = 0

  // Penalize < 3 domains
  if (domainCount < 3) return 0

  // Base convergence points
  score += Math.min(domainCount * 15, 50) // 3-5 domains = 45-75 base

  // Severity boost
  const criticalCount = events.filter(e => (e.severity || 0) >= 4).length
  const highCount = events.filter(e => (e.severity || 0) === 3).length
  score += criticalCount * 8 + highCount * 3

  // Recency boost (last 3 days more valuable)
  const now = Date.now()
  const recent3d = events.filter(e => (now - new Date(e.occurred_at).getTime()) / (1000 * 60 * 60 * 24) < 3)
  score += Math.min(recent3d.length * 5, 20)

  // Escalation signals
  const escalatingCount = events.filter(e => e.escalation_indicator).length
  score += escalatingCount * 5

  return Math.min(Math.round(score), 100)
}

function generateRecommendation(
  domainCount: number,
  convergenceScore: number,
  domains: Map<string, SignalDomain & { events: CountryEvent[] }>,
  countryName: string
): string {
  if (convergenceScore >= 80) {
    return `CRITICAL: Multi-domain signal convergence in ${countryName}. Immediate escalation monitoring required. ${Array.from(domains.keys())
      .map(d => SIGNAL_DOMAINS[d]?.name)
      .join(', ')} signals active simultaneously.`
  }

  if (convergenceScore >= 60) {
    return `HIGH: Strong signal convergence in ${countryName}. Increase monitoring frequency and prepare response protocols. Cross-domain escalation risk elevated.`
  }

  if (convergenceScore >= 40) {
    return `MEDIUM: Signal convergence detected in ${countryName}. Monitor for further integration. Key signals: ${Array.from(domains.keys())
      .slice(0, 3)
      .map(d => SIGNAL_DOMAINS[d]?.name)
      .join(', ')}.`
  }

  return `LOW: Moderate signal activity in ${countryName}. Continue standard monitoring protocols.`
}

function calculateEscalationProbability(
  convergenceScore: number,
  events: CountryEvent[],
  domainCount: number
): number {
  // Base probability from convergence
  let probability = convergenceScore / 100

  // Adjustment for critical events
  const criticalCount = events.filter(e => (e.severity || 0) >= 4).length
  probability += criticalCount * 0.08

  // Adjustment for escalation indicators
  const escalatingCount = events.filter(e => e.escalation_indicator).length
  probability += escalatingCount * 0.05

  // Domain count multiplier (more domains = higher escalation risk)
  if (domainCount >= 4) probability *= 1.3
  else if (domainCount === 3) probability *= 1.15

  return Math.min(probability, 0.99)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const now = new Date()
    const h14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all events from last 14 days
    const { data: events } = await supabase
      .from('events')
      .select('id, country_code, occurred_at, severity, event_type, category, is_humanitarian_report, escalation_indicator, significance_score')
      .gte('occurred_at', h14d)
      .not('country_code', 'is', null)
      .order('occurred_at', { ascending: false })

    if (!events || events.length === 0) {
      return NextResponse.json({
        metadata: {
          generated_at: now.toISOString(),
          analysis_period_days: 14,
          events_analyzed: 0,
        },
        convergence_hotspots: [],
        summary: 'No events in analysis period',
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      })
    }

    // Group events by country
    const countryEventsMap = new Map<string, CountryEvent[]>()
    for (const event of events) {
      const cc = event.country_code as string
      if (!countryEventsMap.has(cc)) {
        countryEventsMap.set(cc, [])
      }
      countryEventsMap.get(cc)!.push(event as CountryEvent)
    }

    // Analyze convergence for each country
    const hotspots: ConvergenceHotspot[] = []

    for (const [countryCode, countryEventList] of countryEventsMap.entries()) {
      const { domains, domainCount } = await analyzeCountrySignals(countryCode, countryEventList)

      // Only include countries with 3+ signal domains
      if (domainCount >= 3) {
        const convergenceScore = calculateConvergenceScore(domainCount, countryEventList, domains)
        const escalationProb = calculateEscalationProbability(convergenceScore, countryEventList, domainCount)

        const criticalCount = countryEventList.filter(e => (e.severity || 0) >= 4).length

        // Build signal summaries
        const signalSummaries: SignalSummary[] = Array.from(domains.entries()).map(([domainKey, domainData]) => {
          const domainEvents = domainData.events
          const eventTypes = new Map<string, number>()
          domainEvents.forEach(e => {
            const type = e.event_type || 'unknown'
            eventTypes.set(type, (eventTypes.get(type) || 0) + 1)
          })

          return {
            domain: SIGNAL_DOMAINS[domainKey]?.name || domainKey,
            event_count: domainEvents.length,
            avg_severity: Math.round((domainEvents.reduce((sum, e) => sum + (e.severity || 0), 0) / domainEvents.length) * 100) / 100,
            most_recent: domainEvents[0]?.occurred_at || new Date().toISOString(),
            top_event_types: Array.from(eventTypes.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([type, count]) => ({ type, count })),
          }
        })

        hotspots.push({
          country_code: countryCode,
          country_name: COUNTRY_NAMES[countryCode] || countryCode,
          convergence_score: convergenceScore,
          active_domains: Array.from(domains.keys()).map(k => SIGNAL_DOMAINS[k]?.name || k),
          signal_summary: signalSummaries,
          recommended_action: generateRecommendation(domainCount, convergenceScore, domains, COUNTRY_NAMES[countryCode] || countryCode),
          escalation_probability: Math.round(escalationProb * 1000) / 1000,
          events_14d: countryEventList.length,
          critical_events: criticalCount,
        })
      }
    }

    // Sort by convergence score descending
    hotspots.sort((a, b) => b.convergence_score - a.convergence_score)

    // Calculate aggregate statistics
    const criticalHotspots = hotspots.filter(h => h.convergence_score >= 70).length
    const highRiskHotspots = hotspots.filter(h => h.convergence_score >= 50 && h.convergence_score < 70).length
    const mediumRiskHotspots = hotspots.filter(h => h.convergence_score >= 30 && h.convergence_score < 50).length

    return NextResponse.json({
      metadata: {
        generated_at: now.toISOString(),
        analysis_period_days: 14,
        events_analyzed: events.length,
        countries_analyzed: countryEventsMap.size,
        countries_with_convergence: hotspots.length,
      },
      convergence_summary: {
        critical_hotspots: criticalHotspots,
        high_risk_hotspots: highRiskHotspots,
        medium_risk_hotspots: mediumRiskHotspots,
        total_convergence_countries: hotspots.length,
      },
      convergence_hotspots: hotspots.slice(0, 50), // Top 50
      signal_definitions: Object.fromEntries(
        Object.entries(SIGNAL_DOMAINS).map(([key, domain]) => [
          key,
          { name: domain.name },
        ])
      ),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (error) {
    console.error('Cross-signals analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze cross-signals', details: String(error) },
      { status: 500 }
    )
  }
}
