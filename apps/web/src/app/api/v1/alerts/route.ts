export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { safeAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/alerts — Alert history & rule management
 *
 * Query params:
 *   type=rules     → user_alerts (rule configurations)
 *   type=stats     → aggregated alert statistics
 *   severity=3     → filter by minimum severity
 *   unread=true    → only unread alerts
 *   limit=100      → max results (default 100, max 500)
 *   offset=0       → pagination offset
 */
export async function GET(req: NextRequest) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500)
  const offset = Number(url.searchParams.get('offset') ?? 0)

  // ── Return user alert rules ──
  if (type === 'rules') {
    const { data, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  }

  // ── Return aggregated stats ──
  if (type === 'stats') {
    const [{ count: totalCount }, { count: unreadCount }, { data: recentAlerts }] = await Promise.all([
      supabase.from('alert_history').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('alert_history').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false),
      supabase.from('alert_history')
        .select('severity, created_at')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }),
    ])

    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const alert of recentAlerts ?? []) {
      const sev = Number(alert.severity ?? 1)
      if (sev >= 4) severityCounts.critical++
      else if (sev >= 3) severityCounts.high++
      else if (sev >= 2) severityCounts.medium++
      else severityCounts.low++
    }

    // Hourly alert rate for the last 24h
    const hourlyRate = Math.round(((recentAlerts?.length ?? 0) / 24) * 10) / 10

    return NextResponse.json({
      data: {
        total: totalCount ?? 0,
        unread: unreadCount ?? 0,
        last_24h: recentAlerts?.length ?? 0,
        severity_breakdown: severityCounts,
        hourly_rate: hourlyRate,
      },
    })
  }

  // ── Default: return triggered alert history ──
  let query = supabase
    .from('alert_history')
    .select('*')
    .eq('user_id', userId)

  // Optional filters
  const minSeverity = url.searchParams.get('severity')
  if (minSeverity) {
    query = query.gte('severity', minSeverity)
  }

  const unreadOnly = url.searchParams.get('unread')
  if (unreadOnly === 'true') {
    query = query.eq('read', false)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    // Fallback to legacy alerts table
    const { data: fallback, error: err2 } = await supabase
      .from('alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (err2) return NextResponse.json({ data: [] })
    return NextResponse.json({ data: fallback ?? [] })
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/v1/alerts — Create a new user alert rule
 *
 * Supports both:
 * - Legacy fields: name, regions[], severities[], keywords[], frequency, delivery_email
 * - Advanced: rule_definition (AdvancedRuleDefinition), channel_routing[], dedupe_config, escalation_policy
 */
export async function POST(req: NextRequest) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  try {
    const body = await req.json() as Record<string, unknown>
    const { name } = body
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const row: Record<string, unknown> = {
      user_id: userId,
      name,
      active: true,
    }

    // Legacy fields
    if (Array.isArray(body.regions) && body.regions.length) row.regions = body.regions
    if (Array.isArray(body.severities) && body.severities.length) row.severities = body.severities
    if (Array.isArray(body.keywords) && body.keywords.length) row.keywords = body.keywords
    if (body.frequency) row.frequency = body.frequency
    if (body.delivery_email) row.delivery_email = body.delivery_email
    if (body.delivery_webhook) row.delivery_webhook = body.delivery_webhook

    // Advanced fields (stored as JSONB in rule_definition column)
    if (body.rule_definition) row.rule_definition = body.rule_definition
    if (body.channel_routing) row.channel_routing = body.channel_routing
    if (body.dedupe_config) row.dedupe_config = body.dedupe_config
    if (body.escalation_policy) row.escalation_policy = body.escalation_policy
    if (body.suppression_windows) row.suppression_windows = body.suppression_windows
    if (Array.isArray(body.tags)) row.tags = body.tags

    // Actor & data source filters
    if (Array.isArray(body.actor_ids) && body.actor_ids.length) row.actor_ids = body.actor_ids
    if (body.include_flights !== undefined) row.include_flights = body.include_flights
    if (body.include_vessels !== undefined) row.include_vessels = body.include_vessels
    if (body.watchlist_id) row.watchlist_id = body.watchlist_id

    const { data, error } = await supabase
      .from('user_alerts')
      .insert(row)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/**
 * PATCH /api/v1/alerts — Bulk operations on alert history
 *
 * Actions:
 *   { alertIds, read }          → Mark specific alerts read/unread
 *   { all: true, read }         → Mark all alerts read/unread
 *   { alertIds, ack_status }    → Set acknowledgment status
 *   { alertIds, ack_note }      → Add acknowledgment note
 */
export async function PATCH(req: NextRequest) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  try {
    const body = await req.json() as {
      alertIds?: string[]
      read?: boolean
      all?: boolean
      ack_status?: string
      ack_note?: string
    }

    if (body.all && typeof body.read === 'boolean') {
      const { error } = await supabase
        .from('alert_history')
        .update({ read: body.read })
        .eq('user_id', userId)
      if (error) {
        await supabase.from('alerts').update({ read: body.read }).eq('user_id', userId)
      }
      return NextResponse.json({ success: true })
    }

    if (!body.alertIds?.length) {
      return NextResponse.json({ error: 'alertIds required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.read === 'boolean') updates.read = body.read
    if (body.ack_status) {
      updates.ack_status = body.ack_status
      updates.ack_at = new Date().toISOString()
      updates.ack_by = userId
    }
    if (body.ack_note) updates.ack_note = body.ack_note

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates specified' }, { status: 400 })
    }

    const { error } = await supabase
      .from('alert_history')
      .update(updates)
      .in('id', body.alertIds)
      .eq('user_id', userId)

    if (error) {
      // Fallback
      await supabase.from('alerts')
        .update({ read: body.read ?? true })
        .in('id', body.alertIds)
        .eq('user_id', userId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/**
 * DELETE /api/v1/alerts — Delete a user alert rule or dismiss an alert
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Try alert_history first, then user_alerts, then legacy alerts
  const { error: histErr } = await supabase.from('alert_history').delete().eq('id', id).eq('user_id', userId)
  if (histErr) {
    const { error } = await supabase.from('user_alerts').delete().eq('id', id).eq('user_id', userId)
    if (error) {
      await supabase.from('alerts').delete().eq('id', id).eq('user_id', userId)
    }
  }

  return NextResponse.json({ deleted: true })
}
