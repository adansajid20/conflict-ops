export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

function sevToInt(s: string): number {
  switch (s) { case 'critical': return 4; case 'high': return 3; case 'medium': return 2; default: return 1 }
}

function calcEscalationScore(analysis: Record<string, unknown>): number {
  let score = 0
  const sevMap: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  score += sevMap[analysis.severity as string] ?? 1
  if (analysis.is_precursor) score += 2
  const indicators = (analysis.escalation_indicators as string[]) ?? []
  score += indicators.length * 0.5
  const highEsc = ['nuclear', 'chemical', 'invasion', 'mobilization', 'declaration of war']
  for (const ind of indicators) {
    if (highEsc.some(h => ind.toLowerCase().includes(h))) score += 2
  }
  return Math.min(score, 10)
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ enriched: 0, disabled: true, reason: 'No ANTHROPIC_API_KEY' })

  const supabase = createServiceClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, title, description, source, source_id, region, severity')
    .eq('enriched', false)
    .order('occurred_at', { ascending: false })
    .limit(15)

  if (!events?.length) return NextResponse.json({ enriched: 0 })

  let enriched = 0

  for (const event of events) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `Analyze this geopolitical event. Return ONLY valid JSON.

Title: ${event.title}
Description: ${(event.description as string | null)?.slice(0, 500) ?? 'N/A'}
Source: ${event.source}
Region: ${event.region ?? 'Unknown'}

Return exactly this JSON:
{
  "severity": "critical|high|medium|low",
  "category": "conflict|military|political|diplomatic|humanitarian|economic|maritime|cyber|environmental",
  "subcategory": "specific subcategory",
  "location_name": "most specific location",
  "summary": "2-3 sentence intelligence summary focusing on significance and implications",
  "actors": [{"name": "Actor Name", "type": "state|non_state|leader|organization|military|corporation", "role": "subject|target|participant|mentioned"}],
  "escalation_indicators": ["list escalation signals"],
  "is_precursor": false,
  "precursor_type": null
}

Severity guide: critical=active combat/WMD/mass casualties, high=military mobilization/major strikes/sanctions, medium=tensions/protests/minor clashes, low=statements/meetings.`
          }]
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) continue
      const data = await res.json() as { content: Array<{ type: string; text: string }> }
      const text = data.content[0]?.type === 'text' ? data.content[0].text : ''
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) continue

      const analysis = JSON.parse(match[0]) as Record<string, unknown>
      const sevStr = analysis.severity as string ?? 'low'

      await supabase.from('events').update({
        severity: sevToInt(sevStr),
        category: analysis.category ?? 'political',
        subcategory: analysis.subcategory ?? null,
        location_name: analysis.location_name ?? null,
        summary: analysis.summary ?? null,
        ai_analysis: text.slice(0, 5000),
        escalation_score: calcEscalationScore(analysis),
        is_precursor: analysis.is_precursor ?? false,
        precursor_type: analysis.precursor_type ?? null,
        enriched: true,
        enriched_at: new Date().toISOString(),
      }).eq('id', event.id)

      // Extract actors
      const actors = (analysis.actors as Array<{ name: string; type: string; role: string }>) ?? []
      for (const actor of actors.slice(0, 5)) {
        if (!actor.name?.trim()) continue
        const { data: existing } = await supabase.from('actors').select('id, event_count').eq('name', actor.name).single()
        let actorId: string
        if (existing) {
          actorId = existing.id
          await supabase.from('actors').update({ event_count: (existing.event_count ?? 0) + 1, last_seen: new Date().toISOString() }).eq('id', actorId)
        } else {
          const { data: newActor } = await supabase.from('actors').insert({
            name: actor.name, display_name: actor.name, type: actor.type ?? 'organization',
            country: event.region,
          }).select('id').single()
          actorId = newActor?.id ?? ''
        }
        if (actorId) {
          await supabase.from('actor_mentions').upsert({
            actor_id: actorId, event_id: event.id,
            mention_type: actor.role ?? 'mentioned', confidence: 0.85,
          }, { onConflict: 'actor_id,event_id', ignoreDuplicates: true })
        }
      }

      enriched++
    } catch (e) { console.warn(`Enrich ${event.id} error:`, e) }
  }

  return NextResponse.json({ enriched })
}
