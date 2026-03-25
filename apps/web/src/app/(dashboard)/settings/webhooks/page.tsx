export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

export default async function WebhooksPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  const limits = user?.org_id ? await getOrgPlanLimits(user.org_id) : null

  if (!limits?.webhooks) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-xl font-bold tracking-widest uppercase mono mb-6" style={{ color: 'var(--text-primary)' }}>WEBHOOKS</h1>
        <div className="rounded border p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-sm mono mb-2" style={{ color: 'var(--text-muted)' }}>WEBHOOKS REQUIRE BUSINESS PLAN</div>
          <a href="/settings/billing" className="text-xs mono" style={{ color: 'var(--primary)' }}>Upgrade →</a>
        </div>
      </div>
    )
  }

  const { data: webhooks } = user?.org_id
    ? await supabase.from('webhooks').select('id,url,event_types,active,description,last_triggered,failure_count').eq('org_id', user.org_id)
    : { data: [] }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>WEBHOOKS</h1>
        <a href="/settings/webhooks/new" className="px-4 py-2 rounded text-xs mono border" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
          + ADD ENDPOINT
        </a>
      </div>

      {!webhooks?.length ? (
        <div className="rounded border p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
            NO WEBHOOKS CONFIGURED — ADD AN ENDPOINT TO RECEIVE REAL-TIME EVENTS
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between">
                <div>
                  <code className="text-xs mono" style={{ color: 'var(--text-primary)' }}>{wh.url}</code>
                  {wh.description && <div className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>{wh.description}</div>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {((wh.event_types as string[]) ?? []).map((et: string) => (
                      <span key={et} className="text-xs mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--accent-blue)' }}>
                        {et}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-xs mono ml-4">
                  <div style={{ color: wh.active ? 'var(--alert-green)' : 'var(--text-muted)' }}>
                    {wh.active ? 'ACTIVE' : 'DISABLED'}
                  </div>
                  {(wh.failure_count as number) > 0 && (
                    <div style={{ color: 'var(--alert-red)' }}>{wh.failure_count} failures</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supported events */}
      <div className="mt-6 rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="text-xs mono tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>SUPPORTED EVENT TYPES</div>
        <div className="grid grid-cols-2 gap-2">
          {['alert.created','event.high_severity','escalation.changed','vessel.dark','aircraft.emergency','forecast.updated'].map(e => (
            <code key={e} className="text-xs mono" style={{ color: 'var(--text-muted)' }}>{e}</code>
          ))}
        </div>
      </div>
    </div>
  )
}
