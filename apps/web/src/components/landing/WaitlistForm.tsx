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
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-full rounded-xl border border-white/[0.05] bg-white/[0.015] px-4 py-3 text-sm text-white" />
      <button onClick={() => void submit()} className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white">Join waitlist</button>
      {message ? <div className="text-sm text-white/30">{message}</div> : null}
    </div>
  )
}
