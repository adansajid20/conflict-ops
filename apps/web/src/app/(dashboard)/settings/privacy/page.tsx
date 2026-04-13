'use client'

import { motion } from 'framer-motion'
import { RetentionPolicyEditor } from '@/components/settings/RetentionPolicyEditor'
import { IPAllowlistEditor } from '@/components/settings/IPAllowlistEditor'
import { Lock, Download, Trash2, Cookie } from 'lucide-react'
import { useState } from 'react'

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

export default function PrivacySettingsPage() {
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleExport = async () => {
    window.location.href = '/api/v1/compliance/export'
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return
    try {
      await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/v1/compliance/delete`, {
        method: 'POST',
        headers: { 'X-Confirm-Delete': 'true' }
      })
      window.location.href = '/sign-out'
    } catch {
      // Account deletion failed — user stays on page
    }
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
          <Lock className="h-8 w-8 text-red-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">Privacy & Compliance</h1>
        </div>
        <p className="text-base text-white/60">GDPR controls, data export, and enterprise compliance settings</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto space-y-8"
      >
        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Data Export */}
          <motion.div variants={itemVariants}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl transition-all duration-300 hover:border-white/20">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="mb-4 inline-flex rounded-xl bg-blue-500/10 p-3 backdrop-blur-sm border border-blue-500/20">
                  <Download className="h-6 w-6 text-blue-400" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">Data Export</h3>
                <p className="text-sm text-white/60 mb-6">Download your data in JSON format for archival or migration purposes</p>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExport}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
                >
                  Export Data
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Account Deletion */}
          <motion.div variants={itemVariants}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl transition-all duration-300 hover:border-white/20">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="mb-4 inline-flex rounded-xl bg-red-500/10 p-3 backdrop-blur-sm border border-red-500/20">
                  <Trash2 className="h-6 w-6 text-red-400" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-2">Account Deletion</h3>
                <p className="text-sm text-white/60 mb-6">Permanently delete your account and all associated data</p>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                  className="w-full px-4 py-3 rounded-lg bg-red-500/10 text-red-400 font-semibold border border-red-500/30 hover:bg-red-500/20 transition-all duration-200"
                >
                  Delete Account
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Delete Account Confirmation */}
        {showDeleteConfirm && (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-red-500/10 p-8 backdrop-blur-xl"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

            <div className="relative z-10">
              <h3 className="text-lg font-semibold text-red-300 mb-4">Confirm Account Deletion</h3>
              <p className="text-sm text-red-200/80 mb-6">
                This action is permanent and cannot be undone. All your data will be deleted immediately.
              </p>

              <label className="block mb-4">
                <span className="text-xs font-semibold text-red-300/60 uppercase tracking-wider mb-2 block">Type &quot;DELETE&quot; to confirm</span>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-white placeholder:text-red-300/30 focus:outline-none focus:border-red-500/50 transition-all backdrop-blur-sm"
                />
              </label>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirm(''); }}
                  className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-white font-semibold hover:bg-white/[0.05] transition-all duration-200"
                >
                  Cancel
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== 'DELETE'}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-all duration-200"
                >
                  Delete Account
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Policies */}
        <motion.div variants={itemVariants}>
          <RetentionPolicyEditor />
        </motion.div>

        <motion.div variants={itemVariants}>
          <IPAllowlistEditor />
        </motion.div>

        {/* Cookie Preferences */}
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <Cookie className="h-6 w-6 text-amber-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Cookie Preferences</h3>
                  <p className="text-sm text-white/60">
                    Manage your cookie preferences using the banner on our marketing site. Your choices are saved locally in your browser and respected across all our services.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
