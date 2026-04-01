'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function TravelCheckinPage() {
  const params = useSearchParams()
  const [status, setStatus] = useState('Ready to check in.')
  const token = params?.get('token') ?? ''
  const submit = async () => { const res = await fetch(`/api/v1/travel?token=${encodeURIComponent(token)}`, { method: 'PATCH' }); const json = await res.json() as { success: boolean; error?: string }; setStatus(json.success ? 'Check-in recorded.' : (json.error ?? 'Check-in failed.')) }
  return <div className="mx-auto max-w-xl p-8"><div className="rounded-xl border p-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Traveler Check-In</h1><p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Use the secure tokenized link to record duty-of-care status.</p><button onClick={() => void submit()} disabled={!token} className="mt-4 rounded px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Check in now</button><div className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{status}</div></div></div>
}
