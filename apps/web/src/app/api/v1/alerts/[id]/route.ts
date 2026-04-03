export const runtime = 'nodejs'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const UpdateSubscriptionSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().trim().min(1).max(120).nullable().optional(),
  conditions: z.object({
    severity_min: z.union([z.literal(3), z.literal(4)]).optional(),
    regions: z.array(z.string().min(1)).optional(),
    event_types: z.array(z.string().min(1)).optional(),
    keywords: z.array(z.string().min(1)).optional(),
  }).optional(),
  frequency: z.enum(['realtime', 'hourly', 'daily']).optional(),
  is_active: z.boolean().optional(),
})

function isMissingAlertsTable(error: { message?: string; code?: string } | null | undefined) {
  const message = `${error?.message ?? ''}`.toLowerCase()
  return error?.code === '42P01' || message.includes('relation') && message.includes('alerts') && message.includes('does not exist')
}

async function getOrgId(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  return data?.org_id as string | null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (body && typeof body === 'object' && ('read' in body || 'dismissed' in body)) {
    const orgId = await getOrgId(userId)
    if (!orgId) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

    const raw = body as { read?: boolean; dismissed?: boolean }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof raw.read === 'boolean') {
      updates.read = raw.read
      updates.read_at = raw.read ? new Date().toISOString() : null
    }
    if (typeof raw.dismissed === 'boolean') {
      updates.dismissed = raw.dismissed
      updates.dismissed_at = raw.dismissed ? new Date().toISOString() : null
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('alerts')
      .update(updates)
      .eq('id', params.id)
      .eq('org_id', orgId)
      .select('*')
      .single()

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  }

  const parsed = UpdateSubscriptionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const updates = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('alerts')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select('id,user_id,email,name,conditions,frequency,is_active,last_sent_at,created_at,updated_at')
    .single()

  if (isMissingAlertsTable(error)) {
    return NextResponse.json({ error: 'alerts table missing - run apps/web/supabase/migrations/20260403_alerts.sql in Supabase SQL editor' }, { status: 503 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alert: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { error, count } = await supabase
    .from('alerts')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('user_id', userId)

  if (isMissingAlertsTable(error)) {
    return NextResponse.json({ error: 'alerts table missing - run apps/web/supabase/migrations/20260403_alerts.sql in Supabase SQL editor' }, { status: 503 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
