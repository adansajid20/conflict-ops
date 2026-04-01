import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits, isAtMissionLimit } from '@/lib/plan-limits'
import { writeAuditLog } from '@/lib/audit/log'
import { extractRequestIp, isIPAllowed } from '@/lib/security/ip-check'
import type { Mission } from '@conflict-ops/shared'
import crypto from 'crypto'
import { z } from 'zod'

const CreateMissionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  regions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(['private', 'org', 'shared']).default('org'),
})

async function getUser(clerkUserId: string): Promise<{ id: string; org_id: string | null } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function GET(req: Request): Promise<NextResponse<{ success: boolean; data?: Mission[] | null; error?: string; meta?: Record<string, unknown> }>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: true, data: [], meta: { personal_mode: true } })
  const allowed = await isIPAllowed(user.org_id, extractRequestIp(req))
  if (!allowed) return NextResponse.json({ success: false, error: 'IP not allowed for this organization.' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .or(`org_id.eq.${user.org_id},and(created_by.eq.${user.id},visibility.eq.private)`)
    .neq('visibility', 'private')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  const visible = (data ?? []).filter((mission) => mission.visibility !== 'private' || mission.created_by === user.id)
  return NextResponse.json({ success: true, data: visible as Mission[] })
}

export async function POST(req: Request): Promise<NextResponse<{ success: boolean; data?: Mission | null; error?: string; meta?: Record<string, unknown> }>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'Complete onboarding to create missions', meta: { personal_mode: true } }, { status: 400 })
  const allowed = await isIPAllowed(user.org_id, extractRequestIp(req))
  if (!allowed) return NextResponse.json({ success: false, error: 'IP not allowed for this organization.' }, { status: 403 })

  const limits = await getOrgPlanLimits(user.org_id)
  const supabase = createServiceClient()
  const { count } = await supabase.from('missions').select('id', { count: 'exact', head: true }).eq('org_id', user.org_id)
  if (isAtMissionLimit(limits.planId, count ?? 0)) {
    return NextResponse.json({ success: false, error: `Mission limit reached (${limits.maxMissions}). Upgrade your plan to create more missions.` }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = CreateMissionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const { data, error } = await supabase.from('missions').insert({
    org_id: user.org_id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    regions: parsed.data.regions,
    tags: parsed.data.tags,
    created_by: user.id,
    visibility: parsed.data.visibility,
    shared_token: parsed.data.visibility === 'shared' ? crypto.randomUUID() : null,
  }).select().single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  await writeAuditLog(supabase, { orgId: user.org_id, userId: user.id, action: 'mission.create', resourceType: 'mission', resourceId: data.id, metadata: { name: data.name, visibility: data.visibility } })
  return NextResponse.json({ success: true, data: data as Mission }, { status: 201 })
}

export async function DELETE(req: Request): Promise<NextResponse<{ success: boolean; data?: null; error?: string }>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const allowed = await isIPAllowed(user.org_id, extractRequestIp(req))
  if (!allowed) return NextResponse.json({ success: false, error: 'IP not allowed for this organization.' }, { status: 403 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  const supabase = createServiceClient()
  const { error } = await supabase.from('missions').delete().eq('id', id).eq('org_id', user.org_id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  await writeAuditLog(supabase, { orgId: user.org_id, userId: user.id, action: 'mission.delete', resourceType: 'mission', resourceId: id, metadata: {} })
  return NextResponse.json({ success: true, data: null })
}
