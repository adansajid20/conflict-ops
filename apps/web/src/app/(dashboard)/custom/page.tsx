'use client'

import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, Plus, Trash2, Settings, Save, ChevronDown } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

type Widget = {
  id: string
  type: string
  title: string
  config: Record<string, unknown>
  position: { x: number; y: number; w: number; h: number }
}
type Dashboard = { id: string; name: string; widgets: Widget[]; is_default: boolean; updated_at: string }
type DashboardsData = { dashboards?: Dashboard[] }
type DashboardSaved = { dashboard?: Dashboard; error?: string }

const WIDGET_TYPES = [
  { type: 'event_feed', label: 'Intel Feed', icon: '📰', desc: 'Live filtered event stream' },
  { type: 'risk_scores', label: 'Risk Scores', icon: '🔥', desc: 'Risk score cards for regions' },
  { type: 'predictions', label: 'Predictions', icon: '🔮', desc: 'Active predictions' },
  { type: 'commodity_prices', label: 'Commodity Prices', icon: '💹', desc: 'Oil, gold, wheat live prices' },
  { type: 'tracking_counter', label: 'Tracking Live', icon: '✈️', desc: 'Flights/vessels/fires counters' },
  { type: 'actor_watch', label: 'Actor Watch', icon: '👁️', desc: 'Monitor specific actors' },
  { type: 'correlation_feed', label: 'Correlations', icon: '🔗', desc: 'Active multi-signal correlations' },
  { type: 'alert_feed', label: 'Alert Feed', icon: '🚨', desc: 'Recent triggered alerts' },
  { type: 'situation_monitor', label: 'Situation Monitor', icon: '🌍', desc: 'Track a specific situation' },
]

function WidgetCard({ widget, onRemove, onConfig }: { widget: Widget; onRemove: () => void; onConfig: () => void }) {
  const meta = WIDGET_TYPES.find(t => t.type === widget.type)
  return (
    <div className="bg-white/[0.015] border border-white/[0.05] rounded-xl p-4 flex flex-col gap-3 min-h-[160px] hover:bg-white/[0.03]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta?.icon ?? '📊'}</span>
          <span className="font-semibold text-sm text-white">{widget.title || meta?.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onConfig} className="p-1 text-white/50 hover:text-white/80 transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="p-1 text-white/50 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center text-white/30 text-xs text-center">
        <div>
          <div className="text-2xl mb-1">{meta?.icon}</div>
          <div>{meta?.desc}</div>
          <div className="mt-1 text-white/20">Live data loads at runtime</div>
        </div>
      </div>
    </div>
  )
}

export default function CustomDashboardPage() {
  const { user } = useUser()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [active, setActive] = useState<Dashboard | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [showWidgetPicker, setShowWidgetPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const userId = user?.id ?? ''

  const [loadError, setLoadError] = useState('')
  const load = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/v1/dashboards?user_id=${userId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json() as DashboardsData
      const list = d.dashboards ?? []
      setDashboards(list)
      if (!active && list.length > 0) setActive(list[0] ?? null)
      setLoadError('')
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Failed to load dashboards') }
  }, [userId, active])

  useEffect(() => { void load() }, [load])

  const createDashboard = async () => {
    if (!newName.trim() || !userId) return
    try {
      const res = await fetch('/api/v1/dashboards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId, name: newName.trim(), widgets: [], is_default: dashboards.length === 0 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json() as DashboardSaved
      if (d.dashboard) {
        setActive(d.dashboard)
        void load()
      }
      setNewName('')
      setShowAdd(false)
    } catch { setLoadError('Failed to create dashboard') }
  }

  const addWidget = (type: string) => {
    if (!active) return
    const meta = WIDGET_TYPES.find(t => t.type === type)
    const newWidget: Widget = {
      id: crypto.randomUUID(),
      type,
      title: meta?.label ?? type,
      config: {},
      position: { x: 0, y: 0, w: 2, h: 2 },
    }
    setActive({ ...active, widgets: [...active.widgets, newWidget] })
    setShowWidgetPicker(false)
  }

  const removeWidget = (id: string) => {
    if (!active) return
    setActive({ ...active, widgets: active.widgets.filter(w => w.id !== id) })
  }

  const saveDashboard = async () => {
    if (!active || !userId) return
    setSaving(true)
    try {
      const res = await fetch('/api/v1/dashboards', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: active.id, user_id: userId, widgets: active.widgets, name: active.name }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      void load()
    } catch { setLoadError('Failed to save dashboard') }
    setSaving(false)
  }

  const deleteDashboard = async (id: string) => {
    if (!userId) return
    try {
      await fetch(`/api/v1/dashboards?id=${id}&user_id=${userId}`, { method: 'DELETE' })
      setActive(null)
      void load()
    } catch { setLoadError('Failed to delete dashboard') }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 bg-white/[0.015] border-r border-white/[0.05] flex flex-col">
        <div className="p-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2 mb-3">
            <LayoutDashboard className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm text-white">My Dashboards</span>
          </div>
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs transition-colors border border-blue-500/30">
              <Plus className="w-3.5 h-3.5" /> New Dashboard
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void createDashboard() }}
                placeholder="Dashboard name..."
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-white placeholder:text-white/20"
                autoFocus
              />
              <div className="flex gap-1">
                <button onClick={() => void createDashboard()} className="flex-1 px-2 py-1 bg-blue-600 text-xs rounded-lg text-white hover:bg-blue-700">Create</button>
                <button onClick={() => setShowAdd(false)} className="px-2 py-1 bg-white/[0.05] text-xs rounded-lg text-white/60 hover:bg-white/[0.1]">Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {dashboards.map(d => (
            <button
              key={d.id}
              onClick={() => setActive(d)}
              className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors ${active?.id === d.id ? 'bg-white/[0.1] text-white' : 'text-white/50 hover:bg-white/[0.05]'}`}
            >
              <span className="truncate text-white">{d.name} {d.is_default && <span className="text-blue-400">★</span>}</span>
              <button onClick={e => { e.stopPropagation(); void deleteDashboard(d.id) }} className="opacity-0 group-hover:opacity-100 text-white/50 hover:text-red-400 ml-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {loadError && (
          <div className="mx-5 mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-400 flex items-center justify-between">
            <span>{loadError}</span>
            <button onClick={() => setLoadError('')} className="text-red-400/60 hover:text-red-400 ml-2">✕</button>
          </div>
        )}
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-white/50">
            <div className="text-center">
              <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-white/20" />
              <p className="text-sm text-white">Create a dashboard to get started</p>
              <p className="text-xs mt-2 text-white/50">Add widgets to monitor the intelligence streams you care about</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.05] bg-white/[0.015]">
              <input
                value={active.name}
                onChange={e => setActive({ ...active, name: e.target.value })}
                className="font-semibold bg-transparent border-b border-transparent hover:border-white/[0.1] focus:border-blue-500 focus:outline-none text-sm text-white"
              />
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowWidgetPicker(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-xs transition-colors text-white/60 border border-white/[0.08]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Widget <ChevronDown className="w-3 h-3" />
                  </button>
                  {showWidgetPicker && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white/[0.015] border border-white/[0.1] rounded-xl shadow-2xl z-50 p-1">
                      {WIDGET_TYPES.map(w => (
                        <button
                          key={w.type}
                          onClick={() => addWidget(w.type)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.08] rounded-lg text-left text-xs transition-colors"
                        >
                          <span className="text-base">{w.icon}</span>
                          <div>
                            <div className="font-medium text-white/80">{w.label}</div>
                            <div className="text-white/50">{w.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void saveDashboard()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs transition-colors text-white"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Widget grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {active.widgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-white/50 border-2 border-dashed border-white/[0.1] rounded-2xl">
                  <Plus className="w-10 h-10 mb-2 text-white/20" />
                  <p className="text-sm text-white">Click &quot;Add Widget&quot; to build your dashboard</p>
                  <p className="text-xs mt-1 text-white/50">Mix and match data streams for your intelligence focus</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {active.widgets.map(widget => (
                    <WidgetCard
                      key={widget.id}
                      widget={widget}
                      onRemove={() => removeWidget(widget.id)}
                      onConfig={() => {/* future: open config modal */}}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
