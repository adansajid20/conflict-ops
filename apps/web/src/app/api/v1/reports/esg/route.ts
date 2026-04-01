import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { z } from 'zod'
import { generateBrief } from '@/lib/ai/openai'

export const dynamic = 'force-dynamic'
const Schema = z.object({ org_id: z.string(), country_codes: z.array(z.string().length(2)).min(1), date_range: z.object({ start: z.string(), end: z.string() }) })

export async function POST(req: Request) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null); const parsed = Schema.safeParse(body); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const supabase = createServiceClient(); const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (user?.org_id !== parsed.data.org_id) return NextResponse.json({ success: false, error: 'Org mismatch' }, { status: 403 })
  const limits = await getOrgPlanLimits(parsed.data.org_id); if (!limits.auditLogs) return NextResponse.json({ success: false, error: 'ESG reports require Business or Enterprise plan.' }, { status: 403 })
  const { data: events, error } = await supabase.from('events').select('id,title,country_code,severity,occurred_at,summary,description').in('country_code', parsed.data.country_codes).gte('occurred_at', parsed.data.date_range.start).lte('occurred_at', parsed.data.date_range.end).limit(250)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const eventCount = events?.length ?? 0
  const avgSeverity = eventCount ? (events ?? []).reduce((sum, item) => sum + Number(item.severity ?? 0), 0) / eventCount : 0
  const riskTier = avgSeverity >= 4 ? 'high' : avgSeverity >= 2.5 ? 'medium' : 'low'
  const context = JSON.stringify({ countries: parsed.data.country_codes, range: parsed.data.date_range, events: (events ?? []).slice(0, 25) })
  const narrative = process.env['OPENAI_API_KEY'] ? await generateBrief(`Generate an ESG/SEC conflict exposure narrative in under 400 words. Include supply chain, workforce, sanctions, governance and disclosure implications.
${context}`, 'daily', 400) : `Conflict exposure across ${parsed.data.country_codes.join(', ')} was assessed as ${riskTier.toUpperCase()} based on ${eventCount} recorded events during the selected window. Primary considerations include operational disruption, workforce safety, sanctions exposure, logistics volatility, and disclosure obligations. Recommend documenting event-driven controls, supplier concentration review, and board-level monitoring cadence.`
  return NextResponse.json({ success: true, data: { narrative, risk_tier: riskTier, event_count: eventCount, xbrl_json: { org_id: parsed.data.org_id, countries: parsed.data.country_codes, date_range: parsed.data.date_range, event_count: eventCount, risk_tier: riskTier } } })
}
