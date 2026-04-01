'use client'

import { useEffect, useMemo, useState } from 'react'

type NotificationRecord = {
  id: string
  type: 'mention' | 'alert' | 'report_ready'
  body: string
  metadata: Record<string, unknown> | null
  read: boolean
  created_at: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRecord[]>([])

  const unread = useMemo(() => items.filter((item) => !item.read).length, [items])

  const load = async () => {
    const res = await fetch('/api/v1/notifications?limit=50', { cache: 'no-store' })
    const json = await res.json() as { success?: boolean; data?: NotificationRecord[] }
    setItems(json.data ?? [])
  }

  useEffect(() => { void load() }, [])

  const markRead = async (id: string) => {
    await fetch(`/api/v1/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) })
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item))
  }

  const markAllRead = async () => {
    await fetch('/api/v1/notifications/all', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) })
    setItems((current) => current.map((item) => ({ ...item, read: true })))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg border px-3 py-2 text-xs mono"
        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--bg-surface)' }}
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] mono"
            style={{ background: 'var(--sev-critical)', color: '#fff' }}>
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[360px] rounded-lg border p-3 shadow-xl"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs mono font-bold" style={{ color: 'var(--text-primary)' }}>NOTIFICATIONS</div>
            <button onClick={() => void markAllRead()} className="text-[11px] mono" style={{ color: 'var(--primary)' }}>MARK ALL READ</button>
          </div>
          <div className="max-h-[420px] overflow-y-auto space-y-2">
            {items.length === 0 ? (
              <div className="rounded border p-3 text-xs mono" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>No notifications.</div>
            ) : items.map((item) => (
              <button
                key={item.id}
                onClick={() => void markRead(item.id)}
                className="block w-full rounded border p-3 text-left"
                style={{ borderColor: item.read ? 'var(--border)' : 'var(--primary)', background: item.read ? 'var(--bg-surface-2)' : 'var(--primary-dim)' }}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] mono" style={{ color: item.read ? 'var(--text-muted)' : 'var(--primary)' }}>{item.type.toUpperCase()}</span>
                  <span className="text-[10px] mono" style={{ color: 'var(--text-muted)' }}>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-primary)' }}>{item.body}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
