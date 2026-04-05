export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const userId = new URL(req.url).searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  const { data, error } = await supabase.from('custom_dashboards').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dashboards: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { user_id?: string; name?: string; layout?: Record<string,unknown>; widgets?: unknown[]; is_default?: boolean }
  const { user_id, name, layout, widgets, is_default } = body
  if (!user_id || !name) return NextResponse.json({ error: 'user_id and name required' }, { status: 400 })
  const { data, error } = await supabase.from('custom_dashboards').insert({
    user_id, name, layout: layout ?? {}, widgets: widgets ?? [], is_default: is_default ?? false,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dashboard: data })
}

export async function PUT(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { id?: string; user_id?: string; name?: string; layout?: Record<string,unknown>; widgets?: unknown[] }
  const { id, user_id, name, layout, widgets } = body
  if (!id || !user_id) return NextResponse.json({ error: 'id and user_id required' }, { status: 400 })
  const patch: Record<string,unknown> = { updated_at: new Date().toISOString() }
  if (name) patch.name = name
  if (layout) patch.layout = layout
  if (widgets) patch.widgets = widgets
  await supabase.from('custom_dashboards').update(patch).eq('id', id).eq('user_id', user_id)
  return NextResponse.json({ updated: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const userId = url.searchParams.get('user_id')
  if (!id || !userId) return NextResponse.json({ error: 'id and user_id required' }, { status: 400 })
  await supabase.from('custom_dashboards').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ deleted: true })
}
