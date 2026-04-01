import { Redis } from '@upstash/redis'
import { writeAuditLog } from '@/lib/audit/log'
import { createServiceClient } from '@/lib/supabase/server'
import type { DoctorCheck } from '@/lib/doctor/checks'

type AutoHealAction = {
  action: string
  target: string
  status: 'applied' | 'skipped' | 'failed'
  message: string
}

function getRedisClient(): Redis | null {
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (!url || !token) return null
  return new Redis({ url, token })
}

function extractNumericValue(check: DoctorCheck): number | null {
  if (typeof check.value === 'number') return check.value
  if (typeof check.value !== 'string') return null
  const numeric = Number.parseFloat(check.value.replace(/[^0-9.\-]/g, ''))
  return Number.isFinite(numeric) ? numeric : null
}

async function logAutoHeal(action: AutoHealAction, metadata: Record<string, unknown>): Promise<void> {
  try {
    const supabase = createServiceClient()
    await writeAuditLog(supabase, {
      orgId: 'system',
      userId: null,
      action: 'auto_heal',
      resourceType: 'doctor',
      resourceId: action.target,
      metadata: {
        governance: 'operational-flags-only',
        ...action,
        ...metadata,
      },
      ipAddress: null,
    })
  } catch {
    // audit failure is non-fatal
  }
}

export async function runSelfHeal(checks: DoctorCheck[]): Promise<AutoHealAction[]> {
  const actions: AutoHealAction[] = []
  const redis = getRedisClient()
  const cacheCheck = checks.find((check) => check.name === 'Cache Hit Rate')
  const dbCheck = checks.find((check) => check.name === 'DB Pool')
  const aiSpendCheck = checks.find((check) => check.name === 'AI Spend')
  const ingestCheck = checks.find((check) => check.name === 'Ingest Job Health')

  if (ingestCheck?.status === 'error' && redis) {
    const failedSources = Array.isArray(ingestCheck.details?.['failed_sources'])
      ? ingestCheck.details?.['failed_sources'] as string[]
      : []

    for (const source of failedSources) {
      try {
        await redis.set(`circuit_breaker:${source}`, JSON.stringify({ open: true, set_at: new Date().toISOString(), reason: 'doctor_auto_heal' }))
        const action: AutoHealAction = { action: 'open_circuit_breaker', target: source, status: 'applied', message: `Opened circuit for ${source}.` }
        actions.push(action)
        await logAutoHeal(action, { source })
      } catch (error) {
        const action: AutoHealAction = { action: 'open_circuit_breaker', target: source, status: 'failed', message: error instanceof Error ? error.message : 'Failed to open source circuit.' }
        actions.push(action)
        await logAutoHeal(action, { source })
      }
    }
  }

  if (aiSpendCheck?.status === 'error' && redis) {
    try {
      await redis.set('heavy_lane_paused', JSON.stringify({ paused: true, set_at: new Date().toISOString(), reason: 'doctor_ai_spend_limit' }))
      const action: AutoHealAction = { action: 'pause_heavy_lane', target: 'heavy_lane', status: 'applied', message: 'Paused heavy lane due to AI spend threshold.' }
      actions.push(action)
      await logAutoHeal(action, { spend: aiSpendCheck.value })
    } catch (error) {
      const action: AutoHealAction = { action: 'pause_heavy_lane', target: 'heavy_lane', status: 'failed', message: error instanceof Error ? error.message : 'Failed to pause heavy lane.' }
      actions.push(action)
      await logAutoHeal(action, { spend: aiSpendCheck.value })
    }
  }

  if (dbCheck?.status === 'error') {
    try {
      const origin = process.env['NEXT_PUBLIC_APP_URL'] ?? (process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : 'http://127.0.0.1:3000')
      const response = await fetch(`${origin.replace(/\/$/, '')}/api/v1/admin/safe-mode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env['INTERNAL_SECRET'] ?? 'dev',
        },
        body: JSON.stringify({ enabled: true, reason: 'doctor_db_pool_error' }),
      })
      if (!response.ok) throw new Error(`safe-mode API returned ${response.status}`)
      const action: AutoHealAction = { action: 'activate_safe_mode', target: 'platform', status: 'applied', message: 'Safe mode enabled after DB pool failure.' }
      actions.push(action)
      await logAutoHeal(action, { db_check: dbCheck.message })
    } catch (error) {
      const action: AutoHealAction = { action: 'activate_safe_mode', target: 'platform', status: 'failed', message: error instanceof Error ? error.message : 'Failed to activate safe mode.' }
      actions.push(action)
      await logAutoHeal(action, { db_check: dbCheck.message })
    }
  }

  const cacheHitRate = cacheCheck ? extractNumericValue(cacheCheck) : null
  if (cacheCheck && cacheHitRate !== null && cacheHitRate < 20) {
    try {
      const origin = process.env['NEXT_PUBLIC_APP_URL'] ?? (process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : 'http://127.0.0.1:3000')
      const response = await fetch(`${origin.replace(/\/$/, '')}/api/v1/admin/clear-cache`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env['INTERNAL_SECRET'] ?? 'dev',
        },
      })
      if (!response.ok) throw new Error(`clear-cache API returned ${response.status}`)
      const action: AutoHealAction = { action: 'flush_cache', target: 'cache', status: 'applied', message: 'Cache flush triggered because hit rate fell below 20%.' }
      actions.push(action)
      await logAutoHeal(action, { cache_hit_rate: cacheCheck.value })
    } catch (error) {
      const action: AutoHealAction = { action: 'flush_cache', target: 'cache', status: 'failed', message: error instanceof Error ? error.message : 'Failed to flush cache.' }
      actions.push(action)
      await logAutoHeal(action, { cache_hit_rate: cacheCheck.value })
    }
  }

  return actions
}
