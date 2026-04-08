'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BrandingEditor } from '@/components/settings/BrandingEditor'
import { Building2, Mail, Check, AlertCircle } from 'lucide-react'

type OrgData = { id?: string; name?: string; plan_id?: string }
type Member = { id: string; email: string; role: string; created_at?: string | null }

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

export default function OrgSettingsPage() {
  const [org, setOrg] = useState<OrgData | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [orgName, setOrgName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = async () => {
    try {
      const res = await fetch('/api/v1/enterprise/org', { cache: 'no-store' })
      const json = await res.json() as { data?: { org?: OrgData; members?: Member[] } }
      setOrg(json.data?.org || null)
      setMembers(json.data?.members || [])
      setOrgName(json.data?.org?.name || '')
    } catch { /* silent */ }
  }

  useEffect(() => { void load() }, [])

  const saveOrg = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await fetch('/api/v1/enterprise/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      })
      setMessage({ type: 'success', text: 'Organization updated successfully' })
      await load()
    } catch {
      setMessage({ type: 'error', text: 'Failed to save changes' })
    } finally {
      setSaving(false)
    }
  }

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      await fetch('/api/v1/enterprise/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: 'analyst' }),
      })
      setMessage({ type: 'success', text: 'Invitation sent successfully' })
      setInviteEmail('')
      await load()
    } catch {
      setMessage({ type: 'error', text: 'Failed to send invitation' })
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#070B11] to-[#0a0f1a] p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 max-w-5xl mx-auto"
      >
        <div className="flex items-center gap-3 mb-3">
          <Building2 className="h-8 w-8 text-blue-400" />
          <h1 className="text-4xl md:text-5xl font-bold text-white">Organization</h1>
        </div>
        <p className="text-base text-white/60">Manage your organization profile, members, and settings</p>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-5xl mx-auto space-y-8"
      >
        {/* Status Message */}
        {message && (
          <motion.div
            variants={itemVariants}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-4 backdrop-blur-xl flex items-start gap-3 ${
              message.type === 'success'
                ? 'border-green-500/30 bg-green-500/10'
                : 'border-red-500/30 bg-red-500/10'
            }`}
          >
            {message.type === 'success' ? (
              <Check className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <p className={message.type === 'success' ? 'text-green-300' : 'text-red-300'}>
              {message.text}
            </p>
          </motion.div>
        )}

        {/* Profile + Invite Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Org Profile Card */}
          <motion.div variants={itemVariants}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="mb-6 inline-flex rounded-xl bg-blue-500/10 p-3 backdrop-blur-sm border border-blue-500/20">
                  <Building2 className="h-6 w-6 text-blue-400" />
                </div>

                <h3 className="text-xl font-semibold text-white mb-2">Organization Profile</h3>
                <p className="text-sm text-white/50 mb-6">Configure your organization&apos;s basic settings and information</p>

                <label className="block mb-4">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Organization Name</span>
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all backdrop-blur-sm"
                    placeholder="Enter organization name"
                  />
                </label>

                <div className="mb-6 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <p className="text-xs text-white/50">
                    <span className="font-semibold text-white/70">Current Plan: </span>
                    <span className="inline-flex items-center gap-1 mt-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                      {org?.plan_id ? org.plan_id.charAt(0).toUpperCase() + org.plan_id.slice(1) : 'Individual'}
                    </span>
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void saveOrg()}
                  disabled={saving}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold text-sm hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 transition-all duration-200"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Invite Member Card */}
          <motion.div variants={itemVariants}>
            <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="mb-6 inline-flex rounded-xl bg-purple-500/10 p-3 backdrop-blur-sm border border-purple-500/20">
                  <Mail className="h-6 w-6 text-purple-400" />
                </div>

                <h3 className="text-xl font-semibold text-white mb-2">Invite Member</h3>
                <p className="text-sm text-white/50 mb-6">Send an invitation to join your organization</p>

                <label className="block mb-4">
                  <span className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 block">Email Address</span>
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void inviteMember()}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-400/50 focus:bg-white/10 transition-all backdrop-blur-sm"
                    placeholder="analyst@company.com"
                  />
                </label>

                <p className="text-xs text-white/40 mb-6 leading-relaxed">They&apos;ll receive an email with instructions to join your workspace.</p>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void inviteMember()}
                  disabled={inviting || !inviteEmail.trim()}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold text-sm hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 transition-all duration-200"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Members Section */}
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="relative z-10 p-8">
              <h3 className="text-xl font-semibold text-white mb-6">Team Members ({members.length})</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.05]">
                      <th className="px-6 py-4 text-left font-semibold">Email</th>
                      <th className="px-6 py-4 text-left font-semibold">Role</th>
                      <th className="px-6 py-4 text-left font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-sm text-white/30">
                          No members yet. Invite someone to get started.
                        </td>
                      </tr>
                    ) : (
                      members.map((member, index) => (
                        <motion.tr
                          key={member.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="border-t border-white/[0.05] hover:bg-white/[0.03] transition-colors"
                        >
                          <td className="px-6 py-4 text-white font-medium">{member.email}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
                                member.role === 'owner'
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                  : member.role === 'admin'
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : 'bg-white/[0.05] text-white/50 border-white/[0.08]'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-white/40 text-sm">
                            {member.created_at ? new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Branding Section — Enterprise Only */}
        {org?.plan_id === 'enterprise' && (
          <motion.div variants={itemVariants}>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 backdrop-blur-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 opacity-0 hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <div className="relative z-10">
                <h3 className="text-xl font-semibold text-white mb-2">White-Label Branding</h3>
                <p className="text-sm text-white/50 mb-6">Customize your application&apos;s appearance and branding</p>
                <BrandingEditor />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
