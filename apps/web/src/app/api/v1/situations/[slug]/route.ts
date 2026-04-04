export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const supabase = createServiceClient()
  const { slug } = params

  const { data: situation, error } = await supabase
    .from('situations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !situation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch recent events for this situation
  const keywords = situation.countries ?? []
  let events: unknown[] = []
  if (keywords.length) {
    const orFilter = keywords.map((c: string) => `title.ilike.%${c}%`).join(',')
    const { data } = await supabase
      .from('events')
      .select('id,title,severity,region,occurred_at,source,event_type,escalation_signal,outlet_name')
      .or(orFilter)
      .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('occurred_at', { ascending: false })
      .limit(50)
    events = data ?? []
  }

  // Fetch actors mentioned
  const { data: actors } = await supabase
    .from('actors')
    .select('id,name,actor_type,threat_level,country,alignment')
    .contains('aliases', situation.countries ?? [])
    .limit(10)

  return NextResponse.json({ success: true, data: { situation, events, actors: actors ?? [] } })
}
