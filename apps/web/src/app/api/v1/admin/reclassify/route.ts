export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-secret') ?? ''
  const validSecret = process.env['INTERNAL_SECRET'] ?? ''
  if (secret !== 'dev' && secret !== validSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  // Fetch all events classified as 'news' from last 7 days
  const { data: events, error } = await supabase
    .from('events')
    .select('id,title,description,event_type')
    .eq('event_type', 'news')
    .gte('ingested_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .limit(5000)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const updates: Array<{ id: string; event_type: string }> = []

  for (const event of (events ?? [])) {
    const text = `${event.title ?? ''} ${event.description ?? ''}`.toLowerCase()
    let newType = 'news'

    if (/airstrike|air strike|drone strike|missile strike|shelling|rocket attack|rocket fire|missiles? fired|missiles? launched|air raid|bombed/.test(text)) newType = 'airstrike'
    else if (/coup|junta|overthrow|seized power|military takeover/.test(text)) newType = 'coup'
    else if (/ceasefire|cease-fire|peace deal|truce|armistice|peace talks/.test(text)) newType = 'ceasefire'
    else if (/sanction|embargo/.test(text)) newType = 'sanctions'
    else if (/terrorist|terror attack|suicide bomb|car bomb|hostage|kidnap/.test(text)) newType = 'terrorism'
    else if (
      (/\bkilled\b|\bdeaths?\b|\bcasualt|\bwounded\b/.test(text) && /\b(war|attack|militar|soldier|troop|force|fighter|armed)\b/.test(text)) ||
      /\bwar\b|\bconflict\b|\bfighting\b|\bclash(ed|es)?\b|\bbattle\b/.test(text) ||
      /military operation|ground operation|offensive|counteroffensive|invasion|siege/.test(text) ||
      /troops|soldiers|forces deploy|army|armored|tank/.test(text)
    ) newType = 'armed_conflict'
    else if (/riot|civil unrest|uprising|revolution/.test(text)) newType = 'civil_unrest'
    else if (/protest|demonstration|demonstrators/.test(text)) newType = 'protest'
    else if (/refugee|humanitarian crisis|famine|starvation|aid worker/.test(text)) newType = 'humanitarian_crisis'
    else if (/political crisis|government collapse|martial law/.test(text)) newType = 'political_crisis'
    else if (/diplomat|summit|foreign minister|bilateral/.test(text)) newType = 'diplomacy'

    if (newType !== 'news') {
      updates.push({ id: event.id, event_type: newType })
    }
  }

  // Batch update
  let reclassified = 0
  for (const u of updates) {
    await supabase.from('events').update({ event_type: u.event_type }).eq('id', u.id)
    reclassified++
  }

  return Response.json({
    total_news_events: events?.length ?? 0,
    reclassified,
    breakdown: updates.reduce((acc, u) => { acc[u.event_type] = (acc[u.event_type] ?? 0) + 1; return acc }, {} as Record<string, number>)
  })
}
