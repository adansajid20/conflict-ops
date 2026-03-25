export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

export default async function APISettingsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  const limits = user?.org_id ? await getOrgPlanLimits(user.org_id) : null
  const hasAPI = limits?.apiAccess ?? false

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold tracking-widest uppercase mono mb-1" style={{ color: 'var(--text-primary)' }}>
        API ACCESS
      </h1>
      <p className="text-xs mono mb-6" style={{ color: 'var(--text-muted)' }}>
        REST API for programmatic access — Business plan and above
      </p>

      {!hasAPI ? (
        <div className="rounded border p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-sm mono mb-2" style={{ color: 'var(--text-muted)' }}>API ACCESS NOT INCLUDED IN YOUR PLAN</div>
          <a href="/settings/billing" className="text-xs mono" style={{ color: 'var(--primary)' }}>
            Upgrade to Business →
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Base URL */}
          <div className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>BASE URL</div>
            <code className="text-sm mono" style={{ color: 'var(--primary)' }}>
              https://conflictops.com/api/public/v1
            </code>
          </div>

          {/* Authentication */}
          <div className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>AUTHENTICATION</div>
            <div className="text-xs mono space-y-2" style={{ color: 'var(--text-muted)' }}>
              <div>Pass your API key in the Authorization header:</div>
              <code className="block p-2 rounded text-xs" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--primary)' }}>
                Authorization: Bearer co_live_your_api_key_here
              </code>
            </div>
          </div>

          {/* Endpoints */}
          <div className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>ENDPOINTS</div>
            <div className="space-y-3">
              {[
                { method: 'GET', path: '/events', desc: 'List conflict events. Params: country, severity_gte, since, limit, offset' },
                { method: 'GET', path: '/forecasts', desc: 'Country escalation forecasts. Params: country, horizon' },
                { method: 'GET', path: '/travel', desc: 'Travel risk by country. Params: country (ISO 2-letter)' },
              ].map(ep => (
                <div key={ep.path} className="flex gap-3">
                  <span className="text-xs mono font-bold px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: 'var(--primary-10)', color: 'var(--primary)' }}>
                    {ep.method}
                  </span>
                  <div>
                    <code className="text-xs mono" style={{ color: 'var(--text-primary)' }}>{ep.path}</code>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{ep.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate limits */}
          <div className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>RATE LIMITS</div>
            <div className="text-xs mono space-y-1" style={{ color: 'var(--text-muted)' }}>
              <div>Business: <span style={{ color: 'var(--text-primary)' }}>1,000 req/hour · 10,000 req/day</span></div>
              <div>Enterprise: <span style={{ color: 'var(--text-primary)' }}>Unlimited (fair use)</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
