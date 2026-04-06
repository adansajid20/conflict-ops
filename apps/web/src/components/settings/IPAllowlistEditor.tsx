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
    <div className="p-4 rounded border border-white/[0.05] bg-white/[0.015]">
      <div className="text-xs mono font-bold mb-2 text-white/30">IP ALLOWLIST</div>
      <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={6} className="w-full rounded border border-white/[0.05] bg-white/[0.03] px-3 py-2 text-xs mono text-white placeholder:text-white/20" placeholder={'203.0.113.10\n203.0.113.0/24'} />
      <div className="mt-2 text-xs text-white/30">One IP or CIDR block per line. Empty allowlist means allow all.</div>
      <button onClick={() => void save()} disabled={saving} className="mt-4 px-4 py-2 rounded text-xs mono font-bold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">{saving ? 'SAVING...' : 'SAVE ALLOWLIST'}</button>
      {message ? <div className="mt-2 text-xs mono text-white/30">{message}</div> : null}
    </div>
  )
}
