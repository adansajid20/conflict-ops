import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureUserProvisioned } from '@/lib/user/provision'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const Schema = z.object({
  org_name: z.string().min(1).max(100),
  org_type: z.string().optional(),
  mission_name: z.string().min(1).max(200),
  regions: z.array(z.string()).min(1),
  interests: z.array(z.string()),
  pir_name: z.string().nullable().optional(),
  pir_keyword: z.string().nullable().optional(),
})

export async function POST(req: Request) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  // Auto-provision user if not in DB (webhook might not be configured)
  const provisioned = await ensureUserProvisioned(userId)

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('id, org_id').eq('id', provisioned.userId).single()
  if (!user) return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 })

  let orgId = user.org_id

  // Create org if not already linked
  if (!orgId) {
    const { data: org } = await supabase
      .from('orgs')
      .insert({ name: parsed.data.org_name, plan_id: 'individual', subscription_status: 'trialing', org_type: parsed.data.org_type ?? null })
      .select('id')
      .single()

    if (org) {
      orgId = org.id
      await supabase.from('users').update({ org_id: orgId, role: 'owner' }).eq('id', user.id)
    }
  } else {
    await supabase.from('orgs').update({ name: parsed.data.org_name }).eq('id', orgId)
  }

  if (!orgId) return NextResponse.json({ error: 'Failed to create org' }, { status: 500 })

  // Create first mission
  const { data: mission } = await supabase
    .from('missions')
    .insert({
      org_id: orgId,
      created_by: user.id,
      name: parsed.data.mission_name,
      status: 'active',
      regions: parsed.data.regions,
      interest_types: parsed.data.interests,
    })
    .select('id')
    .single()

  // Create PIR if provided
  if (parsed.data.pir_name && parsed.data.pir_keyword && mission) {
    await supabase.from('pirs').insert({
      org_id: orgId,
      mission_id: mission.id,
      created_by: user.id,
      name: parsed.data.pir_name,
      status: 'active',
      conditions: [{ field: 'keyword', operator: 'contains', value: parsed.data.pir_keyword }],
      channels: ['in_app', 'email'],
    })
  }

  // Mark onboarding complete
  await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id)

  return NextResponse.json({ success: true, data: { org_id: orgId, mission_id: mission?.id } })
}
