export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * GET /api/v1/alerts — Returns triggered alert notifications from alert_history
 * Also returns user alert rules from user_alerts via ?type=rules
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const url = new URL(req.url)
  const type = url.searchParams.get('type') // 'rules' | null (default = history)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 100), 500)

  if (type === 'rules') {
    // Return user alert configurations/rules
    const { data, error } = await supabase
      .from('user_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  }

  // Default: return triggered alert history (the actual notifications)
  const { data, error } = await supabase
    .from('alert_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    // Fallback: if alert_history doesn't exist, try alerts table
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
 * Matches actual user_alerts table: name, regions[], severities[], keywords[],
 * frequency, delivery_email, delivery_webhook, active
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  try {
    const body = await req.json() as {
      name?: string
      regions?: string[]
      severities?: string[]
      keywords?: string[]
      frequency?: string
      delivery_email?: string
      delivery_webhook?: string
    }
    const { name } = body
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const row: Record<string, unknown> = {
      user_id: userId,
      name,
      active: true,
    }
    if (body.regions?.length) row.regions = body.regions
    if (body.severities?.length) row.severities = body.severities
    if (body.keywords?.length) row.keywords = body.keywords
    if (body.frequency) row.frequency = body.frequency
    if (body.delivery_email) row.delivery_email = body.delivery_email
    if (body.delivery_webhook) row.delivery_webhook = body.delivery_webhook

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
 * PATCH /api/v1/alerts — Mark alerts as read/unread in bulk
 */
export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  try {
    const body = await req.json() as { alertIds?: string[]; read?: boolean; all?: boolean }
    const { alertIds, read, all } = body

    if (all && typeof read === 'boolean') {
      // Mark ALL user alerts as read/unread
      const { error } = await supabase
        .from('alert_history')
        .update({ read })
        .eq('user_id', userId)
      if (error) {
        // Fallback to alerts table
        await supabase.from('alerts').update({ read }).eq('user_id', userId)
      }
      return NextResponse.json({ success: true })
    }

    if (!alertIds?.length) {
      return NextResponse.json({ error: 'alertIds required' }, { status: 400 })
    }

    // Update specific alerts
    const { error } = await supabase
      .from('alert_history')
      .update({ read: read ?? true })
      .in('id', alertIds)
      .eq('user_id', userId)

    if (error) {
      // Fallback to alerts table
      await supabase.from('alerts')
        .update({ read: read ?? true, read_at: read ? new Date().toISOString() : null })
        .in('id', alertIds)
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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Try deleting from alert_history first, then user_alerts
  const { error: histErr } = await supabase.from('alert_history').delete().eq('id', id).eq('user_id', userId)
  if (histErr) {
    const { error } = await supabase.from('user_alerts').delete().eq('id', id).eq('user_id', userId)
    if (error) {
      await supabase.from('alerts').delete().eq('id', id).eq('user_id', userId)
    }
  }

  return NextResponse.json({ deleted: true })
}
