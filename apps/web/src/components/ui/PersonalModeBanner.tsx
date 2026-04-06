'use client'

import { Info } from 'lucide-react'

export function PersonalModeBanner() {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3 border-blue-500/30 bg-blue-500/[0.06]">
      {(() => { const InfoIcon = Info as any; return <InfoIcon size={16} className="text-blue-400 shrink-0" /> })()}
      <div>
        <div className="text-sm font-medium text-white">
          Team features require a workspace
        </div>
        <div className="text-xs mt-0.5 text-white/50">
          Alerts, PIRs, and missions are collaboration tools. Create a workspace to unlock them.
        </div>
      </div>
      <a href="/settings/org"
        className="ml-auto shrink-0 rounded-md px-3 py-1.5 text-xs font-medium bg-blue-500 text-white">
        Create workspace
      </a>
    </div>
  )
}
