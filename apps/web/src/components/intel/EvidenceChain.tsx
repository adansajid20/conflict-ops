'use client'

import { useMemo } from 'react'

type ChainEntry = {
  actor?: string
  action?: string
  at?: string
  note?: string
}

type EvidenceItem = {
  id: string
  title: string
  hash_sha256?: string | null
  tamper_detected?: boolean
  chain_of_custody?: ChainEntry[] | null
}

function formatAt(value?: string) {
  if (!value) return 'Unknown time'
  return new Date(value).toLocaleString()
}

export function EvidenceChain({ item }: { item: EvidenceItem }) {
  const chain = useMemo(() => item.chain_of_custody ?? [], [item.chain_of_custody])

  return (
    <div className="rounded-xl border p-4 print:border-0" id={`evidence-chain-${item.id}`} style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
          <div className="text-xs mt-1 break-all" style={{ color: 'var(--text-muted)' }}>SHA-256: {item.hash_sha256 ?? 'Unavailable'}</div>
        </div>
        <button onClick={() => window.print()} className="rounded border px-3 py-2 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          Export Chain of Custody
        </button>
      </div>
      <div className="mt-3">
        <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase" style={{ background: item.tamper_detected ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: item.tamper_detected ? '#EF4444' : '#22C55E' }}>
          {item.tamper_detected ? 'Tamper detected' : 'Integrity verified'}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {chain.length === 0 ? <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No custody events recorded.</div> : null}
        {chain.map((entry, index) => (
          <div key={`${entry.at ?? 'na'}-${index}`} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface-2)' }}>
            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{entry.action ?? 'Captured'} · {entry.actor ?? 'System'}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatAt(entry.at)}</div>
            {entry.note ? <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{entry.note}</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
