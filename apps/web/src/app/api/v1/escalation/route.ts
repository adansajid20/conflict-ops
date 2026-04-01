import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
const Schema = z.object({ mission_id: z.string(), current_rung: z.number().int().min(1).max(10).optional(), auto_advance: z.boolean().optional() })
async function getUser(userId: string) { const supabase = createServiceClient(); const { data } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', userId).single(); return data }
export async function GET(req: Request) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId); if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id); if (!limits.scenarios) return NextResponse.json({ success: false, error: 'Escalation ladder requires Business or Enterprise plan.' }, { status: 403 })
  const missionId = new URL(req.url).searchParams.get('mission_id');
  const supabase = createServiceClient(); let query = supabase.from('escalation_ladders').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false }).limit(20)
  if (missionId) query = query.eq('mission_id', missionId)
  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: missionId ? (data?.[0] ?? null) : (data ?? []) })
}
export async function POST(req: Request) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId); if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const body = await req.json().catch(() => null); const parsed = Schema.safeParse(body); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const supabase = createServiceClient(); const { data, error } = await supabase.from('escalation_ladders').insert({ org_id: user.org_id, mission_id: parsed.data.mission_id, current_rung: parsed.data.current_rung ?? 1, auto_advance: parsed.data.auto_advance ?? false, last_advanced_at: new Date().toISOString() }).select().single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
export async function PATCH(req: Request) {
  const { userId } = await auth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId); if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const body = await req.json().catch(() => null); const parsed = Schema.extend({ id: z.string().uuid().optional() }).safeParse(body); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const supabase = createServiceClient(); const query = supabase.from('escalation_ladders').update({ current_rung: parsed.data.current_rung, auto_advance: parsed.data.auto_advance, last_advanced_at: new Date().toISOString() }).eq('org_id', user.org_id).eq('mission_id', parsed.data.mission_id)
  const { data, error } = await query.select().single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
