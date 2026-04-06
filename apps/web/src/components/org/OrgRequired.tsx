'use client'

import { useState } from 'react'

interface OrgRequiredProps {
  feature: string
  description?: string
  children?: React.ReactNode
}

export function OrgRequired({ feature, description, children }: OrgRequiredProps) {
  const [creating, setCreating] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createOrg = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_name: 'My Organization', use_case: 'personal', team_size: 'solo' }),
      })
      const d = await res.json() as { success?: boolean; error?: string }
      if (d.success) {
        setDone(true)
        setTimeout(() => window.location.reload(), 800)
      } else {
        setError(d.error ?? 'Failed to create org')
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  if (done) {
    return (
      <div className="p-8 text-center">
        <div className="text-2xl mb-3">✓</div>
        <div className="text-sm font-bold text-green-500">Organization created — reloading...</div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-md mx-auto text-center">
      <div className="text-3xl mb-4 opacity-40">⊕</div>
      <h3 className="text-base font-bold mono mb-2 text-white">
        {feature} requires an organization
      </h3>
      <p className="text-sm mb-6 text-white/30" style={{ lineHeight: 1.6 }}>
        {description ?? 'Create a free organization to unlock this feature. Takes 2 seconds.'}
      </p>

      {children}

      <button
        onClick={() => void createOrg()}
        disabled={creating}
        className="px-5 py-2.5 rounded text-sm font-bold mono transition-all disabled:opacity-50 bg-blue-500 text-[#080A0E]"
      >
        {creating ? 'CREATING...' : '+ CREATE ORGANIZATION'}
      </button>

      {error && (
        <p className="text-xs mt-3 text-red-400">{error}</p>
      )}
    </div>
  )
}
