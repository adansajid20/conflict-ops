'use client'
import { useState, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export const TIME_WINDOWS = ['1h', '6h', '24h', '7d', '30d'] as const
export type TimeWindow = typeof TIME_WINDOWS[number]

export function windowToMs(w: TimeWindow): number {
  const map: Record<TimeWindow, number> = {
    '1h': 3600000,
    '6h': 21600000,
    '24h': 86400000,
    '7d': 604800000,
    '30d': 2592000000,
  }
  return map[w]
}

export function windowToSinceISO(w: TimeWindow): string {
  return new Date(Date.now() - windowToMs(w)).toISOString()
}

const LS_KEY = 'conflict_ops_time_window'

export function useTimeWindow(defaultWindow: TimeWindow = '24h') {
  const searchParams = useSearchParams()

  const [window, setWindowState] = useState<TimeWindow>(() => {
    // Priority: URL param > localStorage > default
    const fromUrl = searchParams?.get('w') as TimeWindow | null
    if (fromUrl && TIME_WINDOWS.includes(fromUrl)) return fromUrl
    try {
      const fromLS = localStorage.getItem(LS_KEY) as TimeWindow | null
      if (fromLS && TIME_WINDOWS.includes(fromLS)) return fromLS
    } catch { /* SSR */ }
    return defaultWindow
  })

  const setWindow = useCallback((w: TimeWindow) => {
    setWindowState(w)
    try { localStorage.setItem(LS_KEY, w) } catch { /* SSR */ }
    // Update URL without navigation
    try {
      const url = new URL(globalThis.location.href)
      url.searchParams.set('w', w)
      globalThis.history.replaceState({}, '', url.toString())
    } catch { /* SSR */ }
  }, [])

  return { window, setWindow, sinceISO: windowToSinceISO(window) }
}
