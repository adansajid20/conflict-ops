import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { PricingTable } from '@/components/billing/PricingTable'
import { ManageBillingButton } from '@/components/billing/ManageBillingButton'

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('org_id, stripe_customer_id')
    .eq('clerk_user_id', userId)
    .single()

  let currentPlan = 'free'
  let subscriptionStatus: string | null = null

  if (user?.org_id) {
    const { data: org } = await supabase
      .from('orgs')
      .select('plan_id, subscription_status, subscription_period_end')
      .eq('id', user.org_id)
      .single()

    currentPlan = org?.plan_id ?? 'free'
    subscriptionStatus = org?.subscription_status ?? null
  }

  const hasActiveSubscription =
    subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
          BILLING & PLANS
        </h1>
        <div className="flex items-center gap-4 mt-2">
          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
            CURRENT PLAN:{' '}
            <span style={{ color: 'var(--primary)' }}>
              {currentPlan.toUpperCase()}
            </span>
          </div>
          {subscriptionStatus && (
            <div
              className="text-xs mono px-2 py-1 rounded border"
              style={{
                borderColor: hasActiveSubscription ? 'var(--alert-green)' : 'var(--alert-amber)',
                color: hasActiveSubscription ? 'var(--alert-green)' : 'var(--alert-amber)',
              }}
            >
              {subscriptionStatus.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {hasActiveSubscription && (
        <div className="mb-6 p-4 rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
              MANAGE YOUR SUBSCRIPTION, UPDATE PAYMENT, DOWNLOAD INVOICES
            </div>
            <ManageBillingButton />
          </div>
        </div>
      )}

      <PricingTable currentPlan={currentPlan} />
    </div>
  )
}
