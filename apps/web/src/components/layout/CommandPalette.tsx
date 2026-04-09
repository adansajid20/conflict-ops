'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Search, LayoutDashboard, Activity, Globe, Bell, Target, FlaskConical, Radio, TrendingUp, ScanSearch, Plane, Stethoscope, Building2, KeyRound, Webhook, CreditCard } from 'lucide-react'
import { useRouter } from 'next/navigation'

type PaletteItem = {
  id: string
  label: string
  href?: string
  type: 'page' | 'action' | 'event'
  keywords?: string[]
  icon: unknown
  meta?: string
}

const PAGE_ITEMS: PaletteItem[] = [
  { id: 'overview', label: 'Overview', href: '/overview', type: 'page', icon: LayoutDashboard },
  { id: 'feed', label: 'Intel Feed', href: '/feed', type: 'page', icon: Activity },
  { id: 'map', label: 'Map', href: '/map', type: 'page', icon: Globe },
  { id: 'alerts', label: 'Alerts', href: '/alerts', type: 'page', icon: Bell },
  { id: 'missions', label: 'Missions', href: '/missions', type: 'page', icon: Target },
  { id: 'workbench', label: 'Workbench', href: '/workbench', type: 'page', icon: FlaskConical },
  { id: 'tracking', label: 'Tracking', href: '/tracking', type: 'page', icon: Radio },
  { id: 'markets', label: 'Markets', href: '/markets', type: 'page', icon: TrendingUp },
  { id: 'geoverify', label: 'Geoverify', href: '/geoverify', type: 'page', icon: ScanSearch },
  { id: 'travel', label: 'Travel Risk', href: '/travel', type: 'page', icon: Plane },
  { id: 'admin', label: 'Doctor / Admin', href: '/admin', type: 'page', icon: Stethoscope },
  { id: 'org', label: 'Organization Settings', href: '/settings/org', type: 'page', icon: Building2 },
  { id: 'api', label: 'API Keys', href: '/settings/api', type: 'page', icon: KeyRound },
  { id: 'webhooks', label: 'Webhooks', href: '/settings/webhooks', type: 'page', icon: Webhook },
  { id: 'billing', label: 'Billing', href: '/settings/billing', type: 'page', icon: CreditCard },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [recentEvents, setRecentEvents] = useState<PaletteItem[]>([])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((v) => !v)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    let isMounted = true
    void fetch('/api/v1/events?limit=6', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: { data?: Array<{ id: string; title: string; source?: string; region?: string }> }) => {
        if (!isMounted) return
        const items = (json.data ?? []).map((event) => ({
          id: `event-${event.id}`,
          label: event.title,
          meta: [event.source ? event.source.replace(/gdelt|acled|reliefweb|newsapi|eonet|firms/ig, 'ConflictRadar Intelligence Network') : null, event.region].filter(Boolean).join(' · '),
          href: '/feed',
          type: 'event' as const,
          icon: Activity,
        }))
        setRecentEvents(items)
      })
      .catch(() => { if (isMounted) setRecentEvents([]) })
    return () => { isMounted = false }
  }, [open])

  const actionItems: PaletteItem[] = [
    { id: 'refresh-feed', label: 'Refresh intel feed', type: 'action', icon: Activity, keywords: ['reload', 'events'] },
    { id: 'open-alerts', label: 'Open active alerts', href: '/alerts', type: 'action', icon: Bell },
  ]

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const source = [...PAGE_ITEMS, ...actionItems, ...recentEvents]
    if (!needle) return source
    return source.filter((item) => {
      const haystack = [item.label, item.meta, ...(item.keywords ?? [])].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [query, recentEvents])

  const onSelect = (item: PaletteItem) => {
    if (item.id === 'refresh-feed') {
      router.push('/feed')
      router.refresh()
    } else if (item.href) {
      router.push(item.href)
    }
    setOpen(false)
    setQuery('')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="glass w-full max-w-2xl overflow-hidden rounded-xl shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/[0.05] px-4 py-3">
          {(() => { const SearchIcon = Search as React.ElementType; return <SearchIcon className="h-4 w-4 text-white/30" /> })()}
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages, recent events, and actions"
            className="w-full bg-transparent text-sm outline-none text-white"
          />
          <span className="rounded border border-white/[0.05] px-2 py-1 text-[11px] text-white/30">ESC</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-white/50">
              No matches. Try a page name, source, or region.
            </div>
          ) : (
            results.map((item, index) => {
              const Icon = item.icon as React.ElementType
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
                  style={{ background: index === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                >
                  <div className="rounded-md border border-white/[0.05] bg-white/[0.03] p-2">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">{item.label}</div>
                    <div className="truncate text-xs text-white/30">
                      {item.meta ?? item.type}
                    </div>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-white/30">{item.type}</div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
