export const dynamic = 'force-dynamic'
import { safeAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import UsageClient from './UsageClient'

async function getUsage(orgId: string) {
  const supabase = createServiceClient()
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const [events, missions, seats, org] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('ingested_at', monthStart),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('orgs').select('plan_id,seats_limit,overage_policy').eq('id', orgId).single(),
  ])
  return {
    items: [
      { label: 'API CALLS', used: 0, limit: 1000 },
      { label: 'EVENTS', used: events.count ?? 0, limit: 10000 },
      { label: 'SEATS', used: seats.count ?? 0, limit: org.data?.seats_limit ?? 5 },
      { label: 'MISSIONS', used: missions.count ?? 0, limit: 25 },
    ],
    overagePolicy: (org.data?.overage_policy as string) ?? 'notify',
    plan: (org.data?.plan_id as string) ?? 'individual',
  }
}

export default async function UsagePage() {
  const { userId } = await safeAuth()
  if (!userId) redirect('/sign-in')
  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) redirect('/onboarding')
  const usage = await getUsage(user.org_id)

  return <UsageClient usage={usage} />
}
