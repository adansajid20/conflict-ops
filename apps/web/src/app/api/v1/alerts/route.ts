import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse, Alert } from '@conflict-ops/shared'

export async function GET(req: Request): Promise<NextResponse<ApiResponse<Alert[]>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org found' }, { status: 400 })

  let query = supabase
    .from('alerts')
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: (data ?? []) as unknown as Alert[] })
}

export async function PATCH(req: Request): Promise<NextResponse<ApiResponse<null>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { alertIds, read } = await req.json() as { alertIds: string[]; read: boolean }

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org found' }, { status: 400 })

  await supabase
    .from('alerts')
    .update({ read, read_at: read ? new Date().toISOString() : null })
    .in('id', alertIds)
    .eq('org_id', user.org_id)

  return NextResponse.json({ success: true, data: null })
}
