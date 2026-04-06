export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { InviteMembersCard } from '@/components/settings/InviteMembersCard'

export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: me } = await supabase.from('users').select('id, org_id, role, email').eq('clerk_user_id', userId).single()

  if (!me?.org_id) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-widest uppercase mono mb-4 text-white">TEAM</h1>
        <div className="text-xs mono text-white/50">
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
          <h1 className="text-xl font-bold tracking-widest uppercase mono text-white">
            TEAM MANAGEMENT
          </h1>
          <p className="text-xs mono mt-1 text-white/50">
            {org?.name} · {org?.plan_id?.toUpperCase()} · {org?.seats_used ?? members?.length ?? 0}/{org?.seats_limit === -1 ? '∞' : org?.seats_limit} seats
          </p>
        </div>
        {org?.sso_enabled && (
          <div className="text-xs mono px-2 py-1 rounded border border-green-500/30 text-green-400">
            SSO ENABLED
          </div>
        )}
      </div>

      {/* Members table */}
      <div className="rounded border overflow-hidden border-white/[0.05] bg-white/[0.015]">
        <table className="w-full text-xs mono">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {['EMAIL', 'ROLE', 'JOINED', 'LAST ACTIVE', isAdmin ? 'ACTIONS' : ''].filter(Boolean).map(h => (
                <th key={h} className="px-4 py-2 text-left text-[10px] uppercase tracking-[0.15em] text-white/25">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map(member => (
              <tr key={member.id} className="border-t border-white/[0.05] hover:bg-white/[0.03]">
                <td className="px-4 py-2 text-white">{member.email}</td>
                <td className="px-4 py-2">
                  <span className="px-2 py-0.5 rounded text-xs" style={{
                    color: member.role === 'owner' ? '#60A5FA' : member.role === 'admin' ? '#60A5FA' : 'rgb(255 255 255 / 0.5)',
                    border: `1px solid ${member.role === 'owner' ? '#60A5FA' : member.role === 'admin' ? '#60A5FA' : 'rgb(255 255 255 / 0.05)'}`,
                  }}>
                    {String(member.role ?? 'analyst').toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2 text-white/50">
                  {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2 text-white/50">
                  {member.last_active ? new Date(member.last_active).toLocaleDateString() : 'Never'}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2">
                    {member.id !== me.id && (
                      <span className="text-xs mono cursor-pointer hover:underline text-red-400">
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

      <InviteMembersCard isAdmin={isAdmin} />

      {/* SSO section — Enterprise only */}
      {limits.ssoSaml && isAdmin && (
        <div className="mt-6 rounded border p-4 bg-white/[0.015] border-white/[0.05]">
          <div className="text-xs mono tracking-widest mb-2 text-white/50">SSO / SAML CONFIGURATION</div>
          <a href="/settings/sso" className="text-xs mono text-blue-400">
            Configure SSO →
          </a>
        </div>
      )}
    </div>
  )
}
