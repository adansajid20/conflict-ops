import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

const Schema = z.object({ ip_allowlist: z.array(z.string().min(1)).max(200) })

async function getUser(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.ssoSaml) return NextResponse.json({ success: false, error: 'Enterprise plan required' }, { status: 403 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('orgs').select('ip_allowlist').eq('id', user.org_id).single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: { ip_allowlist: data?.ip_allowlist ?? [] } })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.ssoSaml) return NextResponse.json({ success: false, error: 'Enterprise plan required' }, { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('orgs').update({ ip_allowlist: parsed.data.ip_allowlist }).eq('id', user.org_id).select('ip_allowlist').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
