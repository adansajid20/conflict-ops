export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()

  const { data: predictions } = await supabase.from('predictions').select('*').is('outcome', null).order('created_at', { ascending: true }).limit(50)
  let evaluated = 0

  for (const pred of predictions ?? []) {
    // Expired
    if (new Date(pred.expires_at) < new Date()) {
      await supabase.from('predictions').update({ outcome: 'expired', outcome_at: new Date().toISOString() }).eq('id', pred.id)
      evaluated++
      continue
    }

    // Check confirming events
    const { data: confirmingEvents } = await supabase
      .from('events')
      .select('id, title, severity')
      .ilike('region', `%${pred.region}%`)
      .gte('occurred_at', pred.created_at)
      .gte('severity', 3)
      .limit(5)

    if (confirmingEvents && confirmingEvents.length >= 2) {
      const matchesType = confirmingEvents.some(e => {
        const lower = (e.title ?? '').toLowerCase()
        if (pred.prediction_type === 'attack') return lower.includes('strike') || lower.includes('attack') || lower.includes('offensive')
        if (pred.prediction_type === 'escalation') return lower.includes('escalat') || lower.includes('intensif')
        if (pred.prediction_type === 'humanitarian') return lower.includes('humanitarian') || lower.includes('refugee') || lower.includes('casualt')
        return false
      })
      if (matchesType) {
        const confirmEvent = confirmingEvents[0] as { id: string } | undefined
        await supabase.from('predictions').update({ outcome: 'confirmed', outcome_event_id: confirmEvent?.id ?? null, outcome_at: new Date().toISOString() }).eq('id', pred.id)
        evaluated++
        continue
      }
    }

    // Confidence decay
    const hoursOld = (Date.now() - new Date(pred.created_at).getTime()) / 3600000
    const decayed = pred.probability * Math.exp(-pred.confidence_decay_rate * hoursOld / 24)
    if (decayed < 0.15) {
      await supabase.from('predictions').update({ outcome: 'expired', outcome_at: new Date().toISOString() }).eq('id', pred.id)
      evaluated++
    }
  }

  return NextResponse.json({ evaluated })
}
