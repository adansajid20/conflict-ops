import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('id,org_id,email,name,role,created_at').eq('clerk_user_id', userId).single()
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })

  const [events, comments, missions, alerts, apiKeys] = await Promise.all([
    supabase.from('events').select('*').eq('created_by', user.id as never),
    supabase.from('event_comments').select('*').eq('user_id', user.id),
    supabase.from('missions').select('*').eq('created_by', user.id),
    supabase.from('alerts').select('*').eq('org_id', user.org_id),
    supabase.from('api_keys').select('id,name,key_prefix,active,created_at,expires_at,revoked_at').eq('created_by', user.id),
  ])

  return NextResponse.json({ success: true, data: { exported_at: new Date().toISOString(), user, events: events.data ?? [], comments: comments.data ?? [], missions: missions.data ?? [], alerts: alerts.data ?? [], api_keys: apiKeys.data ?? [] } })
}
