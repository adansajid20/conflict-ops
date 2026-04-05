export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const url = new URL(req.url)
  const userId = url.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const [{ data: nodes }, { data: alerts }] = await Promise.all([
    supabase.from('supply_chain_nodes').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('supply_chain_alerts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
  ])

  // Enrich nodes with risk scores
  const enriched = await Promise.all((nodes ?? []).map(async node => {
    const country = (node.country ?? '') as string
    const { data: risk } = await supabase.from('country_profiles').select('risk_score,travel_advisory,conflict_intensity').ilike('country_name', `%${country}%`).limit(1).single()
    return { ...node, risk_score: (risk?.risk_score as number) ?? null, travel_advisory: risk?.travel_advisory ?? null }
  }))

  return NextResponse.json({ nodes: enriched, alerts: alerts ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { user_id?: string; node_name?: string; node_type?: string; country?: string; region?: string; latitude?: number; longitude?: number; criticality?: string; notes?: string }
  const { user_id, node_name, node_type } = body
  if (!user_id || !node_name || !node_type) return NextResponse.json({ error: 'user_id, node_name, node_type required' }, { status: 400 })
  const { data, error } = await supabase.from('supply_chain_nodes').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ node: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServiceClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await supabase.from('supply_chain_nodes').delete().eq('id', id)
  return NextResponse.json({ deleted: true })
}
