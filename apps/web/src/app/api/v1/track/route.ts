export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { interaction_type?: string; event_id?: string; region?: string; category?: string; actor_id?: string; user_id?: string; metadata?: Record<string,unknown> }
    const { interaction_type, event_id, region, category, actor_id, user_id, metadata } = body

    if (!interaction_type) return NextResponse.json({ error: 'interaction_type required' }, { status: 400 })

    const supabase = createServiceClient()
    await supabase.from('user_interactions').insert({
      user_id: user_id ?? 'anonymous',
      interaction_type,
      event_id: event_id ?? null,
      region: region ?? null,
      category: category ?? null,
      actor_id: actor_id ?? null,
      metadata: metadata ?? {},
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
