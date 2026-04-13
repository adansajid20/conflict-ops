/**
 * Audit Log API — Enterprise plan
 * ISO 27001 / SOC 2 aligned event logging
 * 
 * All sensitive actions are logged:
 * - Auth events (login, logout, failed attempts)
 * - Data exports (CSV, PDF, API)
 * - Settings changes (billing, webhooks, users)
 * - Mission create/update/delete
 * - Alert acknowledge/dismiss
 * - API key create/revoke
 */

import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'

export type AuditEvent = {
  id: string
  org_id: string
  actor_id: string
  actor_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export async function GET(req: Request) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('org_id, role')
    .eq('clerk_user_id', userId)
    .single()

  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  // Only admins can read audit log
  if (!['admin', 'owner'].includes(user.role as string)) {
    return NextResponse.json({ error: 'Audit log requires admin role' }, { status: 403 })
  }

  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.auditLogs) {
    return NextResponse.json(
      { error: 'Audit log requires Enterprise plan.' },
      { status: 403 }
    )
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 1000)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')
  const action = url.searchParams.get('action')
  const since = url.searchParams.get('since')
  const actorId = url.searchParams.get('actor')

  let query = supabase
    .from('audit_log')
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action) query = query.eq('action', action)
  if (since) query = query.gte('created_at', since)
  if (actorId) query = query.eq('actor_id', actorId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data ?? [] })
}
