'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { WebhooksManager } from '@/components/settings/WebhooksManager'
import { Webhook } from 'lucide-react'

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

export default function WebhooksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-3">
          <Webhook className="h-8 w-8 text-pink-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">Webhooks</h1>
        </div>
        <p className="text-base text-white/60">Configure real-time event notifications to your endpoints</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto"
      >
        <motion.div variants={itemVariants}>
          <WebhooksManager />
        </motion.div>

        {/* Documentation Section */}
        <motion.div variants={itemVariants} className="mt-12">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative z-10">
              <h3 className="text-xl font-semibold text-white mb-6">Webhook Verification</h3>

              <div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold text-white/80 mb-3">HMAC-SHA256 Signature</p>
                  <p className="text-sm text-white/60 mb-4">
                    All webhooks are signed with HMAC-SHA256. Verify the signature using the signing secret provided when you create the webhook.
                  </p>
                  <code className="block text-xs bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-white/80 overflow-x-auto font-mono">
{`const crypto = require('crypto');
const secret = 'your_signing_secret';
const signature = req.headers['x-webhook-signature'];
const hash = crypto.createHmac('sha256', secret)
  .update(JSON.stringify(req.body))
  .digest('hex');
const valid = hash === signature;`}
                  </code>
                </div>

                <div>
                  <p className="text-sm font-semibold text-white/80 mb-3">Retry Policy</p>
                  <p className="text-sm text-white/60">
                    Failed webhooks are retried up to 5 times with exponential backoff. Maximum retry window is 24 hours.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-white/80 mb-3">Event Payload</p>
                  <code className="block text-xs bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-white/80 overflow-x-auto font-mono">
{`{
  "event_type": "alert.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": { ... }
}`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
