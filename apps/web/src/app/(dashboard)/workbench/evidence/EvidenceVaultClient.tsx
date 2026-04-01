'use client'

import { useEffect, useState } from 'react'
import { EvidenceChain } from '@/components/intel/EvidenceChain'

type EvidenceItem = {
  id: string
  title: string
  hash_sha256?: string | null
  tamper_detected: boolean
  chain_of_custody?: Array<{ actor?: string; action?: string; at?: string; note?: string }> | null
}

export function EvidenceVaultClient() {
  const [items, setItems] = useState<EvidenceItem[]>([])

  useEffect(() => {
    void fetch('/api/v1/evidence', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ data?: EvidenceItem[] }>)
      .then((json) => setItems(json.data ?? []))
      .catch(() => setItems([]))
  }, [])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold mono tracking-wide" style={{ color: 'var(--text-primary)' }}>Evidence Vault</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Integrity checks and chain-of-custody exports.</p>
      </div>
      {items.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No evidence items found.</div> : null}
      {items.map((item) => <EvidenceChain key={item.id} item={item} />)}
    </div>
  )
}
