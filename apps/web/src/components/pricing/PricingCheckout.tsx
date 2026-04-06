'use client'

import { useState } from 'react'
import Link from 'next/link'

type Plan = {
  id: string; name: string; price: string; priceMonthly: number | null
  period: string; desc: string; stripePriceId: string | null
  features: readonly string[]; popular?: boolean
}

export function PricingCheckout({ plans }: { plans: readonly Plan[] }) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = async (plan: Plan) => {
    if (!plan.stripePriceId || plan.id === 'enterprise') return
    setLoading(plan.id)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ priceId: plan.stripePriceId, planId: plan.id }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
      else alert(data.error ?? 'Checkout unavailable — contact support@conflictradar.co')
    } catch {
      alert('Checkout error — try again or contact support@conflictradar.co')
    }
    setLoading(null)
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className="flex flex-col rounded border p-6"
          style={{
            borderColor: plan.popular ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            backgroundColor: plan.popular ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.015)',
          }}
        >
          {plan.popular && (
            <div className="mb-3 text-xs font-bold tracking-widest mono text-blue-400">
              ◆ MOST POPULAR
            </div>
          )}
          <h3 className="mb-1 font-bold tracking-widest mono text-white">{plan.name.toUpperCase()}</h3>
          <p className="mb-4 text-xs text-white/30">{plan.desc}</p>
          <div className="mb-6">
            <span className="text-3xl font-bold text-white">{plan.price}</span>
            <span className="text-sm text-white/30">{plan.period}</span>
          </div>
          <ul className="mb-6 flex-1 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-white/30">
                <span style={{ color: 'var(--alert-green)' }}>✓</span>{f}
              </li>
            ))}
          </ul>
          {plan.id === 'enterprise' ? (
            <a
              href="mailto:enterprise@conflictradar.co"
              className="block rounded py-2.5 text-center text-sm font-bold tracking-wider mono text-blue-400 border border-blue-400"
            >
              Contact Sales
            </a>
          ) : (
            <button
              onClick={() => handleCheckout(plan)}
              disabled={loading === plan.id}
              className="block w-full rounded py-2.5 text-center text-sm font-bold tracking-wider mono cursor-pointer"
              style={{
                backgroundColor: plan.popular ? '#3b82f6' : 'transparent',
                color: plan.popular ? '#000' : '#3b82f6',
                border: plan.popular ? 'none' : '1px solid #3b82f6',
                opacity: loading === plan.id ? 0.6 : 1,
              }}
            >
              {loading === plan.id ? 'Redirecting…' : 'Start Free Trial'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
