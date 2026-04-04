export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()

  const { data: actor, error } = await supabase
    .from('actors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !actor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Recent mentions
  const { data: mentions } = await supabase
    .from('actor_mentions')
    .select('*, events(id,title,severity,occurred_at,region,event_type)')
    .eq('actor_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ success: true, data: { actor, mentions: mentions ?? [] } })
}
