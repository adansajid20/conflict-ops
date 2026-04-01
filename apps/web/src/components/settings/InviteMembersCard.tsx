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

  const loadInvites = async () => {
    if (!isAdmin) return
    const res = await fetch('/api/v1/enterprise/invite', { cache: 'no-store' })
    const json = await res.json() as { data?: InviteRecord[] }
    setPending(json.data ?? [])
  }

  useEffect(() => { void loadInvites() }, [isAdmin])

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
        void loadInvites()
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) return null

  return (
    <div className="mt-6 rounded border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs mono tracking-widest" style={{ color: 'var(--text-muted)' }}>MEMBER INVITES</div>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>Invite analysts without leaving the dashboard.</div>
        </div>
        <button onClick={() => setOpen((value) => !value)} className="rounded px-4 py-2 text-xs mono font-bold" style={{ background: 'var(--primary)', color: '#fff' }}>
          {open ? 'CLOSE' : 'INVITE MEMBER'}
        </button>
      </div>

      {open && (
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com"
            className="rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }} />
          <select value={role} onChange={(event) => setRole(event.target.value)}
            className="rounded border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
            <option value="viewer">viewer</option>
            <option value="analyst">analyst</option>
            <option value="admin">admin</option>
          </select>
          <button disabled={!email || loading} onClick={() => void submit()} className="rounded px-4 py-2 text-xs mono font-bold" style={{ background: 'var(--primary)', color: '#fff', opacity: !email || loading ? 0.5 : 1 }}>
            {loading ? 'SENDING...' : 'SEND INVITE'}
          </button>
        </div>
      )}

      {error && <div className="mb-3 text-xs mono" style={{ color: 'var(--sev-critical)' }}>{error}</div>}

      <div className="space-y-2">
        {pending.length === 0 ? (
          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>No pending invites.</div>
        ) : pending.map((invite) => (
          <div key={invite.id} className="flex items-center justify-between rounded border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
            <div>
              <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{invite.email}</div>
              <div className="text-[11px] mono" style={{ color: 'var(--text-muted)' }}>{invite.role.toUpperCase()} · expires {new Date(invite.expires_at).toLocaleDateString()}</div>
            </div>
            <div className="text-[11px] mono" style={{ color: 'var(--text-muted)' }}>{new Date(invite.created_at).toLocaleDateString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
