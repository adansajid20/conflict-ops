'use client'

import { motion } from 'framer-motion'
import { Settings, Users, Key, Zap, BarChart3, Webhook, Lock } from 'lucide-react'
import Link from 'next/link'

const SETTINGS_SECTIONS = [
  {
    href: '/settings/org',
    icon: Settings,
    title: 'Organization',
    description: 'Manage company profile, branding, and general settings',
    color: 'from-blue-500/20 to-blue-600/10',
  },
  {
    href: '/settings/team',
    icon: Users,
    title: 'Team Members',
    description: 'Manage users, roles, and team permissions',
    color: 'from-purple-500/20 to-purple-600/10',
  },
  {
    href: '/settings/api',
    icon: Key,
    title: 'API Keys',
    description: 'Create and manage API keys for programmatic access',
    color: 'from-emerald-500/20 to-emerald-600/10',
  },
  {
    href: '/settings/integrations',
    icon: Zap,
    title: 'Integrations',
    description: 'Connect external services and tools',
    color: 'from-orange-500/20 to-orange-600/10',
  },
  {
    href: '/settings/billing',
    icon: BarChart3,
    title: 'Billing & Plans',
    description: 'View subscription, usage, and billing details',
    color: 'from-cyan-500/20 to-cyan-600/10',
  },
  {
    href: '/settings/webhooks',
    icon: Webhook,
    title: 'Webhooks',
    description: 'Configure real-time event notifications',
    color: 'from-pink-500/20 to-pink-600/10',
  },
  {
    href: '/settings/privacy',
    icon: Lock,
    title: 'Privacy & Compliance',
    description: 'GDPR controls, data export, and retention policies',
    color: 'from-red-500/20 to-red-600/10',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
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

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-6xl mx-auto"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Settings</h1>
        <p className="text-base text-white/60">Manage your organization, team, billing, and integrations</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto"
      >
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <motion.div
              key={section.href}
              variants={cardVariants}
              whileHover="hover"
              whileTap={{ scale: 0.98 }}
            >
              <Link href={section.href}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer">
                  {/* Animated gradient border */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex rounded-xl bg-white/5 p-3 backdrop-blur-sm">
                      <Icon className="h-6 w-6 text-blue-400" />
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-300 transition-colors">
                      {section.title}
                    </h3>

                    <p className="text-sm text-white/50 mb-4 group-hover:text-white/70 transition-colors">
                      {section.description}
                    </p>

                    <div className="flex items-center text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="text-sm font-medium">Manage</span>
                      <svg className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Top edge highlight */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </Link>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
