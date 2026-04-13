'use client'
import { useEffect, useState, useCallback } from 'react'

export type HealthStatus = {
  ok: boolean
  // New envelope fields
  version_sha?: string
  now_utc?: string
  db_ok?: boolean
  redis_ok?: boolean
  auth_ok?: boolean
  scheduler_ok?: boolean
  ingest?: {
    ok: boolean
    last_success_at: string | null
    last_run_at: string | null
    inserted_24h: number
    deduped_24h: number
  }
  sources?: {
    enabled: number
    live: number
    failing: string[]
    detail: Array<{ name: string; ok: boolean; last_seen_at: string | null; stale: boolean }>
  }
  events?: { total: number; inserted_24h: number }
  safe_mode?: boolean
  degraded_reasons?: string[]
  // Legacy fields (backward compat)
  dbOk: boolean
  redisOk: boolean
  ingestOk: boolean
  safeMode: boolean
  lastIngestAt: string | null
  eventCount: number
  errors: string[]
  enabledSources: Array<{ name: string; ok: boolean; last_seen_at: string | null; stale: boolean }>
  latencyMs: number
  versionSha?: string
}

export type StatusLevel = 'nominal' | 'degraded' | 'outage' | 'loading'

export function getStatusLevel(h: HealthStatus | null): StatusLevel {
  if (!h) return 'loading'
  if (!h.dbOk && !(h.db_ok)) return 'outage'
  const degrade = (h.degraded_reasons?.length ?? 0) > 0
    || (h.errors?.length ?? 0) > 0
    || (!h.ingestOk && !(h.ingest?.ok))
  return degrade ? 'degraded' : 'nominal'
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
