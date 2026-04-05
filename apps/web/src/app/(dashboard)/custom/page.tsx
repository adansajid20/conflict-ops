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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 min-h-[160px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta?.icon ?? '📊'}</span>
          <span className="font-semibold text-sm">{widget.title || meta?.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onConfig} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-600 text-xs text-center">
        <div>
          <div className="text-2xl mb-1">{meta?.icon}</div>
          <div>{meta?.desc}</div>
          <div className="mt-1 text-gray-700">Live data loads at runtime</div>
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

  const load = useCallback(async () => {
    if (!userId) return
    const res = await fetch(`/api/v1/dashboards?user_id=${userId}`)
    const d = await res.json() as DashboardsData
    const list = d.dashboards ?? []
    setDashboards(list)
    if (!active && list.length > 0) setActive(list[0] ?? null)
  }, [userId, active])

  useEffect(() => { void load() }, [load])

  const createDashboard = async () => {
    if (!newName.trim() || !userId) return
    const res = await fetch('/api/v1/dashboards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, name: newName.trim(), widgets: [], is_default: dashboards.length === 0 }),
    })
    const d = await res.json() as DashboardSaved
    if (d.dashboard) {
      setActive(d.dashboard)
      void load()
    }
    setNewName('')
    setShowAdd(false)
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
    await fetch('/api/v1/dashboards', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: active.id, user_id: userId, widgets: active.widgets, name: active.name }),
    })
    setSaving(false)
    void load()
  }

  const deleteDashboard = async (id: string) => {
    if (!userId) return
    await fetch(`/api/v1/dashboards?id=${id}&user_id=${userId}`, { method: 'DELETE' })
    setActive(null)
    void load()
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-56 bg-gray-950 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <LayoutDashboard className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm">My Dashboards</span>
          </div>
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-xs transition-colors border border-blue-600/30">
              <Plus className="w-3.5 h-3.5" /> New Dashboard
            </button>
          ) : (
            <div className="space-y-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void createDashboard() }}
                placeholder="Dashboard name..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <div className="flex gap-1">
                <button onClick={() => void createDashboard()} className="flex-1 px-2 py-1 bg-blue-600 text-xs rounded-lg">Create</button>
                <button onClick={() => setShowAdd(false)} className="px-2 py-1 bg-gray-700 text-xs rounded-lg">Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {dashboards.map(d => (
            <button
              key={d.id}
              onClick={() => setActive(d)}
              className={`group w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors ${active?.id === d.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-900'}`}
            >
              <span className="truncate">{d.name} {d.is_default && <span className="text-blue-400">★</span>}</span>
              <button onClick={e => { e.stopPropagation(); void deleteDashboard(d.id) }} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 ml-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <LayoutDashboard className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              <p className="text-sm">Create a dashboard to get started</p>
              <p className="text-xs mt-2 text-gray-600">Add widgets to monitor the intelligence streams you care about</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800 bg-gray-950">
              <input
                value={active.name}
                onChange={e => setActive({ ...active, name: e.target.value })}
                className="font-semibold bg-transparent border-b border-transparent hover:border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowWidgetPicker(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Widget <ChevronDown className="w-3 h-3" />
                  </button>
                  {showWidgetPicker && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 p-1">
                      {WIDGET_TYPES.map(w => (
                        <button
                          key={w.type}
                          onClick={() => addWidget(w.type)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-800 rounded-lg text-left text-xs transition-colors"
                        >
                          <span className="text-base">{w.icon}</span>
                          <div>
                            <div className="font-medium text-gray-200">{w.label}</div>
                            <div className="text-gray-500">{w.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void saveDashboard()}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Widget grid */}
            <div className="flex-1 overflow-y-auto p-5">
              {active.widgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl">
                  <Plus className="w-10 h-10 mb-2 text-gray-700" />
                  <p className="text-sm">Click &quot;Add Widget&quot; to build your dashboard</p>
                  <p className="text-xs mt-1 text-gray-600">Mix and match data streams for your intelligence focus</p>
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
