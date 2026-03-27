import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { ApiResponse } from '@conflict-ops/shared'

const PIRConditionSchema = z.object({
  type: z.enum(['country', 'event_type', 'severity_gte', 'keyword', 'actor']),
  value: z.union([z.string(), z.number()]),
})

const CreatePIRSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  mission_id: z.string().uuid().optional(),
  conditions: z.array(PIRConditionSchema).min(1).max(10),
  alert_channels: z.array(z.enum(['in_app', 'email', 'webhook'])).default(['in_app']),
  priority: z.number().int().min(1).max(3).default(2),
})

async function getOrgId(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  return data?.org_id as string | null
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: true, data: [], meta: { personal_mode: true } })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pirs')
    .select('*')
    .eq('org_id', orgId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<unknown>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: false, error: 'A workspace is required to create PIRs. Create one at /settings/org.' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreatePIRSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pirs')
    .insert({
      org_id: orgId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      mission_id: parsed.data.mission_id ?? null,
      conditions: parsed.data.conditions,
      alert_channels: parsed.data.alert_channels,
      priority: parsed.data.priority,
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}

export async function DELETE(req: Request): Promise<NextResponse<ApiResponse<null>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: false, error: 'No workspace found.' }, { status: 403 })

  const url = new URL(req.url)
  const pirId = url.searchParams.get('id')
  if (!pirId) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase.from('pirs').delete().eq('id', pirId).eq('org_id', orgId)

  return NextResponse.json({ success: true, data: null })
}
