export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })

  const body = await req.json() as { mode?: string; region_a?: string; region_b?: string; cluster_id?: string; pattern_id?: string }
  const { mode, region_a, region_b, cluster_id, pattern_id } = body
  const h30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const h7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let comparisonData: Record<string, unknown> = {}

  if (mode === 'region_vs_region' && region_a && region_b) {
    const [rA, rB, scoreA, scoreB, predA, predB] = await Promise.all([
      supabase.from('events').select('severity,category,occurred_at').gte('occurred_at', h30d).ilike('region', `%${region_a}%`).limit(200),
      supabase.from('events').select('severity,category,occurred_at').gte('occurred_at', h30d).ilike('region', `%${region_b}%`).limit(200),
      supabase.from('region_risk_scores').select('score,trend').ilike('region', `%${region_a}%`).limit(1).single(),
      supabase.from('region_risk_scores').select('score,trend').ilike('region', `%${region_b}%`).limit(1).single(),
      supabase.from('predictions').select('id,title,probability').gt('expires_at', new Date().toISOString()).is('outcome', null).ilike('region', `%${region_a}%`).limit(5),
      supabase.from('predictions').select('id,title,probability').gt('expires_at', new Date().toISOString()).is('outcome', null).ilike('region', `%${region_b}%`).limit(5),
    ])

    const calcMetrics = (evts: Array<{ severity?: number; category?: string; occurred_at?: string }>) => {
      const total = evts.length
      const critical = evts.filter(e => (e.severity ?? 0) >= 4).length
      const high = evts.filter(e => (e.severity ?? 0) === 3).length
      const avgSev = total > 0 ? evts.reduce((a, e) => a + ((e.severity ?? 1) as number), 0) / total : 0
      const recent7d = evts.filter(e => e.occurred_at && e.occurred_at > h7d).length
      return { total, critical, high, avgSev: Math.round(avgSev * 10) / 10, recent7d }
    }

    comparisonData = {
      mode: 'region_vs_region',
      region_a: { name: region_a, metrics: calcMetrics(rA.data ?? []), risk_score: scoreA.data?.score ?? 0, trend: scoreA.data?.trend, predictions: predA.data ?? [] },
      region_b: { name: region_b, metrics: calcMetrics(rB.data ?? []), risk_score: scoreB.data?.score ?? 0, trend: scoreB.data?.trend, predictions: predB.data ?? [] },
    }
  } else if (mode === 'current_vs_historical' && cluster_id) {
    const [{ data: cluster }, { data: patterns }] = await Promise.all([
      supabase.from('event_clusters').select('*').eq('id', cluster_id).single(),
      supabase.from('historical_patterns').select('*').limit(5),
    ])
    const pattern = pattern_id ? patterns?.find(p => p.id === pattern_id) : patterns?.[0]
    comparisonData = {
      mode: 'current_vs_historical',
      current: cluster,
      historical: pattern,
    }
  } else {
    return NextResponse.json({ error: 'Invalid mode or missing parameters' }, { status: 400 })
  }

  // Generate AI analysis
  const prompt = `You are a comparative intelligence analyst. Compare these two ${mode === 'region_vs_region' ? 'regions' : 'situations'} and provide a concise analysis.

DATA: ${JSON.stringify(comparisonData, null, 2)}

Respond with 3-4 sentences: which is more dangerous, which is deteriorating faster, and what analysts should watch.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json() as { content?: Array<{ text?: string }> }
    const analysis = data.content?.[0]?.text ?? ''
    return NextResponse.json({ ...comparisonData, ai_analysis: analysis })
  } catch {
    return NextResponse.json(comparisonData)
  }
}
