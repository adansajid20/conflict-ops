import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

async function getUser(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function GET() {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  const supabase = createServiceClient()
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const [eventCount, missionCount, seatCount, apiKeyCount, orgResult] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('ingested_at', monthStart),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('org_id', user.org_id),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', user.org_id),
    supabase.from('api_keys').select('id', { count: 'exact', head: true }).eq('org_id', user.org_id).eq('active', true),
    supabase.from('orgs').select('plan_id, overage_policy').eq('id', user.org_id).single(),
  ])
  const limits = await getOrgPlanLimits(user.org_id)
  return NextResponse.json({ success: true, data: {
    api_calls: { used: apiKeyCount.count ?? 0, limit: limits.maxApiCallsPerDay },
    events: { used: eventCount.count ?? 0, limit: limits.dataRetentionDays === -1 ? -1 : limits.dataRetentionDays * 100 },
    seats: { used: seatCount.count ?? 0, limit: limits.maxMembers },
    missions: { used: missionCount.count ?? 0, limit: limits.maxMissions },
    plan_id: orgResult.data?.plan_id ?? limits.planId,
    overage_policy: orgResult.data?.overage_policy ?? 'notify',
  } })
}
