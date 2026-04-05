export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const userId = new URL(req.url).searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  const { data, error } = await supabase
    .from('analyst_conversations')
    .select('id,title,pinned,created_at,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ conversations: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  const userId = url.searchParams.get('user_id')
  if (!id || !userId) return NextResponse.json({ error: 'id and user_id required' }, { status: 400 })
  await supabase.from('analyst_conversations').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ deleted: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { id?: string; user_id?: string; pinned?: boolean; title?: string }
  const { id, user_id, pinned, title } = body
  if (!id || !user_id) return NextResponse.json({ error: 'id and user_id required' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  if (pinned !== undefined) patch.pinned = pinned
  if (title) patch.title = title
  await supabase.from('analyst_conversations').update(patch).eq('id', id).eq('user_id', user_id)
  return NextResponse.json({ updated: true })
}
