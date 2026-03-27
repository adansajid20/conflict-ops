'use client'

import { Info } from 'lucide-react'

export function PersonalModeBanner() {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3"
      style={{ borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.06)' }}>
      {(() => { const InfoIcon = Info as any; return <InfoIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} /> })()}
      <div>
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Team features require a workspace
        </div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Alerts, PIRs, and missions are collaboration tools. Create a workspace to unlock them.
        </div>
      </div>
      <a href="/settings/org"
        className="ml-auto shrink-0 rounded-md px-3 py-1.5 text-xs font-medium"
        style={{ background: 'var(--primary)', color: '#fff', textDecoration: 'none' }}>
        Create workspace
      </a>
    </div>
  )
}
