export const runtime = 'nodejs'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getCachedSnapshot, setCachedSnapshot } from '@/lib/cache/redis'
import { isSafeMode } from '@/lib/doctor/safe-mode-check'
import { deliverWebhook } from '@/lib/webhooks/deliver'
import { sendSlackNotification } from '@/lib/integrations/slack'
import { triggerPagerDuty } from '@/lib/integrations/pagerduty'
import type { Alert, ApiResponse } from '@conflict-ops/shared'

type AlertsResponse = {
  success?: boolean
  data?: Alert[] | Alert | null
  error?: string
  meta?: Record<string, unknown>
  alerts?: AlertSubscription[]
  alert?: AlertSubscription
  note?: string
}

type AlertConditions = {
  severity_min?: number
  regions?: string[]
  event_types?: string[]
  keywords?: string[]
}

type AlertSubscription = {
  id: string
  user_id: string
  email: string
  name: string | null
  conditions: AlertConditions
  frequency: 'realtime' | 'hourly' | 'daily'
  is_active: boolean
  last_sent_at: string | null
  created_at: string
  updated_at: string
}

const CreateAlertSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  severity: z.number().int().min(1).max(5).default(3),
})

const CreateSubscriptionSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120).optional(),
  conditions: z.object({
    severity_min: z.union([z.literal(3), z.literal(4)]).optional(),
    regions: z.array(z.string().min(1)).optional(),
    event_types: z.array(z.string().min(1)).optional(),
    keywords: z.array(z.string().min(1)).optional(),
  }).optional(),
  frequency: z.enum(['realtime', 'hourly', 'daily']).optional(),
})

function isMissingAlertsTable(error: { message?: string; code?: string } | null | undefined) {
  const message = `${error?.message ?? ''}`.toLowerCase()
  return error?.code === '42P01' || message.includes('relation') && message.includes('alerts') && message.includes('does not exist')
}

async function notifyIntegrations(orgId: string, title: string, severity: number): Promise<void> {
  const supabase = createServiceClient()
  const { data } = await supabase.from('integrations').select('provider,config,active').eq('org_id', orgId).eq('active', true)
  for (const integration of data ?? []) {
    const config = (integration.config ?? {}) as Record<string, string>
    if (integration.provider === 'slack' && config['webhook_url']) {
      await sendSlackNotification(config['webhook_url'], `${title} (severity ${severity})`)
    }
    if (integration.provider === 'pagerduty' && config['integration_key']) {
      const level = severity >= 5 ? 'critical' : severity >= 4 ? 'error' : severity >= 3 ? 'warning' : 'info'
      await triggerPagerDuty(config['integration_key'], title, level)
    }
  }
}

async function listLegacyOrgAlerts(req: NextRequest, userId: string): Promise<NextResponse<AlertsResponse>> {
  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  const cacheKey = `cache:alerts:${user?.org_id ?? 'personal'}:${unreadOnly ? 'unread' : 'all'}:${limit}`

  if (await isSafeMode()) {
    const cached = await getCachedSnapshot<Alert[]>(cacheKey)
    if (cached) {
      return NextResponse.json({ success: true, data: cached, meta: { safe_mode: true, cached: true } }, { headers: { 'X-Safe-Mode': 'true' } })
    }
    return NextResponse.json({ success: true, data: [], meta: { safe_mode: true, cached: false } }, { headers: { 'X-Safe-Mode': 'true' } })
  }

  if (!user?.org_id) return NextResponse.json({ success: true, data: [], meta: { personal_mode: true } })
  let query = supabase.from('alerts').select('*').eq('org_id', user.org_id).order('created_at', { ascending: false }).limit(limit)
  if (unreadOnly) query = query.eq('read', false)
  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const alerts = (data ?? []) as unknown as Alert[]
  await setCachedSnapshot(cacheKey, alerts, 60)
  return NextResponse.json({ success: true, data: alerts })
}

export async function GET(req: NextRequest): Promise<NextResponse<AlertsResponse>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (req.nextUrl.searchParams.has('unread')) {
    return listLegacyOrgAlerts(req, userId)
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('alerts')
    .select('id,user_id,email,name,conditions,frequency,is_active,last_sent_at,created_at,updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (isMissingAlertsTable(error)) {
    return NextResponse.json({ alerts: [], note: 'alerts table missing - run apps/web/supabase/migrations/20260403_alerts.sql in Supabase SQL editor' })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alerts: (data ?? []) as AlertSubscription[] })
}

export async function POST(req: NextRequest): Promise<NextResponse<AlertsResponse>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const legacyMode = url.searchParams.get('mode') === 'legacy'
  if (legacyMode) {
    const supabase = createServiceClient()
    const { data: user } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', userId).single()
    if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
    const parsed = CreateAlertSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    const { data, error } = await supabase.from('alerts').insert({ org_id: user.org_id, title: parsed.data.title, body: parsed.data.description ?? parsed.data.title, alert_type: 'event', severity: parsed.data.severity, delivered_at: new Date().toISOString(), read: false, metadata: {} }).select('*').single()
    if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Failed to create alert' }, { status: 500 })
    await deliverWebhook(user.org_id, 'alert.created', { alert: data })
    await notifyIntegrations(user.org_id, data.title, Number(data.severity ?? parsed.data.severity))
    return NextResponse.json({ success: true, data: data as unknown as Alert }, { status: 201 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateSubscriptionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: userId,
      email: parsed.data.email,
      name: parsed.data.name ?? 'My Alert',
      conditions: parsed.data.conditions ?? {},
      frequency: parsed.data.frequency ?? 'realtime',
    })
    .select('id,user_id,email,name,conditions,frequency,is_active,last_sent_at,created_at,updated_at')
    .single()

  if (isMissingAlertsTable(error)) {
    return NextResponse.json({ error: 'alerts table missing - run apps/web/supabase/migrations/20260403_alerts.sql in Supabase SQL editor' }, { status: 503 })
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alert: data as AlertSubscription }, { status: 201 })
}

export async function PATCH(req: NextRequest): Promise<NextResponse<AlertsResponse>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const { alertIds, read } = await req.json() as { alertIds: string[]; read: boolean }
  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) return NextResponse.json({ success: true, data: null, meta: { personal_mode: true } })
  await supabase.from('alerts').update({ read, read_at: read ? new Date().toISOString() : null }).in('id', alertIds).eq('org_id', user.org_id)
  return NextResponse.json({ success: true, data: null })
}
