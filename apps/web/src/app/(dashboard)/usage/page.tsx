export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { UsageMeter } from '@/components/billing/UsageMeter'

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
    overagePolicy: org.data?.overage_policy ?? 'notify',
    plan: org.data?.plan_id ?? 'individual',
  }
}

export default async function UsagePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) redirect('/onboarding')
  const usage = await getUsage(user.org_id)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mono text-white">USAGE & OVERAGES</h1>
        <p className="text-sm mt-1 text-white/50">Plan: {usage.plan}. Current overage policy: {usage.overagePolicy}.</p>
      </div>
      <UsageMeter items={usage.items} />
      <OveragePolicySelector current={usage.overagePolicy} />
    </div>
  )
}

function OveragePolicySelector({ current }: { current: string }) {
  return (
    <form action={async (formData: FormData) => {
      'use server'
      const overage_policy = String(formData.get('overage_policy') ?? current)
      await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/v1/billing/overage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overage_policy }),
      })
    }} className="p-4 rounded border bg-white/[0.015] border-white/[0.05]">
      <div className="text-xs mono font-bold mb-2 text-white/80">OVERAGE POLICY</div>
      <select name="overage_policy" defaultValue={current} className="rounded border px-3 py-2 text-sm bg-white/[0.03] border-white/[0.06] text-white">
        <option value="allow">allow</option>
        <option value="cap">cap</option>
        <option value="notify">notify</option>
      </select>
      <button className="ml-3 px-4 py-2 rounded text-xs mono font-bold bg-blue-500 text-white hover:bg-blue-600">SAVE</button>
    </form>
  )
}
