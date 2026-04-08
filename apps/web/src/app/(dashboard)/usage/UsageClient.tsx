'use client'

import { motion } from 'framer-motion'
import { BarChart3, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { UsageMeter } from '@/components/billing/UsageMeter'

type UsageData = {
  items: Array<{ label: string; used: number; limit: number }>
  overagePolicy: string
  plan: string
}

export default function UsageClient({ usage }: { usage: UsageData }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="h-8 w-8 text-cyan-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">Usage &amp; Limits</h1>
        </div>
        <p className="text-base text-white/60">
          <span className="inline-block mr-4">Plan: <span className="font-semibold text-white">{usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1)}</span></span>
          <span>Overage Policy: <span className="font-semibold text-white">{usage.overagePolicy}</span></span>
        </p>
      </motion.div>

      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1,
              delayChildren: 0.1,
            },
          },
        }}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-8"
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
            },
          }}
        >
          <UsageMeter items={usage.items} />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
            },
          }}
        >
          <OveragePolicySelector current={usage.overagePolicy} />
        </motion.div>
      </motion.div>
    </div>
  )
}

function OveragePolicySelector({ current }: { current: string }) {
  const [policy, setPolicy] = useState(current)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (formData: FormData) => {
    setSaving(true)
    try {
      const overage_policy = String(formData.get('overage_policy') ?? current)
      await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/v1/billing/overage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overage_policy }),
      })
      setPolicy(overage_policy)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form action={handleSave} className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              Overage Policy
            </h3>
            <p className="text-sm text-white/60">Choose how to handle usage beyond your plan limits</p>
          </div>
          {saved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-1.5"
            >
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-xs font-semibold text-green-300">Saved</span>
            </motion.div>
          )}
        </div>

        <div className="grid gap-4 mb-6">
          {[
            { value: 'allow', label: 'Allow Overages', description: 'Continue service with additional charges' },
            { value: 'cap', label: 'Hard Cap', description: 'Stop processing when limits are reached' },
            { value: 'notify', label: 'Notify Only', description: 'Alert you but continue service' },
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-4 p-4 rounded-lg border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.03] transition-all cursor-pointer">
              <input
                type="radio"
                name="overage_policy"
                value={option.value}
                checked={policy === option.value}
                onChange={(e) => setPolicy(e.target.value)}
                className="mt-1 w-4 h-4 cursor-pointer"
              />
              <div className="flex-1">
                <p className="font-semibold text-white">{option.label}</p>
                <p className="text-xs text-white/50 mt-1">{option.description}</p>
              </div>
            </label>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all duration-200"
        >
          {saving ? 'Saving...' : 'Save Policy'}
        </motion.button>
      </div>
    </form>
  )
}
