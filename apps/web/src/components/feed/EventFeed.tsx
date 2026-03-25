'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { eventToIntelItem, safeTimeAgo, severityColor, type IntelItem } from '@/types/intel-item'
import { IntelDrawer } from '@/components/intel/IntelDrawer'

type TimeWindow = '1h' | '6h' | '24h' | '7d' | '30d'

const WINDOWS: { label: string; value: TimeWindow; ms: number }[] = [
  { label: '1H',  value: '1h',  ms: 3600000 },
  { label: '6H',  value: '6h',  ms: 21600000 },
  { label: '24H', value: '24h', ms: 86400000 },
  { label: '7D',  value: '7d',  ms: 604800000 },
  { label: '30D', value: '30d', ms: 2592000000 },
]

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    gdelt: 'GDELT', reliefweb: 'ReliefWeb', gdacs: 'GDACS',
    unhcr: 'UNHCR', nasa_eonet: 'NASA EONET',
  }
  return map[source] ?? source.toUpperCase()
}

// Drawer is now the shared IntelDrawer component

export function EventFeed() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [items, setItems] = useState<IntelItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<IntelItem | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Persist window in URL (?w=7d) + localStorage fallback
  const getInitialWindow = (): TimeWindow => {
    const urlW = searchParams?.get('w') as TimeWindow | null
    if (urlW && WINDOWS.find(x => x.value === urlW)) return urlW
    try {
      const stored = localStorage.getItem('intel_feed_window') as TimeWindow | null
      if (stored && WINDOWS.find(x => x.value === stored)) return stored
    } catch { /* ignore */ }
    return '7d'
  }
  const [window_, setWindow] = useState<TimeWindow>(getInitialWindow)

  const fetchEvents = useCallback(async (w: TimeWindow) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const ms = WINDOWS.find(x => x.value === w)?.ms ?? 86400000
    const since = new Date(Date.now() - ms).toISOString()
    try {
      setError(null)
      const res = await fetch(`/api/v1/events?limit=100&since=${since}`, {
        signal: abortRef.current.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = await res.json() as { success: boolean; data?: Record<string, unknown>[] }
      setItems((d.data ?? []).map(eventToIntelItem))
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void fetchEvents(window_)
    const id = setInterval(() => void fetchEvents(window_), 60_000)
    return () => {
      clearInterval(id)
      abortRef.current?.abort()
    }
  }, [window_, fetchEvents])

  return (
    <div className="h-full flex flex-col relative">
      {/* Controls */}
      <div className="px-4 py-2 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="flex items-center gap-1">
          {WINDOWS.map(w => (
            <button
              key={w.value}
              onClick={() => {
                setWindow(w.value)
                setLoading(true)
                try { localStorage.setItem('intel_feed_window', w.value) } catch { /* ignore */ }
                const params = new URLSearchParams(searchParams?.toString() ?? '')
                params.set('w', w.value)
                router.replace(`?${params.toString()}`, { scroll: false })
              }}
              className="px-2 py-1 text-xs mono rounded transition-colors"
              style={{
                backgroundColor: window_ === w.value ? 'rgba(0,255,136,0.15)' : 'transparent',
                color: window_ === w.value ? 'var(--primary)' : 'var(--text-muted)',
                border: window_ === w.value ? '1px solid rgba(0,255,136,0.3)' : '1px solid transparent',
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs mono" style={{ color: 'var(--text-muted)' }}>
            {items.length} EVENTS
          </span>
          <div className="flex items-center gap-1.5">
            <span className="status-dot green" />
            <span className="text-xs mono" style={{ color: 'var(--alert-green)' }}>LIVE</span>
          </div>
          <button
            onClick={() => { setLoading(true); void fetchEvents(window_) }}
            className="text-xs mono hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >↺</button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-14 rounded" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-6 text-center">
            <div className="text-sm font-bold mb-2" style={{ color: '#EF4444' }}>FEED ERROR</div>
            <div className="text-xs mono mb-4" style={{ color: 'var(--text-muted)' }}>{error}</div>
            <button
              onClick={() => { setLoading(true); void fetchEvents(window_) }}
              className="text-xs mono px-3 py-1.5 rounded border hover:opacity-80 transition-opacity"
              style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
            >
              RETRY
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-2xl mb-3 opacity-30">◈</div>
            <div className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>NO EVENTS IN WINDOW</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Try expanding the time window or trigger an ingest from the Doctor page.
            </div>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full text-left border-b px-4 py-3 transition-colors hover:bg-white/5 active:bg-white/10"
                style={{ borderColor: 'var(--border)', display: 'block' }}
              >
                <div className="flex items-start gap-3">
                  {/* Severity bar */}
                  <div
                    className="w-0.5 rounded-full mt-0.5 shrink-0"
                    style={{
                      height: 36,
                      backgroundColor: severityColor(item.severity),
                      opacity: 0.8,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {/* Source + time */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs mono font-bold px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: 'rgba(0,255,136,0.08)',
                          color: 'var(--primary)',
                          fontSize: 10,
                        }}>
                        {sourceLabel(item.source)}
                      </span>
                      {item.country_code && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          {item.country_code}
                        </span>
                      )}
                      <span className="text-xs ml-auto shrink-0" style={{ color: 'var(--text-disabled)', fontSize: 10 }}>
                        {safeTimeAgo(item.occurred_at ?? item.ingested_at)}
                      </span>
                    </div>
                    {/* Title */}
                    <div className="text-xs leading-snug truncate" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                  </div>
                  {/* Arrow */}
                  <span className="text-xs shrink-0 mt-1" style={{ color: 'var(--text-disabled)' }}>›</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <IntelDrawer
        item={selectedItem}
        items={items}
        onClose={() => setSelectedItem(null)}
        onNavigate={setSelectedItem}
      />
    </div>
  )
}
