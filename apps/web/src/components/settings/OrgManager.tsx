'use client'

import { useEffect, useState, useCallback } from 'react'

type Member = { id: string; email: string; role: string; created_at: string; last_active: string | null }
type OrgData = {
  id: string
  name: string
  plan_id: string
  seats_used: number
  seats_limit: number
  sso_enabled: boolean
  sso_provider: string | null
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: '⬡ OWNER', admin: '◈ ADMIN', analyst: '◯ ANALYST', viewer: '▷ VIEWER',
}

export function OrgManager() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/enterprise/org')
      const json = await res.json() as { data?: { org: OrgData; members: Member[] } }
      if (json.data) { setOrg(json.data.org); setMembers(json.data.members) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const updateRole = async (userId: string, role: string) => {
    setUpdating(userId)
    try {
      await fetch('/api/v1/enterprise/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_member', user_id: userId, role }),
      })
      await load()
    } finally { setUpdating(null) }
  }

  const removeMember = async (userId: string) => {
    if (!confirm('Remove this member from the org?')) return
    setUpdating(userId)
    try {
      await fetch('/api/v1/enterprise/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_member', user_id: userId }),
      })
      await load()
    } finally { setUpdating(null) }
  }

  if (loading) return <p className="text-xs mono text-center py-8" style={{ color: 'var(--text-muted)' }}>LOADING...</p>

  return (
    <div>
      {/* Org summary */}
      {org && (
        <div className="p-4 rounded border mb-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="grid grid-cols-2 gap-4 text-xs mono">
            {[
              { label: 'ORG NAME', val: org.name },
              { label: 'PLAN', val: org.plan_id.toUpperCase() },
              { label: 'SEATS', val: `${org.seats_used} / ${org.seats_limit === -1 ? '∞' : org.seats_limit}` },
              { label: 'SSO', val: org.sso_enabled ? `✓ ${org.sso_provider?.toUpperCase()}` : '✗ DISABLED' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ color: 'var(--text-muted)' }}>{f.label}</div>
                <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{f.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
        MEMBERS ({members.length})
      </div>
      {members.map(m => (
        <div key={m.id} className="p-3 rounded border mb-2 flex items-center gap-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="flex-1">
            <div className="text-xs mono font-bold" style={{ color: 'var(--text-primary)' }}>{m.email}</div>
            <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
              Joined {new Date(m.created_at).toLocaleDateString()}
              {m.last_active && ` · Last active ${new Date(m.last_active).toLocaleDateString()}`}
            </div>
          </div>
          <select
            value={m.role}
            onChange={e => void updateRole(m.id, e.target.value)}
            disabled={updating === m.id || m.role === 'owner'}
            className="px-2 py-1 text-xs mono rounded border"
            style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {Object.entries(ROLE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          {m.role !== 'owner' && (
            <button onClick={() => void removeMember(m.id)} disabled={updating === m.id}
              className="px-2 py-1 text-xs mono rounded border"
              style={{ borderColor: '#EF4444', color: '#EF4444' }}>
              ✕
            </button>
          )}
        </div>
      ))}

      {/* SSO note */}
      {org && !org.sso_enabled && (
        <div className="mt-6 p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="text-xs mono font-bold mb-1" style={{ color: 'var(--text-muted)' }}>SSO / SAML</div>
          <p className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
            SSO with SAML 2.0 or OIDC is available on the Enterprise plan.
            Contact sales to enable: <span style={{ color: 'var(--primary)' }}>enterprise@conflictradar.co</span>
          </p>
        </div>
      )}
    </div>
  )
}
