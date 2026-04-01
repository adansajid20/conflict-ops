'use client'

import { useState } from 'react'

export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  async function submit() {
    const response = await fetch('/api/v1/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await response.json() as { success: boolean; error?: string }
    setMessage(json.success ? 'You are on the waitlist.' : (json.error ?? 'Failed to join waitlist'))
    if (json.success) setEmail('')
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-full rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
      <button onClick={() => void submit()} className="rounded-xl px-5 py-3 text-sm font-semibold" style={{ background: 'var(--primary)', color: '#fff' }}>Join waitlist</button>
      {message ? <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{message}</div> : null}
    </div>
  )
}
