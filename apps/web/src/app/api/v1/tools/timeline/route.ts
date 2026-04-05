export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })

  const body = await req.json() as { cluster_id?: string; event_ids?: string[] }
  const { cluster_id, event_ids } = body
  if (!cluster_id && !event_ids?.length) return NextResponse.json({ error: 'cluster_id or event_ids required' }, { status: 400 })

  let events: Array<Record<string, unknown>> = []

  if (cluster_id) {
    const { data: cluster } = await supabase.from('event_clusters').select('*').eq('id', cluster_id).single()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    const ids = cluster.event_ids as string[] ?? []
    const { data } = await supabase.from('events').select('id,title,severity,region,occurred_at,summary,source,category').in('id', ids.slice(0, 50)).order('occurred_at', { ascending: true })
    events = data ?? []
  } else if (event_ids?.length) {
    const { data } = await supabase.from('events').select('id,title,severity,region,occurred_at,summary,source,category').in('id', event_ids.slice(0, 50)).order('occurred_at', { ascending: true })
    events = data ?? []
  }

  if (!events.length) return NextResponse.json({ error: 'No events found' }, { status: 404 })

  const eventsJson = events.map(e => ({
    id: e.id, title: e.title, severity: e.severity, occurred_at: e.occurred_at, summary: e.summary?.toString().slice(0, 100),
  }))

  const prompt = `You are an intelligence analyst. Reconstruct a timeline of this conflict situation from the following events.

EVENTS (chronological):
${JSON.stringify(eventsJson, null, 2)}

Respond with ONLY valid JSON:
{
  "title": "Brief situation title",
  "entries": [
    {
      "event_id": "...",
      "timestamp": "ISO date",
      "title": "Concise event title",
      "severity": 1-4,
      "description": "1-2 sentence analysis",
      "is_turning_point": false
    }
  ],
  "turning_points": [
    {"timestamp": "ISO date", "description": "Why this was a turning point", "significance": "high|medium"}
  ],
  "ai_narrative": "2-3 paragraph narrative of how this situation developed"
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
    if (!jsonMatch) return NextResponse.json({ error: 'AI parse error' }, { status: 500 })
    const timeline = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Save
    const { data: saved } = await supabase.from('situation_timelines').insert({
      cluster_id: cluster_id ?? null,
      title: timeline.title,
      entries: timeline.entries ?? [],
      turning_points: timeline.turning_points ?? [],
      ai_narrative: timeline.ai_narrative,
    }).select('id').single()

    return NextResponse.json({ ...timeline, id: saved?.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
