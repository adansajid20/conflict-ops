'use client'

import { useEffect, useState } from 'react'

type OrgData = any

export default function OrgSettingsPage() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [orgName, setOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const load = async () => { const res = await fetch('/api/v1/enterprise/org', { cache: 'no-store' }); const json = await res.json(); setOrg(json.data?.org || null); setMembers(json.data?.members || []); setOrgName(json.data?.org?.name || '') }
  useEffect(() => { void load() }, [])
  return <div className="p-6 max-w-5xl"><h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>Organization</h1><div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]"><div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Organization profile</div><input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} /><div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Current plan: {org?.plan_id || 'Unknown'}</div><button className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Save Changes</button></div><div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Invite member</div><div className="flex gap-2"><input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="analyst@company.com" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }} /><button className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Invite</button></div></div></div><div className="mt-6 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><table className="w-full text-sm"><thead><tr style={{ color: 'var(--text-muted)' }}><th className="px-4 py-3 text-left">Member</th><th className="px-4 py-3 text-left">Role</th><th className="px-4 py-3 text-left">Joined</th></tr></thead><tbody>{members.map((member) => <tr key={member.id} className="border-t" style={{ borderColor: 'var(--border)' }}><td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{member.email}</td><td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{member.role}</td><td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>{member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div></div>
}
