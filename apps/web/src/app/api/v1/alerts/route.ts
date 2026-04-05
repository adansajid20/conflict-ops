export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { data, error } = await supabase.from('alert_rules').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alerts: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  try {
    const body = await req.json() as { user_id?: string; name?: string; alert_type?: string; config?: Record<string,unknown>; channels?: string[]; cooldown_minutes?: number }
    const { user_id, name, alert_type, config, channels, cooldown_minutes } = body
    if (!user_id || !name || !alert_type || !config) return NextResponse.json({ error: 'user_id, name, alert_type, config required' }, { status: 400 })

    const { data, error } = await supabase.from('alert_rules').insert({
      user_id, name, alert_type: alert_type as string, config: config as Record<string,unknown>,
      channels: channels ?? ['in_app'], cooldown_minutes: cooldown_minutes ?? 30, active: true,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ alert: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabase.from('alert_rules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
