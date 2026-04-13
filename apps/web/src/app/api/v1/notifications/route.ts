import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

type NotificationRecord = {
  id: string
  type: 'mention' | 'alert' | 'report_ready'
  body: string
  metadata: Record<string, unknown> | null
  read: boolean
  created_at: string
}

export async function GET(req: Request): Promise<NextResponse<ApiResponse<NotificationRecord[]>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', userId).single()
  if (!user?.id || !user.org_id) return NextResponse.json({ success: true, data: [] })

  const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? '50'), 50)
  const { data, error } = await supabase
    .from('notifications')
    .select('id,type,body,metadata,read,created_at')
    .eq('user_id', user.id)
    .eq('org_id', user.org_id)
    .order('read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: (data ?? []) as NotificationRecord[] })
}
