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
interface HumanitarianEvent {
  id: string
  occurred_at: string
  country_code: string
  region: string
  event_type: string
  severity: number
  is_humanitarian_report: boolean
  casualty_estimate: number | null
}

interface CountryHumanitarianData {
  country_code: string
  country_name: string
  humanitarian_events: number
  estimated_casualties: number
  event_types: Set<string>
  severity_distribution: Map<number, number>
  event_dates: string[]
}

interface EventTypeData {
  event_type: string
  count: number
  total_casualties: number
  affected_countries: Set<string>
}

interface HumanitarianOverviewResponse {
  period: { start: string; end: string }
  methodology: {
    version: string
    description: string
    limitations: string[]
    sources: string[]
    confidence_note: string
  }
  summary: {
    total_humanitarian_events: number
    estimated_casualties: number
    countries_affected: number
    regions_affected: number
    most_affected_country: { code: string; name: string; casualties: number } | null
    trend_vs_prior_period: 'increasing' | 'decreasing' | 'stable'
  }
  by_country: Array<{
    country_code: string
    country_name: string
    humanitarian_events: number
    estimated_casualties: number
    event_types: string[]
    severity_distribution: Record<number, number>
    trend: 'increasing' | 'decreasing' | 'stable'
  }>
  by_type: Array<{
    event_type: string
    count: number
    total_casualties: number
    affected_countries: string[]
  }>
  timeline: Array<{
    date: string
    events: number
    casualties: number
  }>
  data_quality: {
    events_with_casualty_data: number
    events_without_casualty_data: number
    coverage_percentage: number
    last_updated: string
  }
}

/* ================================================================ */
/*  MAIN HANDLER                                                    */
/* ================================================================ */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()

    // Query parameters
    const url = new URL(req.url)
    const days = Math.min(parseInt(url.searchParams.get('days') ?? '90'), 180)

    // Time windows
    const now = new Date()
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
    const priorStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000).toISOString()
    const priorEnd = since

    // Fetch current period humanitarian events
    const { data: currentEvents, error: currentError } = await supabase
      .from('events')
      .select('id, occurred_at, country_code, region, event_type, severity, is_humanitarian_report, casualty_estimate')
      .gte('occurred_at', since)
      .or(`is_humanitarian_report.eq.true,casualty_estimate.gt.0`)

    // Fetch prior period humanitarian events (for trend comparison)
    const { data: priorEvents, error: priorError } = await supabase
      .from('events')
      .select('id, country_code, is_humanitarian_report, casualty_estimate')
      .gte('occurred_at', priorStart)
      .lt('occurred_at', priorEnd)
      .or(`is_humanitarian_report.eq.true,casualty_estimate.gt.0`)

    if (currentError || priorError) {
      const error = currentError || priorError
      return NextResponse.json({ error: error?.message }, { status: 500 })
    }

    const eventsList = (currentEvents ?? []) as HumanitarianEvent[]
    const priorEventsList = (priorEvents ?? []) as HumanitarianEvent[]

    // Aggregate by country
    const countryMap = new Map<string, CountryHumanitarianData>()
    const typeMap = new Map<string, EventTypeData>()
    const regionSet = new Set<string>()
    let totalCasualties = 0
    let eventsWithCasualtyData = 0

    for (const event of eventsList) {
      const cc = (event.country_code as string) || ''
      if (!cc || cc.length !== 2 || cc === 'XX' || cc === 'ZZ') continue

      const countryName = COUNTRY_NAMES[cc] || cc
      if (!countryMap.has(cc)) {
        countryMap.set(cc, {
          country_code: cc,
          country_name: countryName,
          humanitarian_events: 0,
          estimated_casualties: 0,
          event_types: new Set(),
          severity_distribution: new Map(),
          event_dates: [],
        })
      }

      const countryData = countryMap.get(cc)!
      countryData.humanitarian_events++
      countryData.event_types.add(event.event_type as string)

      const sev = (event.severity as number) ?? 1
      countryData.severity_distribution.set(sev, (countryData.severity_distribution.get(sev) ?? 0) + 1)

      const casualties = (event.casualty_estimate as number) ?? 0
      if (casualties > 0) {
        countryData.estimated_casualties += casualties
        totalCasualties += casualties
        eventsWithCasualtyData++
      }

      countryData.event_dates.push(event.occurred_at as string)

      // Track by event type
      const et = (event.event_type as string) || 'unknown'
      if (!typeMap.has(et)) {
        typeMap.set(et, {
          event_type: et,
          count: 0,
          total_casualties: 0,
          affected_countries: new Set(),
        })
      }
      const typeData = typeMap.get(et)!
      typeData.count++
      typeData.total_casualties += casualties
      typeData.affected_countries.add(cc)

      // Track regions
      if (event.region) regionSet.add(event.region as string)
    }

    // Calculate prior period totals for trend
    const priorTotalCasualties = priorEventsList.reduce((sum, e) => {
      return sum + ((e.casualty_estimate as number) ?? 0)
    }, 0)
    const priorEventCount = priorEventsList.length

    // Find most affected country
    let mostAffectedCountry: { code: string; name: string; casualties: number } | null = null
    if (countryMap.size > 0) {
      const sorted = [...countryMap.values()].sort((a, b) => b.estimated_casualties - a.estimated_casualties)
      if (sorted[0]) {
        mostAffectedCountry = {
          code: sorted[0].country_code,
          name: sorted[0].country_name,
          casualties: sorted[0].estimated_casualties,
        }
      }
    }

    // Determine trend
    const trend = getTrend(eventsList.length, priorEventCount, totalCasualties, priorTotalCasualties)

    // Build country-level response
    const byCountry = [...countryMap.values()]
      .map(data => {
        // Calculate country-level trend vs prior
        const priorCountryEvents = priorEventsList.filter(e => e.country_code === data.country_code)
        const priorCountryCasualties = priorCountryEvents.reduce((sum, e) => sum + ((e.casualty_estimate as number) ?? 0), 0)
        const countryTrend = getTrend(data.humanitarian_events, priorCountryEvents.length, data.estimated_casualties, priorCountryCasualties)

        const severityDist: Record<number, number> = {}
        for (const [sev, count] of data.severity_distribution) {
          severityDist[sev] = count
        }

        return {
          country_code: data.country_code,
          country_name: data.country_name,
          humanitarian_events: data.humanitarian_events,
          estimated_casualties: data.estimated_casualties,
          event_types: [...data.event_types],
          severity_distribution: severityDist,
          trend: countryTrend,
        }
      })
      .sort((a, b) => b.estimated_casualties - a.estimated_casualties)

    // Build event-type response
    const byType = [...typeMap.values()]
      .map(data => ({
        event_type: data.event_type,
        count: data.count,
        total_casualties: data.total_casualties,
        affected_countries: [...data.affected_countries],
      }))
      .sort((a, b) => b.count - a.count)

    // Build timeline (daily aggregation)
    const dailyMap = new Map<string, { events: number; casualties: number }>()
    for (const event of eventsList) {
      const date = (event.occurred_at as string).slice(0, 10)
      if (!date) continue
      if (!dailyMap.has(date)) dailyMap.set(date, { events: 0, casualties: 0 })
      const d = dailyMap.get(date)!
      d.events++
      d.casualties += (event.casualty_estimate as number) ?? 0
    }

    const timeline = [...dailyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }))

    // Data quality metrics
    const totalEvents = eventsList.length
    const eventsWithoutCasualtyData = totalEvents - eventsWithCasualtyData
    const coveragePercentage = totalEvents > 0 ? Math.round((eventsWithCasualtyData / totalEvents) * 100) : 0

    const response: HumanitarianOverviewResponse = {
      period: {
        start: since,
        end: now.toISOString(),
      },
      methodology: {
        version: '2.0',
        description:
          'Casualties are tracked via the casualty_estimate field in conflict events and humanitarian reports marked with is_humanitarian_report=true. ' +
          'Estimates are derived from news reports, NGO assessments, and verified sources. ' +
          'Historical accuracy improves over time as additional sources confirm initial estimates.',
        limitations: [
          'Casualty figures are estimates and may be revised as more information becomes available',
          'Undercounting is common in active conflict zones due to access limitations',
          'Different sources may use different methodologies (e.g., direct deaths vs. total impact)',
          'Attribution of deaths to specific events can be ambiguous in complex emergencies',
          'Non-fatal humanitarian impacts (displacement, disease, hunger) are tracked separately via event types',
          'Data reflects only reported incidents; unreported events are not included',
        ],
        sources: [
          'Open-source conflict and humanitarian event reports',
          'International news agencies and newswires',
          'NGO situation reports and humanitarian assessments',
          'Government and official statements',
          'Social media and crowdsourced reports (verified)',
          'Academic conflict databases',
        ],
        confidence_note:
          'Confidence in casualty estimates varies by event. Events with multiple independent sources have higher confidence. ' +
          'Early reports often underestimate true impact. Use these figures for trend analysis rather than absolute accuracy.',
      },
      summary: {
        total_humanitarian_events: eventsList.length,
        estimated_casualties: totalCasualties,
        countries_affected: countryMap.size,
        regions_affected: regionSet.size,
        most_affected_country: mostAffectedCountry,
        trend_vs_prior_period: trend,
      },
      by_country: byCountry,
      by_type: byType,
      timeline,
      data_quality: {
        events_with_casualty_data: eventsWithCasualtyData,
        events_without_casualty_data: eventsWithoutCasualtyData,
        coverage_percentage: coveragePercentage,
        last_updated: now.toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/* ================================================================ */
/*  HELPER: Determine Trend                                         */
/* ================================================================ */
function getTrend(
  currentEvents: number,
  priorEvents: number,
  currentCasualties: number,
  priorCasualties: number
): 'increasing' | 'decreasing' | 'stable' {
  // Use both event count and casualty metrics
  const eventRatio = priorEvents > 0 ? currentEvents / priorEvents : currentEvents > 0 ? 2 : 1
  const casualtyRatio = priorCasualties > 0 ? currentCasualties / priorCasualties : currentCasualties > 0 ? 2 : 1

  // Weight: 60% events, 40% casualties
  const combinedRatio = eventRatio * 0.6 + casualtyRatio * 0.4

  if (combinedRatio > 1.15) return 'increasing'
  if (combinedRatio < 0.85) return 'decreasing'
  return 'stable'
}
