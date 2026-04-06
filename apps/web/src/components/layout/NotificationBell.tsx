'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react'

type NotificationRecord = {
  id: string
  type: 'mention' | 'alert' | 'report_ready'
  body: string
  metadata: Record<string, unknown> | null
  read: boolean
  created_at: string
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  mention: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'MENTION' },
  alert: { bg: 'bg-red-500/15', text: 'text-red-400', label: 'ALERT' },
  report_ready: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'REPORT' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRecord[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = useMemo(() => items.filter((item) => !item.read).length, [items])

  const load = async () => {
    const res = await fetch('/api/v1/notifications?limit=50', { cache: 'no-store' })
    const json = await res.json() as { success?: boolean; data?: NotificationRecord[] }
    setItems(json.data ?? [])
  }

  useEffect(() => { void load() }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markRead = async (id: string) => {
    await fetch(`/api/v1/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) })
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item))
  }

  const markAllRead = async () => {
    await fetch('/api/v1/notifications/all', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) })
    setItems((current) => current.map((item) => ({ ...item, read: true })))
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell icon button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/70"
      >
        <Bell size={18} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[380px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0E1420] shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-white">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="flex items-center gap-1.5 text-[11px] text-white/40 transition-colors hover:text-blue-400"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
                  <Inbox size={22} className="text-white/20" />
                </div>
                <div className="text-sm text-white/40">No notifications yet</div>
                <div className="text-[11px] text-white/20">When something needs your attention, it&apos;ll show up here</div>
              </div>
            ) : (
              items.map((item) => {
                const style = TYPE_STYLES[item.type] ?? { bg: 'bg-red-500/15', text: 'text-red-400', label: 'ALERT' }
                return (
                  <button
                    key={item.id}
                    onClick={() => void markRead(item.id)}
                    className={`group flex w-full gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${!item.read ? 'bg-blue-500/[0.04]' : ''}`}
                  >
                    {/* Unread indicator dot */}
                    <div className="mt-1.5 flex-shrink-0">
                      {!item.read ? (
                        <span className="block h-2 w-2 rounded-full bg-blue-400" />
                      ) : (
                        <span className="block h-2 w-2 rounded-full bg-white/[0.08]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${style.bg} ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-[10px] text-white/20">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className={`text-[12px] leading-relaxed ${item.read ? 'text-white/40' : 'text-white/80'}`}>
                        {item.body}
                      </div>
                    </div>

                    {/* Mark read icon */}
                    {!item.read && (
                      <div className="mt-1 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <Check size={14} className="text-white/30" />
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
