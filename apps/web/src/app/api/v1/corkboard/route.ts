import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const Schema = z.object({
  mission_id: z.string().uuid().optional().nullable(),
  nodes: z.array(z.unknown()).default([]),
  edges: z.array(z.unknown()).default([]),
})

async function getUser(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id, org_id').eq('clerk_user_id', userId).single()
  return data
}

async function resolveMissionId(supabase: ReturnType<typeof createServiceClient>, orgId: string, missionId?: string | null) {
  if (missionId) return missionId
  const { data } = await supabase.from('missions').select('id').eq('org_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data?.id ?? null
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  const supabase = createServiceClient()
  const missionId = await resolveMissionId(supabase, user.org_id, new URL(req.url).searchParams.get('mission_id'))
  if (!missionId) return NextResponse.json({ success: true, data: { mission_id: null, nodes: [], edges: [] } })

  const { data, error } = await supabase
    .from('corkboard_states')
    .select('id, org_id, mission_id, nodes, edges, updated_at')
    .eq('org_id', user.org_id)
    .eq('mission_id', missionId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? { mission_id: missionId, nodes: [], edges: [] } })
}

async function save(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const missionId = await resolveMissionId(supabase, user.org_id, parsed.data.mission_id)
  if (!missionId) return NextResponse.json({ success: false, error: 'No mission available to persist corkboard state.' }, { status: 400 })

  const { data: existing } = await supabase
    .from('corkboard_states')
    .select('id')
    .eq('org_id', user.org_id)
    .eq('mission_id', missionId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    org_id: user.org_id,
    mission_id: missionId,
    nodes: parsed.data.nodes,
    edges: parsed.data.edges,
    updated_at: new Date().toISOString(),
  }

  const query = existing
    ? supabase.from('corkboard_states').update(payload).eq('id', existing.id)
    : supabase.from('corkboard_states').insert(payload)

  const { data, error } = await query.select('id, org_id, mission_id, nodes, edges, updated_at').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: existing ? 200 : 201 })
}

export async function POST(req: Request) {
  return save(req)
}

export async function PATCH(req: Request) {
  return save(req)
}
