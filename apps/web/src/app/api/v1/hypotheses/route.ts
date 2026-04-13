import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

type ProbabilityPoint = { at: string; probability: number }
type HypothesisUpdateBody = { id?: string; probability?: number }

type HypothesisRow = {
  id: string
  probability: number | null
  probability_history: ProbabilityPoint[] | null
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<HypothesisRow>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as HypothesisUpdateBody | null
  if (!body?.id || typeof body.probability !== 'number') {
    return NextResponse.json({ success: false, error: 'id and probability are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: current, error } = await supabase
    .from('ach_hypotheses')
    .select('id, probability, probability_history')
    .eq('id', body.id)
    .single()

  if (error || !current) {
    return NextResponse.json({ success: false, error: error?.message ?? 'Hypothesis not found' }, { status: 404 })
  }

  const history = Array.isArray(current.probability_history) ? current.probability_history : []
  const nextHistory = [...history, { at: new Date().toISOString(), probability: body.probability }]

  const { data: updated, error: updateError } = await supabase
    .from('ach_hypotheses')
    .update({ probability: body.probability, probability_history: nextHistory, updated_at: new Date().toISOString() })
    .eq('id', body.id)
    .select('id, probability, probability_history')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ success: false, error: updateError?.message ?? 'Failed to update hypothesis' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: updated as HypothesisRow })
}
