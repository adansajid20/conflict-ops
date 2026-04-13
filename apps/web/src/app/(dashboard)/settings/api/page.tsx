'use client'

import { motion } from 'framer-motion'
import { APIKeysManager } from '@/components/settings/APIKeysManager'
import { Code2, BookOpen } from 'lucide-react'

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

export default function APISettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-3">
          <Code2 className="h-8 w-8 text-emerald-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">API Access</h1>
        </div>
        <p className="text-base text-white/60">Manage programmatic access and API credentials</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto"
      >
        <div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr]">
          {/* API Keys Manager */}
          <motion.div variants={itemVariants}>
            <APIKeysManager />
          </motion.div>

          {/* Documentation and Examples */}
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Quick Reference */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Quick Reference</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Base URL</p>
                    <code className="block text-xs bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-white/80 break-all">
                      https://conflictradar.co/api/public/v1
                    </code>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Authentication</p>
                    <code className="block text-xs bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-white/80 break-all">
                      Authorization: Bearer &lt;api_key&gt;
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Example Request */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-white mb-4">Example Request</h3>
                <pre className="overflow-x-auto rounded-lg bg-white/[0.03] border border-white/[0.08] p-4 text-xs text-white/80 font-mono leading-relaxed">
{`curl https://conflictradar.co/api/public/v1/events \\
  -H "Authorization: Bearer your_api_key" \\
  -G \\
  --data-urlencode "limit=50" \\
  --data-urlencode "severity_gte=3"`}
                </pre>

                <p className="mt-4 text-xs text-white/50">
                  Rate limit: 1,000 req/hr on Business plan · View full <a href="/api/public/v1" className="text-blue-400 hover:text-blue-300 transition-colors">API documentation</a>
                </p>
              </div>
            </div>

            {/* Rate Limits Info */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="relative z-10">
                <h3 className="text-sm font-semibold text-white mb-3">Rate Limits</h3>
                <ul className="space-y-2 text-xs text-white/60">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Individual: 100 req/hr
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Pro: 500 req/hr
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Business: 1,000 req/hr
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
