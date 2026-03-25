export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: me } = await supabase.from('users').select('id, org_id, role, email').eq('clerk_user_id', userId).single()

  if (!me?.org_id) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-widest uppercase mono mb-4" style={{ color: 'var(--text-primary)' }}>TEAM</h1>
        <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
          No organization found. Upgrade to Business to enable org mode.
        </div>
      </div>
    )
  }

  const limits = await getOrgPlanLimits(me.org_id)
  const { data: members } = await supabase
    .from('users').select('id,email,role,created_at,last_active').eq('org_id', me.org_id).order('created_at')

  const { data: org } = await supabase
    .from('orgs').select('name,plan_id,seats_used,seats_limit,sso_enabled').eq('id', me.org_id).single()

  const isAdmin = ['admin','owner'].includes(me.role ?? '')

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-widest uppercase mono" style={{ color: 'var(--text-primary)' }}>
            TEAM MANAGEMENT
          </h1>
          <p className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>
            {org?.name} · {org?.plan_id?.toUpperCase()} · {org?.seats_used ?? members?.length ?? 0}/{org?.seats_limit === -1 ? '∞' : org?.seats_limit} seats
          </p>
        </div>
        {org?.sso_enabled && (
          <div className="text-xs mono px-2 py-1 rounded border" style={{ borderColor: 'var(--alert-green)', color: 'var(--alert-green)' }}>
            SSO ENABLED
          </div>
        )}
      </div>

      {/* Members table */}
      <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-xs mono">
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-surface-2)' }}>
              {['EMAIL', 'ROLE', 'JOINED', 'LAST ACTIVE', isAdmin ? 'ACTIONS' : ''].filter(Boolean).map(h => (
                <th key={h} className="px-4 py-2 text-left" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map(member => (
              <tr key={member.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="px-4 py-2" style={{ color: 'var(--text-primary)' }}>{member.email}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 rounded text-xs" style={{
                    color: member.role === 'owner' ? 'var(--primary)' : member.role === 'admin' ? 'var(--accent-blue)' : 'var(--text-muted)',
                    border: `1px solid ${member.role === 'owner' ? 'var(--primary)' : member.role === 'admin' ? 'var(--accent-blue)' : 'var(--border)'}`,
                  }}>
                    {String(member.role ?? 'analyst').toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-muted)' }}>
                  {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2" style={{ color: 'var(--text-muted)' }}>
                  {member.last_active ? new Date(member.last_active).toLocaleDateString() : 'Never'}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    {member.id !== me.id && (
                      <span className="text-xs mono cursor-pointer hover:underline" style={{ color: 'var(--alert-red)' }}>
                        REMOVE
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SSO section — Enterprise only */}
      {limits.ssoSaml && isAdmin && (
        <div className="mt-6 rounded border p-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>SSO / SAML CONFIGURATION</div>
          <a href="/settings/sso" className="text-xs mono" style={{ color: 'var(--primary)' }}>
            Configure SSO →
          </a>
        </div>
      )}
    </div>
  )
}
