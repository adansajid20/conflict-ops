import { CountryIntelClient } from '@/components/countries/CountryIntelClient'
import { notFound } from 'next/navigation'

interface PageProps {
  params: {
    code: string
  }
}

interface CountryBrief {
  country_code: string
  country_name: string
  flag_emoji: string
  region: string
  risk_level: number
  risk_label: string
  travel_advisory: {
    level: number
    label: string
    description: string
  }
  risk_breakdown: {
    category: string
    score: number
  }[]
  active_threats: {
    id: string
    title: string
    severity: string
    date: string
    event_type: string
  }[]
  event_stats: {
    days_7: number
    days_30: number
    days_90: number
    severity_distribution: {
      critical: number
      high: number
      medium: number
      low: number
    }
    top_event_types: {
      type: string
      count: number
    }[]
    casualty_total: number
  }
  trend_analysis: {
    direction: string
    percentage_change: number
    interpretation: string
  }
  key_actors: {
    id: string
    name: string
    event_count: number
    threat_level: string
  }[]
  neighboring_countries: {
    code: string
    name: string
    risk_level: number
  }[]
}

interface RiskScoreExplainer {
  indicators: {
    id: string
    name: string
    icon: string
    score: number
    reasoning: string
    trend: string
  }[]
}

async function getCountryData(code: string): Promise<CountryBrief | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/v1/countries/${code}/brief`, {
      cache: 'no-store',
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data || json
  } catch {
    return null
  }
}

async function getRiskScores(code: string): Promise<RiskScoreExplainer | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/v1/risk-scores/explain?country_code=${code}`, {
      cache: 'no-store',
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageProps) {
  const data = await getCountryData(params.code.toUpperCase())
  if (!data) {
    return {
      title: 'Country not found',
    }
  }
  return {
    title: `${data.country_name} - Country Intelligence Dashboard`,
    description: `Comprehensive geopolitical intelligence analysis for ${data.country_name}. Risk level: ${data.risk_label}. Travel advisory: ${data.travel_advisory.label}.`,
  }
}

export default async function CountryPage({ params }: PageProps) {
  const countryCode = params.code.toUpperCase()
  const [countryData, riskScores] = await Promise.all([
    getCountryData(countryCode),
    getRiskScores(countryCode),
  ])

  if (!countryData) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-[#070B11]">
      <CountryIntelClient countryData={countryData} riskScores={riskScores} />
    </div>
  )
}
