'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'conflict_ops_cookie_consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    setVisible(!stored)
  }, [])

  const choose = (value: 'accepted' | 'rejected') => {
    window.localStorage.setItem(STORAGE_KEY, value)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded border p-4 shadow-lg" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs mono font-bold" style={{ color: 'var(--primary)' }}>COOKIE PREFERENCES</div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>We use essential cookies for auth and optional analytics cookies to improve the marketing site.</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => choose('rejected')} className="px-3 py-2 rounded border text-xs mono" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>REJECT ANALYTICS</button>
          <button onClick={() => choose('accepted')} className="px-3 py-2 rounded text-xs mono font-bold" style={{ backgroundColor: 'var(--primary)', color: '#000' }}>ACCEPT ALL</button>
        </div>
      </div>
    </div>
  )
}
