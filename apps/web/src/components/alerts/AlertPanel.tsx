'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

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

type AlertsResponse = {
  success: boolean
  data?: Alert[]
  meta?: { personal_mode?: boolean }
  error?: string
}

const SEVERITY_COLORS: Record<number, string> = {
  1: '#10B981', 2: '#3B82F6', 3: '#F59E0B', 4: '#EF4444', 5: '#FF0000',
}
const ALERT_TYPE_ICONS: Record<string, string> = {
  pir_match: '◉', threshold: '⚠', escalation: '↑', anomaly: '◈',
}

function AlertSkeleton() {
  return (
    <div className="p-3 rounded mb-2 border-l-2" style={{ borderLeftColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="skeleton h-3 rounded mb-2" style={{ width: '70%' }} />
      <div className="skeleton h-3 rounded" style={{ width: '50%' }} />
    </div>
  )
}

export function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [personalMode, setPersonalMode] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const abortRef = useRef<AbortController | null>(null)

  const fetchAlerts = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    try {
      const res = await fetch(
        `/api/v1/alerts?limit=50${filter === 'unread' ? '&unread=true' : ''}`,
        { signal: abortRef.current.signal }
      )
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        return
      }
      const json = await res.json() as AlertsResponse
      if (!json.success) { setError(json.error ?? 'Request failed'); return }
      setAlerts(json.data ?? [])
      setPersonalMode(json.meta?.personal_mode === true)
      setError(null)
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void fetchAlerts()
    const id = setInterval(() => void fetchAlerts(), 30_000)
    return () => { clearInterval(id); abortRef.current?.abort() }
  }, [fetchAlerts])

  const markRead = async (alertIds: string[]) => {
    try {
      await fetch('/api/v1/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds, read: true }),
      })
      setAlerts(prev => prev.map(a => alertIds.includes(a.id) ? { ...a, read: true } : a))
    } catch { /* ignore */ }
  }

  const unreadCount = alerts.filter(a => !a.read).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold mono tracking-widest" style={{ color: 'var(--text-primary)' }}>ALERTS</h2>
          {unreadCount > 0 && (
            <span className="text-xs mono px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--alert-red)', color: '#fff' }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-xs mono px-2 py-1 rounded border"
              style={{
                borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
                color: filter === f ? 'var(--primary)' : 'var(--text-muted)',
              }}>
              {f.toUpperCase()}
            </button>
          ))}
          {unreadCount > 0 && (
            <button onClick={() => void markRead(alerts.filter(a => !a.read).map(a => a.id))}
              className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
              MARK ALL READ
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3">{Array.from({ length: 4 }).map((_, i) => <AlertSkeleton key={i} />)}</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-xs mono mb-3" style={{ color: '#FF4444' }}>⚠ {error}</p>
            <button onClick={() => void fetchAlerts()}
              className="px-4 py-2 rounded text-xs mono border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              RETRY
            </button>
          </div>
        ) : personalMode && alerts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-3xl mb-4">⊕</div>
            <p className="text-sm mono mb-2" style={{ color: 'var(--text-muted)' }}>CREATE AN ORG TO ENABLE ALERTS</p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-disabled)' }}>
              Alert rules (PIRs) are scoped to organizations. Complete onboarding to set one up.
            </p>
            <a href="/onboarding" className="inline-block px-6 py-2 rounded text-xs mono font-bold"
              style={{ backgroundColor: 'var(--primary)', color: '#000' }}>
              COMPLETE ONBOARDING
            </a>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-xs mono" style={{ color: 'var(--text-muted)' }}>
            {filter === 'unread' ? 'NO UNREAD ALERTS' : 'NO ALERTS — SET UP PIRs TO MONITOR'}
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
                <div key={alert.id}
                  className="p-3 rounded border-l-2 cursor-pointer hover:bg-white/5 transition-colors feed-item-enter"
                  style={{
                    backgroundColor: alert.read ? 'var(--bg-surface)' : 'var(--bg-surface-2)',
                    borderLeftColor: color,
                    opacity: alert.read ? 0.7 : 1,
                  }}
                  onClick={() => !alert.read && void markRead([alert.id])}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color }}>{icon}</span>
                      <span className="text-xs mono font-bold" style={{ color: 'var(--text-primary)' }}>{alert.title}</span>
                    </div>
                    <span className="text-xs mono shrink-0" style={{ color: 'var(--text-muted)' }}>{time}</span>
                  </div>
                  <p className="text-xs mt-1 truncate-2" style={{ color: 'var(--text-muted)' }}>{alert.body}</p>
                  {!alert.read && <span className="text-xs mono mt-1 block" style={{ color: 'var(--accent-blue)' }}>● UNREAD</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
