export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })

  const body = await req.json() as { trigger?: string; region?: string; user_id?: string }
  const { trigger, region, user_id } = body
  if (!trigger || !user_id) return NextResponse.json({ error: 'trigger and user_id required' }, { status: 400 })

  // Gather context for the simulation
  const h30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: events }, { data: riskScores }, { data: actors }, { data: patterns }, { data: commodities }] = await Promise.all([
    supabase.from('events').select('title,severity,region,occurred_at').gte('occurred_at', h30d).gte('severity', 2).ilike('region', region ? `%${region}%` : '%').order('occurred_at', { ascending: false }).limit(10),
    supabase.from('region_risk_scores').select('region,score').order('score', { ascending: false }).limit(10),
    supabase.from('actors').select('name,actor_type,region,threat_level').order('event_count', { ascending: false }).limit(10),
    supabase.from('historical_patterns').select('pattern_name,description,pattern_type').limit(5),
    supabase.from('commodity_prices').select('symbol,name,price,change_pct_24h').order('recorded_at', { ascending: false }).limit(20),
  ])

  // Deduplicate commodities
  const latestCommodities = [...new Map((commodities ?? []).map(c => [c.symbol, c])).values()]

  const contextJson = {
    trigger_event: trigger,
    trigger_region: region,
    recent_events: events?.slice(0, 8),
    risk_scores: riskScores?.slice(0, 5),
    key_actors: actors?.slice(0, 6),
    historical_patterns: patterns?.slice(0, 3),
    current_commodities: latestCommodities.slice(0, 6),
  }

  const prompt = `You are a geopolitical scenario analyst. Given the trigger event and current intelligence context, generate a comprehensive cascading effects analysis.

TRIGGER EVENT: "${trigger}"
TRIGGER REGION: ${region ?? 'Global'}

CURRENT INTELLIGENCE CONTEXT:
${JSON.stringify(contextJson, null, 2)}

Respond with ONLY valid JSON in this exact structure:
{
  "cascade_chain": [
    {"step": 1, "timeframe": "0-24 hours", "event": "...", "probability": 0.85, "actors_involved": ["..."]},
    {"step": 2, "timeframe": "24-72 hours", "event": "...", "probability": 0.65, "actors_involved": ["..."]},
    {"step": 3, "timeframe": "1-2 weeks", "event": "...", "probability": 0.45, "actors_involved": ["..."]},
    {"step": 4, "timeframe": "1-3 months", "event": "...", "probability": 0.30, "actors_involved": ["..."]}
  ],
  "affected_regions": ["Region1", "Region2"],
  "commodity_impacts": {
    "CL=F": {"change_pct": 15, "direction": "up", "reason": "..."},
    "GC=F": {"change_pct": 5, "direction": "up", "reason": "safe haven"}
  },
  "affected_actors": ["Actor1", "Actor2"],
  "probability": 0.55,
  "time_horizon": "1-3 months",
  "historical_parallels": [
    {"title": "2019 Strait of Hormuz tanker seizures", "similarity": 0.8, "description": "..."}
  ],
  "recommendations": ["...", "...", "..."],
  "ai_analysis": "A paragraph of strategic analysis..."
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const raw = data.content?.[0]?.text ?? ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI response parse error' }, { status: 500 })

    const scenario = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Save to DB
    const { data: saved } = await supabase.from('scenarios').insert({
      user_id,
      title: trigger.slice(0, 120),
      trigger_event: trigger,
      trigger_region: region,
      cascading_effects: scenario.cascade_chain ?? [],
      affected_regions: scenario.affected_regions ?? [],
      affected_commodities: scenario.commodity_impacts ?? {},
      affected_actors: scenario.affected_actors ?? [],
      probability: scenario.probability,
      time_horizon: scenario.time_horizon,
      historical_parallels: scenario.historical_parallels ?? [],
      ai_analysis: scenario.ai_analysis,
    }).select('id').single()

    return NextResponse.json({ ...scenario, id: saved?.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const userId = new URL(req.url).searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  const { data } = await supabase.from('scenarios').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  return NextResponse.json({ scenarios: data ?? [] })
}
