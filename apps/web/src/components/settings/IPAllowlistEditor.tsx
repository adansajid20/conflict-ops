'use client'

import { useState } from 'react'

export function IPAllowlistEditor({ initial = [] }: { initial?: string[] }) {
  const [value, setValue] = useState(initial.join('\n'))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    setSaving(true)
    setMessage(null)
    const ip_allowlist = value.split('\n').map((entry) => entry.trim()).filter(Boolean)
    const res = await fetch('/api/v1/enterprise/ip-allowlist', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ip_allowlist }) })
    const json = await res.json() as { success: boolean; error?: string }
    setMessage(json.success ? 'IP allowlist updated.' : (json.error ?? 'Failed to update allowlist.'))
    setSaving(false)
  }

  return (
    <div className="p-4 rounded border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="text-xs mono font-bold mb-2" style={{ color: 'var(--text-muted)' }}>IP ALLOWLIST</div>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={6} className="w-full rounded border px-3 py-2 text-xs mono" style={{ backgroundColor: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} placeholder={'203.0.113.10\n203.0.113.0/24'} />
      <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>One IP or CIDR block per line. Empty allowlist means allow all.</div>
      <button onClick={() => void save()} disabled={saving} className="mt-4 px-4 py-2 rounded text-xs mono font-bold" style={{ backgroundColor: 'var(--primary)', color: '#000' }}>{saving ? 'SAVING...' : 'SAVE ALLOWLIST'}</button>
      {message ? <div className="mt-2 text-xs mono" style={{ color: 'var(--text-muted)' }}>{message}</div> : null}
    </div>
  )
}
