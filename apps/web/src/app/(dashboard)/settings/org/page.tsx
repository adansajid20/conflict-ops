'use client'

import { useEffect, useState } from 'react'
import { BrandingEditor } from '@/components/settings/BrandingEditor'

type OrgData = { id?: string; name?: string; plan_id?: string }
type Member = { id: string; email: string; role: string; created_at?: string | null }

export default function OrgSettingsPage() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [orgName, setOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/v1/enterprise/org', { cache: 'no-store' })
      const json = await res.json() as { data?: { org?: OrgData; members?: Member[] } }
      setOrg(json.data?.org || null)
      setMembers(json.data?.members || [])
      setOrgName(json.data?.org?.name || '')
    } catch { /* silent */ }
  }

  useEffect(() => { void load() }, [])

  const saveOrg = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await fetch('/api/v1/enterprise/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      })
      setMessage('Saved')
      await load()
    } catch {
      setMessage('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      await fetch('/api/v1/enterprise/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'analyst' }),
      })
      setInviteEmail('')
      await load()
    } catch { /* silent */ }
    setInviting(false)
  }

  return (
    <div className="max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Organization</h1>
        <p className="text-sm text-white/40 mt-1">Manage your organization profile, members, and settings</p>
      </div>

      {/* Profile + Invite — 2-col grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Org profile */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5">
          <div className="mb-3 text-sm font-semibold text-white">Organization profile</div>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/30 transition"
          />
          <div className="mt-2 text-xs text-white/40">Current plan: {org?.plan_id || 'individual'}</div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => void saveOrg()}
              disabled={saving}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {message && <span className="text-xs text-white/50">{message}</span>}
          </div>
        </div>

        {/* Invite member */}
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-5">
          <div className="mb-3 text-sm font-semibold text-white">Invite member</div>
          <div className="flex gap-2">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="analyst@company.com"
              onKeyDown={(e) => e.key === 'Enter' && void inviteMember()}
              className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/30 transition"
            />
            <button
              onClick={() => void inviteMember()}
              disabled={inviting || !inviteEmail.trim()}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition"
            >
              {inviting ? 'Sending…' : 'Invite'}
            </button>
          </div>
          <p className="mt-3 text-[10px] text-white/25">Invited members will receive an email with instructions to join your workspace.</p>
        </div>
      </div>

      {/* Members table */}
      <div className="mt-6 rounded-xl border border-white/[0.05] bg-white/[0.015] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/30 text-[10px] uppercase tracking-wider">
              <th className="px-5 py-3.5 text-left font-semibold">Member</th>
              <th className="px-5 py-3.5 text-left font-semibold">Role</th>
              <th className="px-5 py-3.5 text-left font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-xs text-white/30">No members found</td>
              </tr>
            ) : members.map((member) => (
              <tr key={member.id} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition">
                <td className="px-5 py-3.5 text-white">{member.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
                    ${member.role === 'owner' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                      : member.role === 'admin' ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                      : 'bg-white/[0.05] text-white/50 border border-white/[0.08]'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-white/40">
                  {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Branding — enterprise only */}
      {org?.plan_id === 'enterprise' && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-white">Branding</h2>
          <BrandingEditor />
        </div>
      )}
    </div>
  )
}
