import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { sendSlackNotification } from '@/lib/integrations/slack'
import { triggerPagerDuty } from '@/lib/integrations/pagerduty'
import type { ApiResponse } from '@conflict-ops/shared'

const CreateSchema = z.object({
  provider: z.enum(['slack', 'pagerduty']),
  config: z.record(z.string(), z.string().min(1)).default({}),
  test: z.boolean().optional(),
})

async function getActor(userId: string): Promise<{ id: string; org_id: string | null; role?: string | null } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id,role').eq('clerk_user_id', userId).single()
  return data
}

export async function GET(): Promise<NextResponse<ApiResponse<Array<Record<string, unknown>>>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getActor(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('integrations').select('id,provider,config,active,created_at,updated_at').eq('org_id', actor.org_id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: (data ?? []) as Array<Record<string, unknown>> })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<Record<string, unknown>>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getActor(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  const limits = await getOrgPlanLimits(actor.org_id)
  if (!limits.webhooks) return NextResponse.json({ success: false, error: 'Integrations require Business or Enterprise.' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  if (parsed.data.test) {
    if (parsed.data.provider === 'slack') {
      const result = await sendSlackNotification(parsed.data.config['webhook_url'] ?? '', 'CONFLICTRADAR integration test')
      return NextResponse.json({ success: result.success, data: { provider: 'slack', tested: true }, error: result.error })
    }
    const result = await triggerPagerDuty(parsed.data.config['integration_key'] ?? '', 'CONFLICTRADAR integration test', 'info')
    return NextResponse.json({ success: result.success, data: { provider: 'pagerduty', tested: true }, error: result.error })
  }

  const supabase = createServiceClient()
  const payload = {
    org_id: actor.org_id,
    provider: parsed.data.provider,
    config: parsed.data.config,
    active: true,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('integrations').upsert(payload, { onConflict: 'org_id,provider' }).select('id,provider,config,active,created_at,updated_at').single()
  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Failed to save integration' }, { status: 500 })
  return NextResponse.json({ success: true, data: data as Record<string, unknown> }, { status: 201 })
}

export async function DELETE(req: Request): Promise<NextResponse<ApiResponse<null>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const actor = await getActor(userId)
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const provider = new URL(req.url).searchParams.get('provider')
  if (!provider || (provider !== 'slack' && provider !== 'pagerduty')) return NextResponse.json({ success: false, error: 'Missing provider' }, { status: 400 })
  const supabase = createServiceClient()
  const { error } = await supabase.from('integrations').delete().eq('org_id', actor.org_id).eq('provider', provider)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: null })
}
