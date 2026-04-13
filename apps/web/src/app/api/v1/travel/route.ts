import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { computeTravelRisk, generateTravelBrief, RISK_LABELS, type TravelRiskLevel } from '@/lib/travel/risk-engine'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
const TravelerSchema = z.object({ full_name: z.string().min(1), email: z.string().email().optional(), destination: z.string().optional() })
const BriefSchema = z.object({ traveler_id: z.string().optional(), destination: z.string(), departure_date: z.string().optional(), traveler_name: z.string().optional(), country_code: z.string().length(2).optional(), departure: z.string().optional(), return: z.string().optional(), purpose: z.string().optional() })
async function getUser(userId: string) { const supabase = createServiceClient(); const { data } = await supabase.from('users').select('id, org_id').eq('clerk_user_id', userId).single(); return data }
function deterministicSummary(countryCode: string, riskLevel: TravelRiskLevel) { return { country_code: countryCode, risk_level: riskLevel, risk_label: RISK_LABELS[riskLevel], risk_score: riskLevel * 20, key_threats: riskLevel >= 4 ? ['Armed conflict risk', 'Infrastructure disruption'] : riskLevel >= 3 ? ['Political instability', 'Operational disruption'] : ['Routine travel precautions'], note: 'Deterministic fallback used because model or deeper data is unavailable.' } }

export async function GET(req: Request) {
  const { userId } = await safeAuth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId); if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const url = new URL(req.url)
  if (url.searchParams.get('action') === 'travelers') {
    const supabase = createServiceClient(); const { data, error } = await supabase.from('travelers').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false })
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: data ?? [] })
  }
  const countryCode = (url.searchParams.get('country') ?? '').toUpperCase(); if (!countryCode) return NextResponse.json({ success: false, error: 'country parameter required' }, { status: 400 })
  const risk = await computeTravelRisk(countryCode)
  return NextResponse.json({ success: true, data: risk ? { country_code: countryCode, risk_level: risk.risk_level, risk_label: RISK_LABELS[risk.risk_level], risk_score: risk.risk_score, key_threats: risk.key_threats, last_updated: new Date().toISOString() } : deterministicSummary(countryCode, 2) })
}

export async function POST(req: Request) {
  const { userId } = await safeAuth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId); if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const url = new URL(req.url)
  const body = await req.json().catch(() => null)
  if (url.searchParams.get('action') === 'travelers') {
    const parsed = TravelerSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    const supabase = createServiceClient(); const { data, error } = await supabase.from('travelers').insert({ org_id: user.org_id, full_name: parsed.data.full_name, email: parsed.data.email ?? null, destination: parsed.data.destination ?? null }).select().single()
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data }, { status: 201 })
  }
  const parsed = BriefSchema.safeParse(body); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const countryCode = (parsed.data.country_code ?? parsed.data.destination.slice(0, 2)).toUpperCase()
  const risk = await computeTravelRisk(countryCode)
  const riskLevel = (risk?.risk_level ?? 2) as TravelRiskLevel
  const brief = process.env['OPENAI_API_KEY'] ? generateTravelBrief({ travelerName: parsed.data.traveler_name ?? null, destination: parsed.data.destination, countryCode, departure: parsed.data.departure ?? parsed.data.departure_date ?? new Date().toISOString().slice(0,10), return: parsed.data.return ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10), purpose: parsed.data.purpose ?? 'Business travel', riskLevel }) : generateTravelBrief({ travelerName: parsed.data.traveler_name ?? null, destination: parsed.data.destination, countryCode, departure: parsed.data.departure ?? parsed.data.departure_date ?? new Date().toISOString().slice(0,10), return: parsed.data.return ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10), purpose: 'Deterministic fallback brief', riskLevel })
  const supabase = createServiceClient(); await supabase.from('travel_risk_reports').insert({ org_id: user.org_id, traveler_id: parsed.data.traveler_id ?? null, destination: parsed.data.destination, departure_date: parsed.data.departure_date ?? parsed.data.departure ?? null, report_text: JSON.stringify(brief), risk_level: riskLevel })
  return NextResponse.json({ success: true, data: brief }, { status: 201 })
}

export async function PATCH(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ success: false, error: 'token required' }, { status: 400 })
  const supabase = createServiceClient(); const { data, error } = await supabase.from('travelers').update({ status: 'checked_in', last_checkin_at: new Date().toISOString() }).eq('checkin_token', token).select().single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
