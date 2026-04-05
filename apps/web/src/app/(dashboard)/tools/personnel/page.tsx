'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Plus, MapPin, AlertTriangle, CheckCircle, Trash2, Shield } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

type Person = { id: string; person_name: string; person_email?: string; country: string; city?: string; status: string; notes?: string; created_at: string; risk_score?: number; travel_advisory?: string }
type SafetyAlert = { id: string; person_id: string; alert_type: string; title: string; body: string; severity: string; risk_score: number; acknowledged: boolean; created_at: string }
type ApiData = { people?: Person[]; alerts?: SafetyAlert[] }

const statusColor: Record<string, string> = {
  active: 'bg-green-400/20 text-green-300',
  traveling: 'bg-yellow-400/20 text-yellow-300',
  evacuated: 'bg-orange-400/20 text-orange-300',
}

const alertTypeIcon: Record<string, string> = {
  evacuation_recommended: '🚨',
  risk_spike: '⚡',
  prediction: '📊',
  correlation: '🔗',
}

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
    <div className="p-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-blue-400" /> Personnel Safety</h1>
          <p className="text-gray-400 text-sm mt-1">Duty of care monitoring for team members in conflict-affected regions</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Person
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="font-semibold mb-4">Add Team Member</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { key: 'person_name', label: 'Full Name', placeholder: 'Jane Smith', required: true },
              { key: 'person_email', label: 'Email', placeholder: 'jane@company.com' },
              { key: 'country', label: 'Country', placeholder: 'Ukraine', required: true },
              { key: 'city', label: 'City', placeholder: 'Kyiv' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-400 mb-1 block">{f.label}{f.required ? ' *' : ''}</label>
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => void addPerson()} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">Add</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">⚠️ Active Safety Alerts ({alerts.length})</h2>
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className={`flex items-start gap-3 p-4 rounded-xl border ${a.severity === 'critical' ? 'bg-red-950/30 border-red-500/30' : 'bg-orange-950/20 border-orange-500/20'}`}>
                <span className="text-xl">{alertTypeIcon[a.alert_type] ?? '⚡'}</span>
                <div className="flex-1">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{a.body}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(a.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => void ackAlert(a.id, a.person_id)} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors shrink-0">
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* People */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Team Members ({people.length})
        </h2>
        {loading && <div className="text-gray-500 text-sm">Loading...</div>}
        {!loading && people.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-700" />
            <p className="text-sm">No team members added yet.</p>
            <p className="text-xs mt-2">Add personnel in conflict-affected regions to receive automatic safety alerts when risk spikes.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {people.map(p => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold">{p.person_name}</div>
                  {p.person_email && <div className="text-xs text-gray-400">{p.person_email}</div>}
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-1"><MapPin className="w-3 h-3" /> {p.city ? `${p.city}, ` : ''}{p.country}</div>
                </div>
                <div className="flex items-center gap-2">
                  {p.risk_score != null && (
                    <span className={`text-sm font-bold ${p.risk_score >= 7 ? 'text-red-400' : p.risk_score >= 5 ? 'text-orange-400' : 'text-green-400'}`}>
                      {p.risk_score.toFixed(1)}
                    </span>
                  )}
                  <button onClick={() => void deletePerson(p.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={p.status}
                  onChange={e => void updateStatus(p.id, e.target.value)}
                  className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="traveling">Traveling</option>
                  <option value="evacuated">Evacuated</option>
                  <option value="safe">Confirmed Safe</option>
                </select>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[p.status] ?? 'bg-gray-700 text-gray-300'}`}>{p.status}</span>
                {p.travel_advisory === 'do_not_travel' && <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Do Not Travel</span>}
                {p.travel_advisory === 'safe' && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Safe</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
