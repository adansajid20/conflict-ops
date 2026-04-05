'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, Plus, AlertTriangle, Trash2, MapPin } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

type Node = { id: string; node_name: string; node_type: string; country?: string; region?: string; criticality: string; notes?: string; risk_score?: number; travel_advisory?: string }
type Alert = { id: string; node_id: string; title: string; impact_assessment: string; severity: string; created_at: string }
type ApiData = { nodes?: Node[]; alerts?: Alert[] }

const criticalityColor: Record<string, string> = {
  critical: 'text-red-400 bg-red-400/20',
  high: 'text-orange-400 bg-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/20',
  low: 'text-green-400 bg-green-400/20',
}

const nodeTypeIcon: Record<string, string> = {
  port: '⚓', route: '🚢', supplier: '🏭', warehouse: '📦', border_crossing: '🚧',
}

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
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="w-6 h-6 text-orange-400" /> Supply Chain Risk Monitor</h1>
          <p className="text-gray-400 text-sm mt-1">Monitor ports, routes, and suppliers in conflict-affected regions</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Node
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Add Supply Chain Node</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Node Name *</label>
              <input value={form.node_name} onChange={e => setForm(v => ({ ...v, node_name: e.target.value }))} placeholder="e.g., Shanghai Port" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Type *</label>
              <select value={form.node_type} onChange={e => setForm(v => ({ ...v, node_type: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {['port', 'route', 'supplier', 'warehouse', 'border_crossing'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Country</label>
              <input value={form.country} onChange={e => setForm(v => ({ ...v, country: e.target.value }))} placeholder="e.g., China" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Criticality</label>
              <select value={form.criticality} onChange={e => setForm(v => ({ ...v, criticality: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none">
                {['critical', 'high', 'medium', 'low'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void addNode()} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm">Add Node</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">⚠️ Supply Chain Threats ({alerts.length})</h2>
          <div className="space-y-2">
            {alerts.slice(0, 5).map(a => (
              <div key={a.id} className={`p-4 rounded-xl border ${a.severity === 'critical' ? 'bg-red-950/20 border-red-500/30' : 'bg-orange-950/10 border-orange-500/20'}`}>
                <div className="font-semibold text-sm">{a.title}</div>
                {a.impact_assessment && <p className="text-xs text-gray-400 mt-1">{a.impact_assessment}</p>}
                <div className="text-xs text-gray-500 mt-1">{new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nodes */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Monitored Nodes ({nodes.length})
        </h2>
        {loading && <div className="text-gray-500 text-sm">Loading...</div>}
        {!loading && nodes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-sm">No supply chain nodes configured yet.</p>
            <p className="text-xs mt-2 text-gray-600">Add ports, shipping routes, supplier locations, and border crossings<br />to receive automatic threat alerts every 15 minutes.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {nodes.map(n => (
            <div key={n.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{nodeTypeIcon[n.node_type] ?? '📍'}</span>
                    <span className="font-semibold text-sm">{n.node_name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                    <MapPin className="w-3 h-3" /> {n.country ?? n.region ?? 'Unknown location'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {n.risk_score != null && (
                    <span className={`text-sm font-bold ${n.risk_score >= 7 ? 'text-red-400' : n.risk_score >= 5 ? 'text-orange-400' : 'text-green-400'}`}>
                      {n.risk_score.toFixed(1)}
                    </span>
                  )}
                  <button onClick={() => void deleteNode(n.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${criticalityColor[n.criticality] ?? ''}`}>{n.criticality}</span>
                <span className="text-xs text-gray-500 capitalize">{n.node_type.replace('_', ' ')}</span>
                {n.travel_advisory === 'do_not_travel' && (
                  <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> High Risk</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
