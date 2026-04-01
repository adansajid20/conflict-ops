export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/server'
import { runDoctorChecks, type DoctorCheck } from '@/lib/doctor/checks'
import { runSelfHeal } from '@/lib/doctor/self-heal'
import { RUNBOOK, type RunbookEntry } from '@/lib/doctor/runbook'
import type { ApiResponse } from '@conflict-ops/shared'

type DoctorRunPayload = {
  checks: DoctorCheck[]
  actions: Array<{ action: string; target: string; status: string; message: string }>
  last_updated: string
}

type DoctorLogEntry = {
  id: string
  created_at: string
  resource_id: string | null
  metadata: Record<string, unknown>
}

type DoctorGetResponse = {
  last_run: DoctorRunPayload | null
  auto_actions: DoctorLogEntry[]
}

type DoctorPostBody = {
  action: 'run_now' | 'safe_mode' | 'pause_heavy_lane' | 'flush_cache' | 'open_circuit_breaker'
  source?: string
  enabled?: boolean
}

function getRedisClient(): Redis | null {
  const url = process.env['UPSTASH_REDIS_REST_URL']
  const token = process.env['UPSTASH_REDIS_REST_TOKEN']
  if (!url || !token) return null
  return new Redis({ url, token })
}

async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse<ApiResponse<null>> }> {
  const { userId } = await auth()
  if (!userId) return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('role').eq('clerk_user_id', userId).single()
  if (!user || !['owner', 'admin'].includes(user.role ?? '')) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 }) }
  }

  return { ok: true, userId }
}

async function loadAutoActions(): Promise<DoctorLogEntry[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, created_at, resource_id, metadata')
    .eq('action', 'auto_heal')
    .order('created_at', { ascending: false })
    .limit(10)

  return (data ?? []) as DoctorLogEntry[]
}

async function persistDoctorRun(payload: DoctorRunPayload): Promise<void> {
  const redis = getRedisClient()
  if (!redis) return
  await redis.set('doctor:last_run', JSON.stringify(payload), { ex: 300 })
}

async function executeDoctorRun(): Promise<DoctorRunPayload> {
  const checks = await runDoctorChecks()
  const actions = await runSelfHeal(checks)
  const payload: DoctorRunPayload = {
    checks,
    actions,
    last_updated: new Date().toISOString(),
  }
  await persistDoctorRun(payload)
  return payload
}

export async function GET(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  const url = new URL(req.url)
  if (url.searchParams.get('runbook') === 'true') {
    return NextResponse.json({ success: true, data: RUNBOOK })
  }

  const redis = getRedisClient()
  let lastRun: DoctorRunPayload | null = null
  if (redis) {
    try {
      const payload = await redis.get<string>('doctor:last_run')
      if (typeof payload === 'string') {
        lastRun = JSON.parse(payload) as DoctorRunPayload
      }
    } catch {
      lastRun = null
    }
  }

  const autoActions = await loadAutoActions()
  return NextResponse.json({ success: true, data: { last_run: lastRun, auto_actions: autoActions } })
}

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return gate.response

  let body: DoctorPostBody
  try {
    body = await req.json() as DoctorPostBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.action === 'run_now') {
    const payload = await executeDoctorRun()
    return NextResponse.json({ success: true, data: payload })
  }

  const origin = process.env['NEXT_PUBLIC_APP_URL']
    ?? (process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : 'http://127.0.0.1:3000')

  if (body.action === 'safe_mode') {
    const response = await fetch(`${origin}/api/v1/admin/safe-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env['INTERNAL_SECRET'] ?? 'dev' },
      body: JSON.stringify({ enabled: body.enabled ?? true, reason: 'doctor manual control' }),
    })
    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Safe mode control failed with ${response.status}` }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: { action: 'safe_mode' } })
  }

  if (body.action === 'flush_cache') {
    const response = await fetch(`${origin}/api/v1/admin/clear-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': process.env['INTERNAL_SECRET'] ?? 'dev' },
    })
    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Cache flush failed with ${response.status}` }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: { action: 'flush_cache' } })
  }

  const redis = getRedisClient()
  if (!redis) {
    return NextResponse.json({ success: false, error: 'Redis not configured' }, { status: 500 })
  }

  if (body.action === 'pause_heavy_lane') {
    await redis.set('heavy_lane_paused', JSON.stringify({ paused: true, set_at: new Date().toISOString(), reason: 'doctor manual control' }))
    return NextResponse.json({ success: true, data: { action: 'pause_heavy_lane' } })
  }

  if (body.action === 'open_circuit_breaker') {
    const source = body.source?.trim()
    if (!source) {
      return NextResponse.json({ success: false, error: 'source is required for open_circuit_breaker' }, { status: 400 })
    }
    await redis.set(`circuit_breaker:${source}`, JSON.stringify({ open: true, set_at: new Date().toISOString(), reason: 'doctor manual control' }))
    return NextResponse.json({ success: true, data: { action: 'open_circuit_breaker' } })
  }

  return NextResponse.json({ success: false, error: 'Unsupported action' }, { status: 400 })
}
