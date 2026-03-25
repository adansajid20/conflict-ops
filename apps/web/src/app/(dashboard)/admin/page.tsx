export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

export default async function AdminPage() {
  const { userId, orgId } = await auth()
  if (!userId) redirect('/sign-in')

  // Get org info
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('clerk_user_id', userId)
    .single()

  if (!user?.org_id) {
    return (
      <div className="p-6">
        <div className="text-sm mono" style={{ color: 'var(--text-muted)' }}>
          NO ORGANIZATION FOUND. COMPLETE ONBOARDING FIRST.
        </div>
      </div>
    )
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, plan_id, subscription_status, trial_ends_at')
    .eq('id', user.org_id)
    .single()

  const limits = await getOrgPlanLimits(user.org_id)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
          ORGANIZATION ADMIN
        </h1>
      </div>

      <div className="grid gap-4">
        {/* Plan info */}
        <div className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>CURRENT PLAN</div>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold mono uppercase" style={{ color: 'var(--primary)' }}>
              {org?.plan_id ?? 'individual'}
            </div>
            <div className="text-xs mono px-2 py-1 rounded" style={{
              backgroundColor: org?.subscription_status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
              color: org?.subscription_status === 'active' ? 'var(--alert-green)' : 'var(--alert-amber)',
            }}>
              {(org?.subscription_status ?? 'trialing').toUpperCase()}
            </div>
          </div>
        </div>

        {/* Feature gates */}
        <div className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>FEATURE ACCESS</div>
          <div className="grid grid-cols-2 gap-2 text-xs mono">
            {[
              ['Scenarios', limits.scenarios],
              ['ACH Matrix', limits.achMatrix],
              ['SAT Suite', limits.satSuite],
              ['API Access', limits.apiAccess],
              ['Webhooks', limits.webhooks],
              ['Org Mode', limits.orgMode],
              ['Audit Logs', limits.auditLogs],
              ['SSO/SAML', limits.ssoSaml],
            ].map(([label, enabled]) => (
              <div key={String(label)} className="flex items-center gap-2">
                <span style={{ color: enabled ? 'var(--alert-green)' : 'var(--text-muted)' }}>
                  {enabled ? '✓' : '✗'}
                </span>
                <span style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {String(label)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
