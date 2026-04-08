'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CreditCard, TrendingUp } from 'lucide-react'

type Billing = { plan?: string; usage?: { events?: number; alerts?: number; apiCalls?: number }; limits?: { events?: number; alerts?: number; apiCalls?: number } }

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

const itemVariants = {
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
}

export default function BillingPage() {
  const [billing, setBilling] = useState<Billing>({ plan: 'Pro', usage: { events: 1842, alerts: 23, apiCalls: 120 }, limits: { events: 5000, alerts: 100, apiCalls: 1000 } })

  useEffect(() => { void fetch('/api/v1/billing/portal', { method: 'POST' }).catch(() => null) }, [])

  const openPortal = async () => {
    const res = await fetch('/api/v1/billing/portal', { method: 'POST' })
    const json = await res.json()
    if (json.url) window.location.href = json.url
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-3">
          <CreditCard className="h-8 w-8 text-cyan-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">Billing & Plans</h1>
        </div>
        <p className="text-base text-white/60">Manage your subscription and view usage</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* Current Plan Card */}
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 to-blue-600/5 opacity-100" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{billing.plan}</h2>
                  <p className="text-white/60">Your current billing plan</p>
                </div>
                <div className="inline-flex rounded-full bg-blue-500 px-4 py-2 border border-blue-400/50">
                  <span className="text-sm font-semibold text-white">Active</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Billing Cycle', value: 'Monthly' },
                  { label: 'Renewal Date', value: 'May 8, 2026' },
                  { label: 'Auto-Renew', value: 'Enabled' },
                  { label: 'Status', value: 'Active' }
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                    <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Usage Meters */}
        <motion.div variants={itemVariants}>
          <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-400" />
            Current Usage
          </h3>

          <div className="grid gap-4 md:grid-cols-3">
            {Object.entries(billing.usage || {}).map(([key, value], index) => {
              const limit = billing.limits?.[key as keyof typeof billing.limits] || 1
              const pct = Math.min(100, Math.round((value / limit) * 100))
              const warning = pct >= 80

              return (
                <motion.div
                  key={key}
                  variants={itemVariants}
                  transition={{ delay: index * 0.05 }}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl hover:border-white/20 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative z-10">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </p>

                    <div className="mb-4">
                      <p className="text-3xl font-bold text-white mb-1 font-mono">
                        {value.toLocaleString()}
                        <span className="text-lg font-normal text-white/50">/{limit.toLocaleString()}</span>
                      </p>
                      <p className={`text-xs font-semibold ${warning ? 'text-amber-400' : 'text-green-400'}`}>
                        {pct}% used
                      </p>
                    </div>

                    <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-full rounded-full ${warning ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}`}
                      />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div variants={itemVariants} className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.location.href = '/settings/upgrade'}
            className="flex-1 px-6 py-4 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 text-center"
          >
            Upgrade Plan
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => void openPortal()}
            className="flex-1 px-6 py-4 rounded-lg border border-white/10 bg-white/[0.03] text-white font-semibold hover:bg-white/[0.08] transition-all duration-200 text-center"
          >
            Manage Billing
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  )
}
