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
      <div className="mb-8 flex items-center justify-center gap-3">
        <button
          onClick={() => setBilling('monthly')}
          className={`rounded border px-4 py-2 text-xs font-medium transition-colors ${billing === 'monthly' ? 'border-blue-400 bg-blue-500/20 text-blue-400' : 'border-white/[0.08] bg-white/[0.05] text-white/60 hover:bg-white/[0.08]'}`}
        >
          MONTHLY
        </button>
        <button
          onClick={() => setBilling('annual')}
          className={`rounded border px-4 py-2 text-xs font-medium transition-colors ${billing === 'annual' ? 'border-blue-400 bg-blue-500/20 text-blue-400' : 'border-white/[0.08] bg-white/[0.05] text-white/60 hover:bg-white/[0.08]'}`}
        >
          ANNUAL <span className="text-green-400">(-20%)</span>
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
              className={`flex flex-col rounded border p-6 ${plan.highlighted ? 'border-blue-400 bg-white/[0.03] hover:bg-white/[0.05]' : 'border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03]'}`}
            >
              {plan.highlighted && (
                <div className="mb-3 rounded bg-blue-500 px-2 py-1 text-center text-xs font-medium text-white">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-1 text-sm font-bold tracking-widest text-white">
                {plan.name}
              </div>
              <div className="mb-4 text-xs text-white/80">
                {plan.description}
              </div>

              <div className="mb-6">
                <span className="text-3xl font-bold text-blue-400">
                  ${displayPrice}
                </span>
                <span className="ml-1 text-xs text-white/50">
                  /mo
                </span>
                {billing === 'annual' && (
                  <div className="mt-1 text-xs text-white/50">
                    ${price}/yr · save ${plan.price * 12 - plan.annualPrice}
                  </div>
                )}
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-white/80">
                    <span className="shrink-0 text-green-400">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div
                  className="rounded border border-white/[0.08] bg-white/[0.05] py-2 text-center text-xs font-medium text-white/60"
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
                  className={`rounded border py-2 text-xs font-bold tracking-wider transition-colors disabled:opacity-50 ${plan.highlighted ? 'border-blue-400 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'border-white/[0.08] bg-white/[0.05] text-white/60 hover:bg-white/[0.08]'}`}
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
        className="mt-6 flex items-center justify-between rounded border border-white/[0.05] bg-white/[0.015] p-6 hover:bg-white/[0.03]"
      >
        <div>
          <div className="mb-1 text-sm font-bold tracking-widest text-white">
            ENTERPRISE
          </div>
          <div className="text-xs text-white/80">
            SSO/SAML · Custom SLA · Dedicated tenant · Gov/defense procurement · White-label
          </div>
        </div>
        <div className="ml-4 shrink-0 text-right">
          <div className="text-lg font-bold text-white">$2,000+/mo</div>
          <a
            href="mailto:enterprise@conflictradar.co"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            CONTACT SALES →
          </a>
        </div>
      </div>
    </div>
  )
}
