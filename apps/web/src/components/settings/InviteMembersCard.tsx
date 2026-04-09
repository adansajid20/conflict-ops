'use client'

import { useEffect, useState } from 'react'

type InviteRecord = {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
}

export function InviteMembersCard({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('analyst')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<InviteRecord[]>([])

  useEffect(() => {
    const loadInvites = async () => {
      if (!isAdmin) return
      const res = await fetch('/api/v1/enterprise/invite', { cache: 'no-store' })
      const json = await res.json() as { data?: InviteRecord[] }
      setPending(json.data ?? [])
    }
    void loadInvites()
  }, [isAdmin])

  const submit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/enterprise/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!json.success) {
        setError(json.error ?? 'Failed to invite member')
      } else {
        setEmail('')
        setRole('analyst')
        setOpen(false)
        const res2 = await fetch('/api/v1/enterprise/invite', { cache: 'no-store' })
        const json2 = await res2.json() as { data?: InviteRecord[] }
        setPending(json2.data ?? [])
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="mt-6 rounded border border-white/[0.05] bg-white/[0.015] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs mono tracking-widest text-white/30">MEMBER INVITES</div>
          <div className="text-sm text-white">Invite analysts without leaving the dashboard.</div>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="rounded bg-blue-500 px-4 py-2 text-xs mono font-bold text-white hover:bg-blue-600">
          {open ? 'CLOSE' : 'INVITE MEMBER'}
        </button>
      </div>

      {open && (
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com"
            className="rounded border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/20" />
          <select value={role} onChange={(event) => setRole(event.target.value)}
            className="rounded border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-sm text-white">
            <option value="viewer">viewer</option>
            <option value="analyst">analyst</option>
            <option value="admin">admin</option>
          </select>
          <button disabled={!email || loading} onClick={() => void submit()} className="rounded bg-blue-500 px-4 py-2 text-xs mono font-bold text-white hover:bg-blue-600 disabled:opacity-50">
            {loading ? 'SENDING...' : 'SEND INVITE'}
          </button>
        </div>
      )}

      {error && <div className="mb-3 text-xs mono text-red-400">{error}</div>}

      <div className="space-y-2">
        {pending.length === 0 ? (
          <div className="text-xs mono text-white/30">No pending invites.</div>
        ) : pending.map((invite) => (
          <div key={invite.id} className="flex items-center justify-between rounded border border-white/[0.05] bg-white/[0.03] px-3 py-2">
            <div>
              <div className="text-sm text-white">{invite.email}</div>
              <div className="text-[11px] mono text-white/30">{invite.role.toUpperCase()} · expires {new Date(invite.expires_at).toLocaleDateString()}</div>
            </div>
            <div className="text-[11px] mono text-white/30">{new Date(invite.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
