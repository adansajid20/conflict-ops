export const dynamic = 'force-dynamic'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { InviteMembersCard } from '@/components/settings/InviteMembersCard'
import { Users, ShieldCheck, Lock } from 'lucide-react'

export default async function TeamPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createServiceClient()
  const { data: me } = await supabase.from('users').select('id, org_id, role, email').eq('clerk_user_id', userId).single()

  if (!me?.org_id) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-8 w-8 text-blue-400" />
            <h1 className="text-4xl font-bold text-white">Team Members</h1>
          </div>
          <p className="text-base text-white/60 mb-8">Manage your team members and permissions</p>

          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl text-center">
            <div className="inline-flex rounded-xl bg-blue-500/10 p-4 mb-4 border border-blue-500/20">
              <Lock className="h-8 w-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Organization Required</h2>
            <p className="text-white/60">Team management is only available for organizations. Upgrade to the Business plan to enable team mode.</p>
          </div>
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
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-8 w-8 text-blue-400" />
              <h1 className="text-4xl font-bold text-white">Team Members</h1>
            </div>
            <p className="text-base text-white/60">Manage users, roles, and team permissions</p>
          </div>
          {org?.sso_enabled && (
            <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 backdrop-blur-sm">
              <ShieldCheck className="h-4 w-4 text-green-400" />
              <span className="text-sm font-medium text-green-300">SSO Enabled</span>
            </div>
          )}
        </div>

        {/* Organization Stats */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Organization</p>
            <p className="text-2xl font-bold text-white">{org?.name}</p>
            <p className="text-xs text-white/40 mt-2">Owner</p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Plan</p>
            <p className="text-2xl font-bold text-white">{org?.plan_id?.charAt(0).toUpperCase()}{org?.plan_id?.slice(1)}</p>
            <p className="text-xs text-white/40 mt-2">Billing Plan</p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Seats</p>
            <p className="text-2xl font-bold text-white">
              {org?.seats_used ?? members?.length ?? 0}
              <span className="text-lg font-normal text-white/50">/{org?.seats_limit === -1 ? '∞' : org?.seats_limit}</span>
            </p>
            <p className="text-xs text-white/40 mt-2">Members</p>
          </div>
        </div>

        {/* Members Table */}
        <div className="mb-8 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Members ({members?.length ?? 0})</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.05]">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Joined</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Last Active</th>
                    {isAdmin && <th className="px-6 py-4 text-left text-xs font-semibold text-white/60 uppercase tracking-wider">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(members ?? []).map((member) => (
                    <tr key={member.id} className="border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                      <td className="px-6 py-4 text-sm text-white font-medium">{member.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                          member.role === 'owner'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : member.role === 'admin'
                              ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              : 'bg-white/[0.05] text-white/50 border-white/[0.08]'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {String(member.role ?? 'analyst').charAt(0).toUpperCase() + String(member.role ?? 'analyst').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60">
                        {member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/60">
                        {member.last_active ? new Date(member.last_active).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Never'}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4">
                          {member.id !== me.id && (
                            <button className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Invite Card */}
        <InviteMembersCard isAdmin={isAdmin} />

        {/* SSO Section — Enterprise Only */}
        {limits.ssoSaml && isAdmin && (
          <div className="mt-8 relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">SSO / SAML Configuration</h3>
                  <p className="text-white/60">Set up enterprise single sign-on for your organization</p>
                </div>
                <a href="/settings/sso" className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:from-blue-600 hover:to-blue-700 transition-all duration-200">
                  Configure SSO
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
