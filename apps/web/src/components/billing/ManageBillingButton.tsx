'use client'

import { useState } from 'react'

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false)

  const openPortal = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/billing/portal', { method: 'POST' })
      const json = await res.json() as { url?: string; error?: string }
      if (json.url) window.location.href = json.url
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={openPortal}
      disabled={loading}
      className="px-4 py-2 rounded text-xs mono border transition-colors hover:bg-white/5 disabled:opacity-50"
      style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
    >
      {loading ? 'LOADING...' : 'MANAGE BILLING →'}
    </button>
  )
}
