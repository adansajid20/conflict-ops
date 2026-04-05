export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const [{ data: people }, { data: alerts }] = await Promise.all([
    supabase.from('team_locations').select('*').eq('org_user_id', userId).order('created_at', { ascending: false }),
    supabase.from('safety_alerts').select('*').eq('org_user_id', userId).eq('acknowledged', false).order('created_at', { ascending: false }).limit(20),
  ])

  return NextResponse.json({ people: people ?? [], alerts: alerts ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { org_user_id?: string; person_name?: string; person_email?: string; country?: string; city?: string; latitude?: number; longitude?: number; notes?: string }
  const { org_user_id, person_name, country } = body
  if (!org_user_id || !person_name || !country) return NextResponse.json({ error: 'org_user_id, person_name, country required' }, { status: 400 })
  const { data, error } = await supabase.from('team_locations').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ person: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { id?: string; status?: string; notes?: string; acknowledge_alert?: string }
  const { id, acknowledge_alert, ...patch } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if (acknowledge_alert) {
    await supabase.from('safety_alerts').update({ acknowledged: true }).eq('id', acknowledge_alert)
  }
  if (Object.keys(patch).length > 0) {
    await supabase.from('team_locations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  }
  return NextResponse.json({ updated: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServiceClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await supabase.from('team_locations').delete().eq('id', id)
  return NextResponse.json({ deleted: true })
}
