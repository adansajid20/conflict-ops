'use client'

import { useState } from 'react'

type Plan = {
  id: string
  name: string
  price: number
  annualPrice: number
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'individual',
    name: 'INDIVIDUAL',
    price: 9,
    annualPrice: 86,
    description: 'For solo analysts and researchers',
    features: [
      'Intel feed (real-time)',
      'Situation map',
      '30-day event history',
      '3 missions',
      'Dashboard + KPIs',
      'Email alerts',
    ],
    cta: 'START FREE TRIAL',
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 29,
    annualPrice: 278,
    description: 'For professional analysts',
    features: [
      'Everything in Individual',
      'Monte Carlo scenarios',
      'ACH hypothesis matrix',
      'SAT suite (all 5 tools)',
      'Corkboard / link analysis',
      '180-day event history',
      '15 missions',
      'PDF/CSV export',
      'Priority intelligence requirements (PIR)',
      'Escalation ladder model',
    ],
    cta: 'START FREE TRIAL',
    highlighted: true,
  },
  {
    id: 'business',
    name: 'BUSINESS',
    price: 299,
    annualPrice: 2870,
    description: 'For teams and organizations',
    features: [
      'Everything in Pro',
      'Org mode (5 seats included)',
      'Shared missions + corkboards',
      'Webhooks + REST API',
      'Role-based access (RBAC)',
      'Audit log',
      '2-year event history',
      'Unlimited missions',
      'White-label reports',
      'Priority support',
    ],
    cta: 'START FREE TRIAL',
  },
]

async function startCheckout(planId: string, billing: 'monthly' | 'annual') {
  const res = await fetch('/api/v1/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: planId, billing }),
  })

  const json = await res.json() as { url?: string; error?: string }
  if (json.url) {
    window.location.href = json.url
  } else {
    alert(`Checkout error: ${json.error ?? 'Unknown error'}`)
  }
}

export function PricingTable({ currentPlan }: { currentPlan?: string }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setBilling('monthly')}
          className="px-4 py-2 rounded text-xs mono border transition-colors"
          style={{
            borderColor: billing === 'monthly' ? 'var(--primary)' : 'var(--border)',
            color: billing === 'monthly' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: billing === 'monthly' ? 'var(--primary-10)' : 'transparent',
          }}
        >
          MONTHLY
        </button>
        <button
          onClick={() => setBilling('annual')}
          className="px-4 py-2 rounded text-xs mono border transition-colors"
          style={{
            borderColor: billing === 'annual' ? 'var(--primary)' : 'var(--border)',
            color: billing === 'annual' ? 'var(--primary)' : 'var(--text-muted)',
            backgroundColor: billing === 'annual' ? 'var(--primary-10)' : 'transparent',
          }}
        >
          ANNUAL <span style={{ color: 'var(--alert-green)' }}>(-20%)</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.id
          const price = billing === 'annual' ? plan.annualPrice : plan.price * 12
          const displayPrice = billing === 'annual'
            ? Math.round(plan.annualPrice / 12)
            : plan.price

          return (
            <div
              key={plan.id}
              className="rounded border p-6 flex flex-col"
              style={{
                backgroundColor: plan.highlighted ? 'var(--bg-surface-2)' : 'var(--bg-surface)',
                borderColor: plan.highlighted ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {plan.highlighted && (
                <div className="text-xs mono text-center mb-3 px-2 py-1 rounded" style={{ backgroundColor: 'var(--primary)', color: 'var(--bg-base)' }}>
                  MOST POPULAR
                </div>
              )}

              <div className="text-sm font-bold mono tracking-widest mb-1" style={{ color: 'var(--text-primary)' }}>
                {plan.name}
              </div>
              <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                {plan.description}
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold mono" style={{ color: 'var(--primary)' }}>
                  ${displayPrice}
                </span>
                <span className="text-xs mono ml-1" style={{ color: 'var(--text-muted)' }}>
                  /mo
                </span>
                {billing === 'annual' && (
                  <div className="text-xs mono mt-1" style={{ color: 'var(--text-muted)' }}>
                    ${price}/yr · save ${plan.price * 12 - plan.annualPrice}
                  </div>
                )}
              </div>

              <ul className="flex-1 mb-6 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs mono" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--alert-green)', flexShrink: 0 }}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div
                  className="text-center py-2 rounded text-xs mono border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  CURRENT PLAN
                </div>
              ) : (
                <button
                  onClick={async () => {
                    setLoading(plan.id)
                    await startCheckout(plan.id, billing)
                    setLoading(null)
                  }}
                  disabled={loading !== null}
                  className="py-2 rounded text-xs mono font-bold tracking-wider border transition-colors hover:bg-white/5 disabled:opacity-50"
                  style={{
                    borderColor: plan.highlighted ? 'var(--primary)' : 'var(--border)',
                    color: plan.highlighted ? 'var(--primary)' : 'var(--text-muted)',
                  }}
                >
                  {loading === plan.id ? 'REDIRECTING...' : plan.cta}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Enterprise */}
      <div
        className="mt-6 rounded border p-6 flex items-center justify-between"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div>
          <div className="text-sm font-bold mono tracking-widest mb-1" style={{ color: 'var(--text-primary)' }}>
            ENTERPRISE
          </div>
          <div className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
            SSO/SAML · Custom SLA · Dedicated tenant · Gov/defense procurement · White-label
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <div className="text-lg font-bold mono" style={{ color: 'var(--text-primary)' }}>$2,000+/mo</div>
          <a
            href="mailto:enterprise@conflictops.com"
            className="text-xs mono"
            style={{ color: 'var(--primary)' }}
          >
            CONTACT SALES →
          </a>
        </div>
      </div>
    </div>
  )
}
