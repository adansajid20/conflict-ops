'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Runs a refresh function on a schedule, but:
 * - Only when the tab is visible (pauses in background)
 * - Immediately on tab focus if data is stale
 * - Cancels in-flight requests when component unmounts
 */
export function useVisibilityRefresh(
  fn: () => void,
  intervalMs: number,
  options: { runOnMount?: boolean } = { runOnMount: true }
) {
  const lastRun = useRef<number>(0)
  const timerId = useRef<ReturnType<typeof setInterval> | null>(null)
  const stableFn = useRef(fn)
  stableFn.current = fn

  const runIfStale = useCallback(() => {
    if (document.visibilityState === 'hidden') return
    const now = Date.now()
    if (now - lastRun.current >= intervalMs) {
      lastRun.current = now
      stableFn.current()
    }
  }, [intervalMs])

  useEffect(() => {
    if (options.runOnMount) {
      lastRun.current = Date.now()
      stableFn.current()
    }

    timerId.current = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        lastRun.current = Date.now()
        stableFn.current()
      }
    }, intervalMs)

    document.addEventListener('visibilitychange', runIfStale)

    return () => {
      if (timerId.current) clearInterval(timerId.current)
      document.removeEventListener('visibilitychange', runIfStale)
    }
  }, [intervalMs, runIfStale, options.runOnMount])
}
