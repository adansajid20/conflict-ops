import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { computeTravelRisk, generateTravelBrief, RISK_LABELS, type TravelRiskLevel } from '@/lib/travel/risk-engine'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const BriefSchema = z.object({
  traveler_name: z.string().optional(),
  destination: z.string(),
  country_code: z.string().length(2),
  departure: z.string(),
  return: z.string(),
  purpose: z.string().max(200).optional().default('Business travel'),
})

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const countryCode = url.searchParams.get('country')

  if (!countryCode) {
    return NextResponse.json({ error: 'country parameter required' }, { status: 400 })
  }

  const cacheKey = `travel:risk:${countryCode.toUpperCase()}`
  const cached = await getCachedSnapshot(cacheKey)
  if (cached) return NextResponse.json({ success: true, data: cached, meta: { cached: true } })

  const risk = await computeTravelRisk(countryCode.toUpperCase())
  if (!risk) {
    return NextResponse.json({
      success: true,
      data: {
        country_code: countryCode.toUpperCase(),
        risk_level: 1,
        risk_label: 'LOW',
        risk_score: 0,
        key_threats: [],
        note: 'Insufficient data — fewer than 3 events recorded for this country.',
      },
    })
  }

  const data = {
    country_code: countryCode.toUpperCase(),
    risk_level: risk.risk_level,
    risk_label: RISK_LABELS[risk.risk_level],
    risk_score: risk.risk_score,
    key_threats: risk.key_threats,
    last_updated: new Date().toISOString(),
  }

  await setCachedSnapshot(cacheKey, data, 120) // 2h cache
  return NextResponse.json({ success: true, data })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = BriefSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const risk = await computeTravelRisk(parsed.data.country_code.toUpperCase())
  const riskLevel = (risk?.risk_level ?? 1) as TravelRiskLevel

  const brief = generateTravelBrief({
    travelerName: parsed.data.traveler_name ?? null,
    destination: parsed.data.destination,
    countryCode: parsed.data.country_code.toUpperCase(),
    departure: parsed.data.departure,
    return: parsed.data.return,
    purpose: parsed.data.purpose,
    riskLevel,
  })

  return NextResponse.json({ success: true, data: brief }, { status: 201 })
}
