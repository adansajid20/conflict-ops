import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

const RetentionSchema = z.object({ data_retention_days: z.union([z.literal(30), z.literal(90), z.literal(180), z.literal(365), z.literal(730)]) })

async function getUser(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function GET() {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.apiAccess) return NextResponse.json({ success: false, error: 'Business plan or higher required' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('orgs').select('data_retention_days').eq('id', user.org_id).single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: { data_retention_days: data?.data_retention_days ?? 365 } })
}

export async function PATCH(req: Request) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.apiAccess) return NextResponse.json({ success: false, error: 'Business plan or higher required' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = RetentionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('orgs').update(parsed.data).eq('id', user.org_id).select('data_retention_days').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
