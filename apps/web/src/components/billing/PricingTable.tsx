'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { Check, X, Zap } from 'lucide-react'

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
    },
  },
  hover: {
    y: -8,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
    },
  },
}

export function PricingTable({ currentPlan }: { currentPlan?: string }) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-12"
    >
      {/* Billing Toggle */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center gap-4"
      >
        <div className="inline-flex gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5 backdrop-blur-sm">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
              billing === 'monthly'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
              billing === 'annual'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Annual
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              billing === 'annual'
                ? 'bg-green-400/20 text-green-300'
                : 'bg-green-500/20 text-green-400'
            }`}>
              Save 20%
            </span>
          </button>
        </div>
      </motion.div>

      {/* Plan Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const displayPrice = billing === 'annual'
            ? Math.round(plan.annualPrice / 12)
            : plan.price
          const savings = billing === 'annual' ? plan.price * 12 - plan.annualPrice : 0

          return (
            <motion.div
              key={plan.id}
              variants={cardVariants}
              whileHover={!isCurrent ? 'hover' : undefined}
              whileTap={!isCurrent ? { scale: 0.98 } : undefined}
            >
              <div className={`group relative h-full overflow-hidden rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
                plan.highlighted
                  ? 'border-blue-500/50 bg-gradient-to-br from-blue-500/10 to-blue-600/5 hover:border-blue-500/80 hover:shadow-lg hover:shadow-blue-500/20'
                  : 'border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] hover:border-white/20 hover:shadow-lg hover:shadow-blue-500/10'
              }`}>
                {/* Animated Background */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                  plan.highlighted
                    ? 'bg-gradient-to-br from-blue-500/15 to-blue-600/5'
                    : 'bg-gradient-to-br from-white/5 to-transparent'
                }`} />

                {/* Top Edge Highlight */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="relative z-10 p-8 flex flex-col h-full">
                  {/* Badge */}
                  {plan.highlighted && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-1.5 text-xs font-bold text-white w-fit"
                    >
                      <Zap className="h-3 w-3" />
                      Most Popular
                    </motion.div>
                  )}

                  {/* Plan Name */}
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-white/60 mb-6">{plan.description}</p>

                  {/* Pricing */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-5xl font-bold text-blue-400">${displayPrice}</span>
                      <span className="text-sm text-white/50">/month</span>
                    </div>
                    {billing === 'annual' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-green-400 font-semibold"
                      >
                        ${plan.annualPrice}/year · Save ${savings}
                      </motion.div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <motion.div
                        key={feature}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 text-sm text-white/80"
                      >
                        <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        {feature}
                      </motion.div>
                    ))}
                  </div>

                  {/* CTA */}
                  {isCurrent ? (
                    <div className="rounded-lg border border-white/[0.08] bg-white/[0.05] py-3 text-center text-sm font-semibold text-white/60">
                      Current Plan
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        setLoading(plan.id)
                        await startCheckout(plan.id, billing)
                        setLoading(null)
                      }}
                      disabled={loading !== null}
                      className={`w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        plan.highlighted
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20'
                          : 'bg-white/[0.08] text-white border border-white/10 hover:bg-white/[0.12] hover:border-white/20'
                      } disabled:opacity-50`}
                    >
                      {loading === plan.id ? 'Redirecting...' : plan.cta}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Enterprise Card */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.3 }}
        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/10"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
            <p className="text-sm text-white/60">SSO/SAML · Custom SLA · Dedicated tenant · Gov/defense procurement · White-label</p>
          </div>
          <div className="ml-8 text-right flex-shrink-0">
            <div className="text-3xl font-bold text-white mb-2">$2,000+</div>
            <p className="text-xs text-white/60 mb-4">/month</p>
            <motion.a
              whileHover={{ scale: 1.05 }}
              href="mailto:enterprise@conflictradar.co"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all text-sm font-semibold"
            >
              Contact Sales
              <span>→</span>
            </motion.a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
