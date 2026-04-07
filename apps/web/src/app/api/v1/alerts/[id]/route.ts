export const runtime = 'nodejs'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * PATCH /api/v1/alerts/:id — Update a user alert rule or mark an alert as read
 *
 * Two modes:
 * 1. Alert history: { read: boolean } or { dismissed: boolean } — updates alert_history
 * 2. User alert rule: { name, regions, severities, keywords, frequency, ... } — updates user_alerts
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Mode 1: Mark alert_history item as read/dismissed
  if ('read' in body || 'dismissed' in body) {
    const updates: Record<string, unknown> = {}
    if (typeof body.read === 'boolean') updates.read = body.read
    if (typeof body.dismissed === 'boolean') updates.dismissed = body.dismissed

    // Try alert_history first
    const { data, error } = await supabase
      .from('alert_history')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (!error && data) return NextResponse.json({ success: true, data })

    // Fallback to alerts table (legacy org-level)
    const { data: legacy, error: legacyErr } = await supabase
      .from('alerts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (legacyErr) return NextResponse.json({ error: legacyErr.message }, { status: 500 })
    return NextResponse.json({ success: true, data: legacy })
  }

  // Mode 2: Update user_alerts rule
  const allowed = ['name', 'regions', 'severities', 'keywords', 'frequency',
    'delivery_email', 'delivery_webhook', 'active', 'include_flights', 'include_vessels']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_alerts')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

/**
 * DELETE /api/v1/alerts/:id — Delete a user alert rule
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  // Try user_alerts first (most common from Settings page)
  const { error, count } = await supabase
    .from('user_alerts')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('user_id', userId)

  if (!error && (count ?? 0) > 0) {
    return NextResponse.json({ ok: true, deleted: count })
  }

  // Fallback: try alert_history
  const { error: histErr, count: histCount } = await supabase
    .from('alert_history')
    .delete({ count: 'exact' })
    .eq('id', params.id)
    .eq('user_id', userId)

  if (!histErr && (histCount ?? 0) > 0) {
    return NextResponse.json({ ok: true, deleted: histCount })
  }

  // Final fallback: try legacy alerts table
  const { error: legErr } = await supabase
    .from('alerts')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId)

  if (legErr) return NextResponse.json({ error: legErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: 1 })
}
