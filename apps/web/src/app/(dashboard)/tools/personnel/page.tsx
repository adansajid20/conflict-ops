'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, MapPin, AlertTriangle, CheckCircle, Trash2, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@clerk/nextjs'

type Person = { id: string; person_name: string; person_email?: string; country: string; city?: string; status: string; notes?: string; created_at: string; risk_score?: number; travel_advisory?: string }
type SafetyAlert = { id: string; person_id: string; alert_type: string; title: string; body: string; severity: string; risk_score: number; acknowledged: boolean; created_at: string }
type ApiData = { people?: Person[]; alerts?: SafetyAlert[] }

const statusColor: Record<string, string> = {
  active: 'bg-green-400/20 text-green-300 border-green-400/30',
  traveling: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  evacuated: 'bg-orange-400/20 text-orange-300 border-orange-400/30',
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

export default function PersonnelPage() {
  const { user } = useUser()
  const [data, setData] = useState<ApiData>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ person_name: '', person_email: '', country: '', city: '' })

  const userId = user?.id ?? ''

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/personnel?user_id=${userId}`)
      const d = await res.json() as ApiData
      setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load])

  const addPerson = async () => {
    if (!form.person_name || !form.country || !userId) return
    await fetch('/api/v1/personnel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ org_user_id: userId, ...form }),
    })
    setForm({ person_name: '', person_email: '', country: '', city: '' })
    setShowAdd(false)
    void load()
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/v1/personnel', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, status }) })
    void load()
  }

  const ackAlert = async (alertId: string, personId: string) => {
    await fetch('/api/v1/personnel', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: personId, acknowledge_alert: alertId }) })
    void load()
  }

  const deletePerson = async (id: string) => {
    await fetch(`/api/v1/personnel?id=${id}`, { method: 'DELETE' })
    void load()
  }

  const people = data.people ?? []
  const alerts = data.alerts ?? []

  return (
    <div className="min-h-screen bg-[#070B11] p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING_SMOOTH}
      >
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Shield className="w-7 h-7 text-blue-400" /> Personnel Safety</h1>
          <p className="text-white/60 text-sm mt-2">Duty of care monitoring for team members in conflict-affected regions</p>
        </div>
        <motion.button
          onClick={() => setShowAdd(v => !v)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-sm text-white font-medium transition-all"
        >
          <Plus className="w-4 h-4" /> Add Person
        </motion.button>
      </motion.div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={SPRING_SMOOTH}
            className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm overflow-hidden"
          >
            <h2 className="font-semibold text-white mb-4 text-lg">Add Team Member</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { key: 'person_name', label: 'Full Name', placeholder: 'Jane Smith', required: true },
                { key: 'person_email', label: 'Email', placeholder: 'jane@company.com' },
                { key: 'country', label: 'Country', placeholder: 'Ukraine', required: true },
                { key: 'city', label: 'City', placeholder: 'Kyiv' },
              ].map((f, idx) => (
                <motion.div
                  key={f.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, ...SPRING_SMOOTH }}
                >
                  <label className="text-xs text-white/80 mb-2 block font-medium">{f.label}{f.required ? ' *' : ''}</label>
                  <input
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
                  />
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={() => void addPerson()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-sm text-white font-medium transition-all"
              >
                Add
              </motion.button>
              <motion.button
                onClick={() => setShowAdd(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-white/[0.08] hover:bg-white/[0.12] rounded-lg text-sm text-white/60 border border-white/[0.1] transition-all font-medium"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, ...SPRING_SMOOTH }}
        >
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">⚠️ Active Safety Alerts ({alerts.length})</h2>
          <div className="space-y-3">
            {alerts.map((a, idx) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + idx * 0.05, ...SPRING_SMOOTH }}
                className={`flex items-start gap-4 p-5 rounded-xl border backdrop-blur-sm transition-all ${a.severity === 'critical' ? 'bg-red-500/10 border-red-400/30 hover:border-red-400/50' : 'bg-orange-500/10 border-orange-400/30 hover:border-orange-400/50'}`}
              >
                <span className="text-2xl shrink-0">⚠️</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-white">{a.title}</div>
                  <div className="text-xs text-white/50 mt-1">{a.body}</div>
                  <div className="text-xs text-white/30 mt-2">{new Date(a.created_at).toLocaleString()}</div>
                </div>
                <motion.button
                  onClick={() => void ackAlert(a.id, a.person_id)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="text-xs px-3 py-2 bg-white/[0.1] hover:bg-white/[0.15] text-white/60 rounded-lg transition-all shrink-0 font-medium"
                >
                  Acknowledge
                </motion.button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* People */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, ...SPRING_SMOOTH }}>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
          Team Members ({people.length})
        </h2>
        {loading && (
          <motion.div className="text-white/50 text-sm">
            <div className="inline-flex items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full" />
              Loading...
            </div>
          </motion.div>
        )}
        {!loading && people.length === 0 && (
          <motion.div className="text-center py-16 text-white/50">
            <Users className="w-16 h-16 mx-auto mb-4 text-white/20" />
            <p className="text-sm">No team members added yet.</p>
            <p className="text-xs mt-2 text-white/30">Add personnel in conflict-affected regions to receive automatic safety alerts when risk spikes.</p>
          </motion.div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {people.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.16 + idx * 0.05, ...SPRING_SNAPPY }}
              whileHover={{ y: -2 }}
              className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm hover:border-white/[0.1] transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-semibold text-white text-lg">{p.person_name}</div>
                  {p.person_email && <div className="text-xs text-white/50 mt-1">{p.person_email}</div>}
                  <div className="flex items-center gap-1 text-xs text-white/50 mt-2"><MapPin className="w-3 h-3" /> {p.city ? `${p.city}, ` : ''}{p.country}</div>
                </div>
                <div className="flex items-center gap-2">
                  {p.risk_score != null && (
                    <span className={`text-lg font-bold font-mono ${p.risk_score >= 7 ? 'text-red-400' : p.risk_score >= 5 ? 'text-orange-400' : 'text-green-400'}`}>
                      {p.risk_score.toFixed(1)}
                    </span>
                  )}
                  <motion.button
                    onClick={() => void deletePerson(p.id)}
                    whileHover={{ scale: 1.2, color: '#f87171' }}
                    className="text-white/30 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={p.status}
                  onChange={e => void updateStatus(p.id, e.target.value)}
                  className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white placeholder:text-white/20 focus:outline-none focus:border-blue-400 transition-all backdrop-blur-sm"
                >
                  <option value="active">Active</option>
                  <option value="traveling">Traveling</option>
                  <option value="evacuated">Evacuated</option>
                  <option value="safe">Confirmed Safe</option>
                </select>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusColor[p.status] ?? 'bg-white/[0.1] text-white/80 border-white/[0.2]'}`}>
                  {p.status}
                </span>
                {p.travel_advisory === 'do_not_travel' && (
                  <span className="text-xs text-red-400 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3 h-3" /> Do Not Travel
                  </span>
                )}
                {p.travel_advisory === 'safe' && (
                  <span className="text-xs text-green-400 flex items-center gap-1 font-medium">
                    <CheckCircle className="w-3 h-3" /> Safe
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
