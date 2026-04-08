'use client'

import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import { useRef, useState } from 'react'
import { Shield, ArrowRight, Check, Sparkles, Zap } from 'lucide-react'
import { PLANS } from '@/lib/pricing/plans'

function BlurIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return <motion.div ref={ref} initial={{ opacity: 0, filter: 'blur(12px)', y: 20 }} animate={isInView ? { opacity: 1, filter: 'blur(0px)', y: 0 } : {}} transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }} className={className}>{children}</motion.div>
}

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-50px' })
  return <motion.div ref={ref} initial={{ opacity: 0, y: 28 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }} className={className}>{children}</motion.div>
}

const COMPARISON = [
  ['Real-time event feed',    '24h delay', '✓', '✓', '✓'],
  ['Conflict map',            'View only', '✓', '✓', '✓'],
  ['AI Co-pilot',             '—', '—', '✓', '✓'],
  ['Custom alert rules',      '3', '10', '50', 'Unlimited'],
  ['Analysis workbench',      '—', '—', '✓', '✓'],
  ['Actor network',           '—', 'View', '✓', '✓'],
  ['Similarity search',       '—', '—', '✓', '✓'],
  ['REST API',                '—', '—', '✓', '✓'],
  ['Webhooks',                '—', '—', '✓', '✓'],
  ['Workbench boards',        '—', '—', '—', '✓'],
  ['Team features',           '—', '—', '—', '✓'],
  ['Prediction engine',       '—', 'View', '✓', '✓'],
  ['Feed history',            '24h', '7 days', '30 days', 'Unlimited'],
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleCheckout = async (plan: typeof PLANS[number]) => {
    if (!plan.stripePriceId) return
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
    <div className="min-h-screen" style={{ background: '#070B11', color: '#fff' }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#070B11]/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2.5">
            <Shield size={20} className="text-blue-400" />
            <span className="font-bold text-[15px] text-white">ConflictRadar</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm text-white/50 hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="text-sm text-blue-400">Pricing</Link>
            <Link href="/methods" className="text-sm text-white/50 hover:text-white transition-colors">Methods</Link>
            <Link href="/wire" className="text-sm text-white/50 hover:text-white transition-colors">Live Wire</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
            <Link href="/sign-up" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative">
        {/* Background accents */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[400px] bg-blue-600/[0.08] rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/3 w-[500px] h-[400px] bg-cyan-600/[0.06] rounded-full blur-[130px]" />
        </div>

        <BlurIn className="max-w-4xl mx-auto text-center relative z-10">
          <motion.p className="text-sm font-bold text-blue-400 tracking-widest uppercase mb-6 flex items-center justify-center gap-2">
            <Zap size={14} /> Transparent Pricing
          </motion.p>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-tight">
            <span className="bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent">
              Simple, transparent pricing.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/45 max-w-2xl mx-auto leading-relaxed">
            Start free forever. Upgrade when you need more. No long-term contracts. No enterprise procurement circus.
          </p>
        </BlurIn>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-7xl mx-auto px-6 pb-32">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <FadeUp key={plan.id} delay={i * 0.1}>
              <motion.div
                whileHover={plan.popular ? { y: -8, boxShadow: '0 25px 60px rgba(59,130,246,0.2)' } : { y: -4 }}
                transition={{ duration: 0.3, type: 'spring' as const, stiffness: 200 }}
                className={`flex flex-col rounded-2xl border p-8 h-full transition-all relative overflow-hidden group ${
                  plan.popular
                    ? 'border-blue-400/50 bg-gradient-to-br from-blue-500/15 to-blue-500/5'
                    : 'border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-white/[0.005] hover:border-white/[0.15]'
                }`}
              >
                {/* Background glow on popular */}
                {plan.popular && (
                  <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity" />
                )}

                {plan.popular && (
                  <motion.div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400 text-xs font-bold text-white shadow-lg shadow-blue-500/30"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Most Popular
                  </motion.div>
                )}

                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-white/40 mb-6">{plan.desc}</p>
                  <div className="mb-8">
                    <span className="text-5xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">{plan.price}</span>
                    {plan.period && <span className="text-sm text-white/40 ml-2">{plan.period}</span>}
                  </div>
                </div>

                <ul className="flex-1 space-y-4 mb-8 relative z-10">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-white/50">
                      <Check size={16} className="mt-0.5 flex-shrink-0 text-blue-300" />
                      <span className="font-medium">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="relative z-10">
                  {!plan.stripePriceId ? (
                    <a
                      href="mailto:enterprise@conflictradar.co"
                      className="block rounded-xl py-3 text-center text-sm font-bold border-2 border-white/[0.15] text-white/70 hover:text-white hover:border-white/30 transition-all"
                    >
                      Contact Sales
                    </a>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCheckout(plan)}
                      disabled={loading === plan.id}
                      className={`block w-full rounded-xl py-3.5 text-center text-sm font-bold transition-all cursor-pointer ${
                        plan.popular
                          ? 'bg-gradient-to-r from-white to-blue-50 text-gray-900 hover:from-blue-50 hover:to-white shadow-lg shadow-white/20'
                          : 'border-2 border-white/[0.15] text-white/70 hover:text-white hover:border-white/30 hover:bg-white/[0.05]'
                      }`}
                      style={{ opacity: loading === plan.id ? 0.6 : 1 }}
                    >
                      {loading === plan.id ? 'Redirecting...' : plan.price === '$0' ? 'Get Started Free' : 'Start 14-Day Trial'}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <BlurIn className="text-center mb-12">
          <h2 className="text-2xl font-bold text-white">Feature comparison</h2>
        </BlurIn>
        <FadeUp>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-4 text-white/40 font-medium">Feature</th>
                  {['Free', 'Scout', 'Analyst', 'Operator'].map((h) => (
                    <th key={h} className={`px-5 py-4 font-medium ${h === 'Analyst' ? 'text-blue-400 bg-blue-500/[0.03]' : 'text-white/40'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row[0]} className="border-t border-white/[0.04]">
                    <td className="px-5 py-3 text-white/50">{row[0]}</td>
                    {[1, 2, 3, 4].map((idx) => {
                      const val = row[idx]
                      const isAnalyst = idx === 3
                      const isPositive = val === '✓' || val === 'Unlimited'
                      const isDash = val === '—'
                      return (
                        <td
                          key={idx}
                          className={`px-5 py-3 ${isAnalyst ? 'bg-blue-500/[0.03]' : ''} ${
                            isPositive ? 'text-green-400/80' : isDash ? 'text-white/15' : 'text-white/40'
                          }`}
                        >
                          {val}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FadeUp>
      </section>

      {/* Bottom note */}
      <section className="border-t border-white/[0.04] py-16 px-6">
        <div className="text-center">
          <p className="text-sm text-white/30 mb-2">All plans include a 14-day free trial. No credit card required to start.</p>
          <p className="text-sm text-white/30">
            Questions? <a href="mailto:support@conflictradar.co" className="text-blue-400 hover:text-blue-300 transition-colors">support@conflictradar.co</a>
          </p>
        </div>
      </section>
    </div>
  )
}
