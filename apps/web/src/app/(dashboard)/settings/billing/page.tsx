'use client'

import { useEffect, useState } from 'react'

type Billing = { plan?: string; usage?: { events?: number; alerts?: number; apiCalls?: number }; limits?: { events?: number; alerts?: number; apiCalls?: number } }

export default function BillingPage() {
  const [billing, setBilling] = useState<Billing>({ plan: 'Pro', usage: { events: 1842, alerts: 23, apiCalls: 120 }, limits: { events: 5000, alerts: 100, apiCalls: 1000 } })
  useEffect(() => { void fetch('/api/v1/billing/portal', { method: 'POST' }).catch(() => null) }, [])
  const openPortal = async () => { const res = await fetch('/api/v1/billing/portal', { method: 'POST' }); const json = await res.json(); if (json.url) window.location.href = json.url }
  return <div className="p-6 max-w-4xl"><h1 className="text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>Billing</h1><div className="mt-2 inline-flex rounded-full px-2 py-1 text-sm" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>{billing.plan} plan</div><div className="mt-6 grid gap-4 md:grid-cols-3">{Object.entries(billing.usage || {}).map(([key, value]) => { const limit = billing.limits?.[key as keyof typeof billing.limits] || 1; const pct = Math.min(100, Math.round((value / limit) * 100)); return <div key={key} className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}><div className="text-sm capitalize" style={{ color: 'var(--text-primary)' }}>{key}</div><div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>{value}/{limit}</div><div className="mt-3 h-2 rounded-full" style={{ background: 'var(--bg-surface-3)' }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} /></div></div> })}</div><div className="mt-6 flex gap-3"><button className="rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--primary)', color: '#fff' }}>Upgrade Plan</button><button onClick={() => void openPortal()} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>Manage Billing</button></div></div>
}
