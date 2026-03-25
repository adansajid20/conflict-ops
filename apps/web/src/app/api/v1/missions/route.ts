import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits, isAtMissionLimit } from '@/lib/plan-limits'
import type { ApiResponse, Mission } from '@conflict-ops/shared'
import { z } from 'zod'

const CreateMissionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  regions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
})

async function getOrgId(clerkUserId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('org_id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return data?.org_id ?? null
}

export async function GET(): Promise<NextResponse<{ success: boolean; data?: Mission[] | null; error?: string; meta?: Record<string, unknown> }>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: true, data: [], meta: { personal_mode: true } })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: (data ?? []) as unknown as Mission[] })
}

export async function POST(req: Request): Promise<NextResponse<{ success: boolean; data?: Mission | null; error?: string; meta?: Record<string, unknown> }>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: false, error: 'Complete onboarding to create missions', meta: { personal_mode: true } }, { status: 400 })

  // Enforce plan limit SERVER-SIDE
  const limits = await getOrgPlanLimits(orgId)
  const supabase = createServiceClient()
  const { count } = await supabase
    .from('missions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (isAtMissionLimit(limits.planId, count ?? 0)) {
    return NextResponse.json(
      { success: false, error: `Mission limit reached (${limits.maxMissions}). Upgrade your plan to create more missions.` },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateMissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  }

  // Get user id in DB
  const { data: user } = await supabase.from('users').select('id').eq('clerk_user_id', userId).single()

  const { data, error } = await supabase
    .from('missions')
    .insert({
      org_id: orgId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      regions: parsed.data.regions,
      tags: parsed.data.tags,
      created_by: user?.id ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data as unknown as Mission }, { status: 201 })
}
