'use client'

import { useEffect, useState, useCallback } from 'react'

type Alert = {
  id: string
  alert_type: string
  title: string
  body: string
  severity: number
  read: boolean
  created_at: string
  metadata: Record<string, unknown>
}

const SEVERITY_COLORS: Record<number, string> = {
  1: '#10B981', 2: '#3B82F6', 3: '#F59E0B', 4: '#EF4444', 5: '#FF0000',
}

const ALERT_TYPE_ICONS: Record<string, string> = {
  pir_match: '◉',
  threshold: '⚠',
  escalation: '↑',
  anomaly: '◈',
}

export function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/alerts?limit=50${filter === 'unread' ? '&unread=true' : ''}`)
      const json = await res.json() as { success: boolean; data?: Alert[] }
      if (json.success) setAlerts(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchAlerts()
    const interval = setInterval(() => void fetchAlerts(), 30_000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  const markRead = async (alertIds: string[]) => {
    await fetch('/api/v1/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertIds, read: true }),
    })
    setAlerts(prev => prev.map(a => alertIds.includes(a.id) ? { ...a, read: true } : a))
  }

  const markAllRead = () => {
    const unread = alerts.filter(a => !a.read).map(a => a.id)
    if (unread.length) void markRead(unread)
  }

  const unreadCount = alerts.filter(a => !a.read).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold mono tracking-widest" style={{ color: 'var(--text-primary)' }}>
            ALERTS
          </h2>
          {unreadCount > 0 && (
            <span
              className="text-xs mono px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--alert-red)', color: '#fff' }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {['all', 'unread'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as 'all' | 'unread')}
              className="text-xs mono px-2 py-1 rounded border"
              style={{
                borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
                color: filter === f ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs mono"
              style={{ color: 'var(--text-muted)' }}
            >
              MARK ALL READ
            </button>
          )}
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-xs mono" style={{ color: 'var(--text-muted)' }}>LOADING...</div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-xs mono" style={{ color: 'var(--text-muted)' }}>
            {filter === 'unread' ? 'NO UNREAD ALERTS' : 'NO ALERTS YET — SET UP PIRs TO START MONITORING'}
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {alerts.map(alert => {
              const color = SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS[2]
              const icon = ALERT_TYPE_ICONS[alert.alert_type] ?? '●'
              const time = new Date(alert.created_at).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
              })

              return (
                <div
                  key={alert.id}
                  className="p-3 rounded border-l-2 cursor-pointer hover:bg-white/5 transition-colors"
                  style={{
                    backgroundColor: alert.read ? 'var(--bg-surface)' : 'var(--bg-surface-2)',
                    borderLeftColor: color,
                    opacity: alert.read ? 0.7 : 1,
                  }}
                  onClick={() => !alert.read && void markRead([alert.id])}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color }}>{icon}</span>
                      <span className="text-xs mono font-bold" style={{ color: 'var(--text-primary)' }}>
                        {alert.title}
                      </span>
                    </div>
                    <span className="text-xs mono shrink-0" style={{ color: 'var(--text-muted)' }}>{time}</span>
                  </div>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                    {alert.body}
                  </p>
                  {!alert.read && (
                    <div className="mt-1">
                      <span className="text-xs mono" style={{ color: 'var(--accent-blue)' }}>● UNREAD</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
