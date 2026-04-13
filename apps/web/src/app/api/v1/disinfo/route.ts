import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

type NarrativeRow = {
  id: string
  org_id: string | null
  title: string
  description: string | null
  velocity_score: number | null
  is_disinfo: boolean | null
  disinfo_indicators: string[] | null
}

type FlagBody = { id?: string; is_disinfo?: boolean; indicators?: string[] }

async function getOrgId(userId: string): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  return data?.org_id ?? null
}

export async function GET(): Promise<NextResponse<ApiResponse<NarrativeRow[]>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: true, data: [] })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('narratives')
    .select('id, org_id, title, description, velocity_score, is_disinfo, disinfo_indicators')
    .eq('org_id', orgId)
    .order('last_seen_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: (data ?? []) as NarrativeRow[] })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<NarrativeRow>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as FlagBody | null
  if (!body?.id) return NextResponse.json({ success: false, error: 'Narrative id is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('narratives')
    .update({ is_disinfo: body.is_disinfo ?? true, disinfo_indicators: body.indicators ?? [] })
    .eq('id', body.id)
    .select('id, org_id, title, description, velocity_score, is_disinfo, disinfo_indicators')
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Update failed' }, { status: 500 })
  return NextResponse.json({ success: true, data: data as NarrativeRow })
}
