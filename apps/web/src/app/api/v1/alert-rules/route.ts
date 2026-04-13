import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import type { ApiResponse } from '@conflict-ops/shared'

const ConditionSchema = z.object({
  field: z.enum(['country_code', 'event_type', 'severity_gte', 'keyword_match', 'region']),
  value: z.union([z.string().min(1), z.number()]),
})

const RuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  action: z.enum(['notify', 'webhook', 'email']),
  active: z.boolean().default(true),
  conditions: z.object({
    logic: z.enum(['AND', 'OR']).default('AND'),
    conditions: z.array(ConditionSchema).min(1),
  }),
})

async function getActor(userId: string): Promise<{ org_id: string | null } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  return data
}

function getRuleLimit(planId: string): number {
  if (planId === 'pro') return 5
  if (planId === 'business' || planId === 'enterprise') return -1
  return 0
}

export async function GET(): Promise<NextResponse<ApiResponse<Array<Record<string, unknown>>>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getActor(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('alert_rules').select('*').eq('org_id', actor.org_id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: (data ?? []) as Array<Record<string, unknown>> })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<Record<string, unknown>>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getActor(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = RuleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const limits = await getOrgPlanLimits(actor.org_id)
  const ruleLimit = getRuleLimit(limits.planId)
  if (ruleLimit === 0) return NextResponse.json({ success: false, error: 'Custom alert rules require Pro or higher.' }, { status: 403 })

  const supabase = createServiceClient()
  const { count } = await supabase.from('alert_rules').select('id', { head: true, count: 'exact' }).eq('org_id', actor.org_id)
  if (!parsed.data.id && ruleLimit !== -1 && (count ?? 0) >= ruleLimit) {
    return NextResponse.json({ success: false, error: `Rule limit reached (${ruleLimit}).` }, { status: 403 })
  }

  const payload = {
    org_id: actor.org_id,
    name: parsed.data.name,
    conditions: parsed.data.conditions,
    action: parsed.data.action,
    active: parsed.data.active,
  }

  const query = parsed.data.id
    ? supabase.from('alert_rules').update(payload).eq('id', parsed.data.id).eq('org_id', actor.org_id).select('*').single()
    : supabase.from('alert_rules').insert(payload).select('*').single()

  const { data, error } = await query
  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Failed to save rule' }, { status: 500 })
  return NextResponse.json({ success: true, data: data as Record<string, unknown> }, { status: parsed.data.id ? 200 : 201 })
}

export async function DELETE(req: Request): Promise<NextResponse<ApiResponse<null>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getActor(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  const supabase = createServiceClient()
  const { error } = await supabase.from('alert_rules').delete().eq('id', id).eq('org_id', actor.org_id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: null })
}
