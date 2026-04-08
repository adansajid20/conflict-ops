'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, Zap } from 'lucide-react'

type UsageItem = { label: string; used: number; limit: number }

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
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

export function UsageMeter({ items }: { items: UsageItem[] }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
    >
      {items.map((item) => {
        const percentage = pct(item.used, item.limit)
        const warning = percentage >= 80
        const critical = percentage >= 95

        return (
          <motion.div key={item.label} variants={itemVariants}>
            <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/20">
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                critical ? 'bg-gradient-to-br from-red-500/10 to-red-600/5' :
                warning ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5' :
                'bg-gradient-to-br from-blue-500/10 to-blue-600/5'
              }`} />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className={`text-lg font-bold font-mono ${
                      critical ? 'text-red-400' :
                      warning ? 'text-amber-400' :
                      'text-white'
                    }`}>
                      {item.used.toLocaleString()}
                      <span className="text-sm font-normal text-white/50">/{item.limit === -1 ? '∞' : item.limit.toLocaleString()}</span>
                    </p>
                  </div>
                  {warning && (
                    <div className="flex-shrink-0">
                      {critical ? (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                      )}
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-3 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.limit === -1 ? 0 : percentage}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full transition-colors duration-300 ${
                      critical ? 'bg-gradient-to-r from-red-500 to-red-400' :
                      warning ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
                      'bg-gradient-to-r from-blue-500 to-cyan-400'
                    }`}
                  />
                </div>

                {/* Status Text */}
                <div className={`text-xs font-semibold ${
                  critical ? 'text-red-300' :
                  warning ? 'text-amber-300' :
                  'text-green-300'
                }`}>
                  {critical ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      CRITICAL: {percentage}% used
                    </span>
                  ) : warning ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      WARNING: {percentage}% used
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      {percentage}% used
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
