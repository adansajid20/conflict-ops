'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Plus, AlertTriangle, Trash2, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@clerk/nextjs'
import { GeopoliticalImpactAssessment } from '@/components/supply-chain/GeopoliticalImpactAssessment'

type Node = { id: string; node_name: string; node_type: string; country?: string; region?: string; criticality: string; notes?: string; risk_score?: number; travel_advisory?: string }
type Alert = { id: string; node_id: string; title: string; impact_assessment: string; severity: string; created_at: string }
type ApiData = { nodes?: Node[]; alerts?: Alert[] }

const criticalityColor: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/20 border-red-400/30',
  high: 'text-orange-400 bg-orange-400/20 border-orange-400/30',
  medium: 'text-yellow-400 bg-yellow-400/20 border-yellow-400/30',
  low: 'text-green-400 bg-green-400/20 border-green-400/30',
}

const nodeTypeIcon: Record<string, string> = {
  port: '⚓', route: '🚢', supplier: '🏭', warehouse: '📦', border_crossing: '🚧',
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }
const SPRING_SMOOTH = { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.8 }

export default function SupplyChainPage() {
  const { user } = useUser()
  const [data, setData] = useState<ApiData>({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ node_name: '', node_type: 'port', country: '', region: '', criticality: 'medium', notes: '' })

  const userId = user?.id ?? ''

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/supply-chain?user_id=${userId}`)
      const d = await res.json() as ApiData
      setData(d)
    } catch { /* ignore */ }
    setLoading(false)
  }, [userId])

  useEffect(() => { void load() }, [load])

  const addNode = async () => {
    if (!form.node_name || !form.node_type || !userId) return
    await fetch('/api/v1/supply-chain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, ...form }),
    })
    setForm({ node_name: '', node_type: 'port', country: '', region: '', criticality: 'medium', notes: '' })
    setShowAdd(false)
    void load()
  }

  const deleteNode = async (id: string) => {
    await fetch(`/api/v1/supply-chain?id=${id}`, { method: 'DELETE' })
    void load()
  }

  const nodes = data.nodes ?? []
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
          <h1 className="text-3xl font-bold text-white flex items-center gap-3"><Package className="w-7 h-7 text-orange-400" /> Supply Chain Risk Monitor</h1>
          <p className="text-white/60 text-sm mt-2">Monitor ports, routes, and suppliers in conflict-affected regions</p>
        </div>
        <motion.button
          onClick={() => setShowAdd(v => !v)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-sm text-white font-medium transition-all"
        >
          <Plus className="w-4 h-4" /> Add Node
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
            <h2 className="font-semibold text-white mb-4 text-lg">Add Supply Chain Node</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { key: 'node_name', label: 'Node Name', placeholder: 'e.g., Shanghai Port', type: 'text', required: true },
                { key: 'node_type', label: 'Type', options: ['port', 'route', 'supplier', 'warehouse', 'border_crossing'], required: true },
                { key: 'country', label: 'Country', placeholder: 'e.g., China', type: 'text' },
                { key: 'criticality', label: 'Criticality', options: ['critical', 'high', 'medium', 'low'] },
              ].map((f, idx) => (
                <motion.div
                  key={f.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, ...SPRING_SMOOTH }}
                >
                  <label className="text-xs text-white/80 mb-2 block font-medium">{f.label}{f.required ? ' *' : ''}</label>
                  {'options' in f ? (
                    <select
                      value={form[f.key as keyof typeof form]}
                      onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
                    >
                      {f.options?.map(opt => <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type || 'text'}
                      value={form[f.key as keyof typeof form]}
                      onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/[0.06] transition-all backdrop-blur-sm"
                    />
                  )}
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={() => void addNode()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg text-sm text-white font-medium transition-all"
              >
                Add Node
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, ...SPRING_SMOOTH }}>
          <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-4 flex items-center gap-2">⚠️ Supply Chain Threats ({alerts.length})</h2>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((a, idx) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + idx * 0.05, ...SPRING_SMOOTH }}
                className={`p-5 rounded-xl border backdrop-blur-sm transition-all ${a.severity === 'critical' ? 'bg-red-500/10 border-red-400/30 hover:border-red-400/50' : 'bg-orange-500/10 border-orange-400/30 hover:border-orange-400/50'}`}
              >
                <div className="font-semibold text-sm text-white">{a.title}</div>
                {a.impact_assessment && <p className="text-xs text-white/50 mt-2">{a.impact_assessment}</p>}
                <div className="text-xs text-white/30 mt-2">{new Date(a.created_at).toLocaleString()}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Nodes */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, ...SPRING_SMOOTH }}>
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
          Monitored Nodes ({nodes.length})
        </h2>
        {loading && (
          <motion.div className="text-white/50 text-sm">
            <div className="inline-flex items-center gap-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full" />
              Loading...
            </div>
          </motion.div>
        )}
        {!loading && nodes.length === 0 && (
          <motion.div className="text-center py-16 text-white/50">
            <Package className="w-16 h-16 mx-auto mb-4 text-white/20" />
            <p className="text-sm">No supply chain nodes configured yet.</p>
            <p className="text-xs mt-2 text-white/30">Add ports, shipping routes, supplier locations, and border crossings<br />to receive automatic threat alerts every 15 minutes.</p>
          </motion.div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((n, idx) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.16 + idx * 0.05, ...SPRING_SNAPPY }}
              whileHover={{ y: -2 }}
              className="bg-gradient-to-br from-white/[0.025] to-white/[0.005] border border-white/[0.06] rounded-xl p-5 backdrop-blur-sm hover:border-white/[0.1] transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{nodeTypeIcon[n.node_type] ?? '📍'}</span>
                    <span className="font-semibold text-white">{n.node_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-white/50">
                    <MapPin className="w-3 h-3" /> {n.country ?? n.region ?? 'Unknown location'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {n.risk_score != null && (
                    <span className={`text-lg font-bold font-mono ${n.risk_score >= 7 ? 'text-red-400' : n.risk_score >= 5 ? 'text-orange-400' : 'text-green-400'}`}>
                      {n.risk_score.toFixed(1)}
                    </span>
                  )}
                  <motion.button
                    onClick={() => void deleteNode(n.id)}
                    whileHover={{ scale: 1.2, color: '#f87171' }}
                    className="text-white/30 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-3 py-1 rounded-full font-medium border ${criticalityColor[n.criticality] ?? ''}`}>
                  {n.criticality}
                </span>
                <span className="text-xs text-white/50 capitalize">{n.node_type.replace('_', ' ')}</span>
                {n.travel_advisory === 'do_not_travel' && (
                  <span className="text-xs text-red-400 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3 h-3" /> High Risk
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Geopolitical Impact Assessment Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ...SPRING_SMOOTH }}
        className="pt-6 border-t border-white/[0.06]"
      >
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          Geopolitical Impact Assessment
        </h2>
        <p className="text-white/60 text-sm mb-5">Real-time supply chain resilience analysis and risk assessment</p>
        <GeopoliticalImpactAssessment />
      </motion.div>
    </div>
  )
}
