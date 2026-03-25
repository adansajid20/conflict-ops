export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'

async function getUsageStats(orgId: string) {
  const supabase = createServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [events30d, events7d, missions, alerts30d, apiCalls30d, members, org] = await Promise.allSettled([
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('ingested_at', thirtyDaysAgo),
    supabase.from('events').select('id', { count: 'exact', head: true }).gte('ingested_at', sevenDaysAgo),
    supabase.from('missions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', thirtyDaysAgo),
    supabase.from('api_keys').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('orgs').select('plan_id, subscription_status, seats_limit, trial_ends_at').eq('id', orgId).single(),
  ])

  return {
    events30d: events30d.status === 'fulfilled' ? (events30d.value.count ?? 0) : 0,
    events7d: events7d.status === 'fulfilled' ? (events7d.value.count ?? 0) : 0,
    missions: missions.status === 'fulfilled' ? (missions.value.count ?? 0) : 0,
    alerts30d: alerts30d.status === 'fulfilled' ? (alerts30d.value.count ?? 0) : 0,
    activeApiKeys: apiCalls30d.status === 'fulfilled' ? (apiCalls30d.value.count ?? 0) : 0,
    members: members.status === 'fulfilled' ? (members.value.count ?? 0) : 0,
    org: org.status === 'fulfilled' ? org.value.data : null,
  }
}

export default async function UsagePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) redirect('/onboarding')

  const stats = await getUsageStats(user.org_id)

  const cards = [
    { label: 'EVENTS INGESTED (30D)', value: stats.events30d.toLocaleString(), sub: `${stats.events7d.toLocaleString()} last 7 days`, color: 'var(--accent-blue)' },
    { label: 'ACTIVE MISSIONS', value: stats.missions, sub: 'across your org', color: 'var(--primary)' },
    { label: 'ALERTS FIRED (30D)', value: stats.alerts30d, sub: 'PIR threshold crossings', color: 'var(--alert-amber)' },
    { label: 'TEAM MEMBERS', value: stats.members, sub: `of ${stats.org?.seats_limit === -1 ? '∞' : (stats.org?.seats_limit ?? 5)} seats`, color: 'var(--alert-green)' },
  ]

  const planColors: Record<string, string> = {
    individual: '#8b949e', pro: '#58a6ff', business: '#3fb950', enterprise: '#f78166',
  }
  const plan = stats.org?.plan_id ?? 'individual'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>USAGE</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Platform usage metrics for your organization</p>
        </div>
        <div className="px-3 py-1 rounded text-xs mono font-bold" style={{ backgroundColor: `${planColors[plan]}20`, color: planColors[plan], border: `1px solid ${planColors[plan]}40` }}>
          {plan.toUpperCase()} PLAN
        </div>
      </div>

      {/* Trial warning */}
      {stats.org?.subscription_status === 'trialing' && stats.org?.trial_ends_at && (
        <div className="p-4 rounded border mb-6" style={{ borderColor: 'var(--alert-amber)', backgroundColor: 'var(--alert-amber)10' }}>
          <div className="text-xs mono font-bold" style={{ color: 'var(--alert-amber)' }}>
            ⏳ TRIAL ACTIVE — Expires {new Date(stats.org.trial_ends_at).toLocaleDateString()}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Upgrade before expiry to keep your data and configurations.{' '}
            <a href="/settings/billing" className="underline" style={{ color: 'var(--primary)' }}>Upgrade now →</a>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <div key={c.label} className="p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
            <div className="text-3xl font-bold mono" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* API keys */}
      <div className="p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs mono font-bold" style={{ color: 'var(--text-muted)' }}>API ACCESS</div>
          <a href="/settings/api" className="text-xs mono" style={{ color: 'var(--primary)' }}>Manage keys →</a>
        </div>
        <div className="text-2xl font-bold mono" style={{ color: 'var(--text-primary)' }}>{stats.activeApiKeys}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>active API keys</div>
        {plan === 'individual' || plan === 'pro' ? (
          <div className="mt-2 text-xs mono" style={{ color: 'var(--text-muted)' }}>
            API access requires Business plan.{' '}
            <a href="/settings/billing" className="underline" style={{ color: 'var(--primary)' }}>Upgrade →</a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
