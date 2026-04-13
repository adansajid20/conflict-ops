import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
const Schema = z.object({ logo_url: z.string().url().or(z.literal('')).optional(), primary_color: z.string().optional(), accent_color: z.string().optional(), app_name: z.string().optional(), custom_domain: z.string().optional() })

async function getUser(userId: string) { const supabase = createServiceClient(); const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single(); return data }

export async function GET() {
  const { userId } = await safeAuth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId); if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id); if (!limits.whiteLabel) return NextResponse.json({ success: false, error: 'Branding requires Enterprise plan.' }, { status: 403 })
  const supabase = createServiceClient(); const { data, error } = await supabase.from('orgs').select('branding').eq('id', user.org_id).single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data?.branding ?? {} })
}
export async function PATCH(req: Request) {
  const { userId } = await safeAuth(); if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId); if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id); if (!limits.whiteLabel) return NextResponse.json({ success: false, error: 'Branding requires Enterprise plan.' }, { status: 403 })
  const body = await req.json().catch(() => null); const parsed = Schema.safeParse(body); if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const supabase = createServiceClient(); const { data, error } = await supabase.from('orgs').update({ branding: parsed.data }).eq('id', user.org_id).select('branding').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data?.branding ?? {} })
}
