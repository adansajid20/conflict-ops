import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (req.headers.get('X-Confirm-Delete') !== 'true') {
    return NextResponse.json({ success: false, error: 'Re-auth confirmation required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('id,org_id,email').eq('clerk_user_id', userId).single()
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  await Promise.allSettled([
    supabase.from('event_comments').update({ body: '[deleted by user request]', mentions: [] }).eq('user_id', user.id),
    supabase.from('api_keys').update({ active: false, revoked_at: new Date().toISOString() }).eq('created_by', user.id),
    supabase.from('users').update({ email: `deleted+${user.id}@example.invalid`, name: 'Deleted User', role: 'viewer', clerk_user_id: `deleted:${userId}`, org_id: null }).eq('id', user.id),
  ])

  return NextResponse.json({ success: true, data: { deleted: true } })
}
