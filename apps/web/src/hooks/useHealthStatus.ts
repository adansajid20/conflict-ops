'use client'
import { useEffect, useState, useCallback } from 'react'

export type HealthStatus = {
  ok: boolean
  dbOk: boolean
  redisOk: boolean
  ingestOk: boolean
  safeMode: boolean
  lastIngestAt: string | null
  eventCount: number
  errors: string[]
  enabledSources: Array<{ name: string; ok: boolean; last_seen_at: string | null; stale: boolean }>
  latencyMs: number
  timestamp: string
}

export type StatusLevel = 'nominal' | 'degraded' | 'outage' | 'loading'

export function getStatusLevel(h: HealthStatus | null): StatusLevel {
  if (!h) return 'loading'
  if (!h.dbOk) return 'outage'
  if (h.errors.length > 0 || !h.ingestOk || !h.redisOk) return 'degraded'
  return 'nominal'
}

export function useHealthStatus(pollIntervalMs = 60_000) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      if (!res.ok) { setFetchError(`HTTP ${res.status}`); return }
      const data = await res.json() as HealthStatus
      setHealth(data)
      setFetchError(null)
    } catch (e) {
      setFetchError(String(e))
    }
  }, [])

  useEffect(() => {
    void check()
    const id = setInterval(() => void check(), pollIntervalMs)
    return () => clearInterval(id)
  }, [check, pollIntervalMs])

  return { health, fetchError, statusLevel: getStatusLevel(health), refresh: check }
}
