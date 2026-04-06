'use client'

import { useEffect, useState } from 'react'
import { BrandingEditor } from '@/components/settings/BrandingEditor'
import { AlertRulesBuilder } from '@/components/alerts/AlertRulesBuilder'
import { IntegrationsManager } from '@/components/settings/IntegrationsManager'

type OrgData = { id?: string; name?: string; plan_id?: string }
type Member = { id: string; email: string; role: string; created_at?: string | null }

export default function OrgSettingsPage() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [orgName, setOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const load = async () => { const res = await fetch('/api/v1/enterprise/org', { cache: 'no-store' }); const json = await res.json() as { data?: { org?: OrgData; members?: Member[] } }; setOrg(json.data?.org || null); setMembers(json.data?.members || []); setOrgName(json.data?.org?.name || '') }
  useEffect(() => { void load() }, [])
  return <div className="p-6 max-w-5xl"><h1 className="text-[22px] font-semibold text-white">Organization</h1><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]"><div className="rounded-xl border p-4 bg-white/[0.015] border-white/[0.05]"><div className="mb-3 text-sm font-semibold text-white">Organization profile</div><input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20" /><div className="mt-2 text-sm text-white/50">Current plan: {org?.plan_id || 'Unknown'}</div><button className="mt-4 rounded-lg px-3 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600">Save Changes</button></div><div className="rounded-xl border p-4 bg-white/[0.015] border-white/[0.05]"><div className="mb-3 text-sm font-semibold text-white">Invite member</div><div className="flex gap-2"><input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="analyst@company.com" className="flex-1 rounded-lg border px-3 py-2 text-sm bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20" /><button className="rounded-lg px-3 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600">Invite</button></div></div></div><div className="mt-6 rounded-xl border bg-white/[0.015] border-white/[0.05]"><table className="w-full text-sm"><thead><tr className="text-white/30 text-[10px] uppercase"><th className="px-4 py-3 text-left">Member</th><th className="px-4 py-3 text-left">Role</th><th className="px-4 py-3 text-left">Joined</th></tr></thead><tbody>{members.map((member) => <tr key={member.id} className="border-t border-white/[0.05] hover:bg-white/[0.03]"><td className="px-4 py-3 text-white">{member.email}</td><td className="px-4 py-3 text-white/80">{member.role}</td><td className="px-4 py-3 text-white/50">{member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div><div className="mt-6"><AlertRulesBuilder /></div><div className="mt-6"><IntegrationsManager /></div>{org?.plan_id === 'enterprise' ? <div className="mt-6"><h2 className="mb-3 text-lg font-semibold text-white">Branding</h2><BrandingEditor /></div> : null}</div>
}
