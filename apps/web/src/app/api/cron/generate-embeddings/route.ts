export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) return NextResponse.json({ embedded: 0, disabled: true, reason: 'No OPENAI_API_KEY' })

  const supabase = createServiceClient()

  const { data: events } = await supabase
    .from('events')
    .select('id, title, summary, category, region, severity')
    .eq('enriched', true)
    .is('embedding', null)
    .order('occurred_at', { ascending: false })
    .limit(50)

  if (!events?.length) return NextResponse.json({ embedded: 0 })

  const sevStr = (n: number | null) => { switch(n) { case 4: return 'CRITICAL'; case 3: return 'HIGH'; case 2: return 'MEDIUM'; default: return 'LOW' } }
  const texts = events.map(e => `${sevStr(e.severity)} ${e.category ?? ''}: ${e.title}. ${e.summary ?? ''} Region: ${e.region ?? 'Global'}`)

  let embedded = 0
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: texts, model: 'text-embedding-3-small' }),
      signal: AbortSignal.timeout(30000),
    })
    const data = await res.json() as { data?: Array<{ embedding: number[] }> }
    if (data.data) {
      for (let i = 0; i < data.data.length; i++) {
        const emb = data.data[i]
        if (!emb) continue
        await supabase.from('events').update({ embedding: JSON.stringify(emb.embedding) }).eq('id', events[i]?.id)
        embedded++
      }
    }
  } catch (e) { console.warn('Embedding error:', e) }

  // Also embed any historical patterns without embeddings
  const { data: patterns } = await supabase.from('historical_patterns').select('id, pattern_name, description, pattern_type').is('embedding', null).limit(10)
  for (const p of patterns ?? []) {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: `${p.pattern_type}: ${p.pattern_name}. ${p.description}`, model: 'text-embedding-3-small' }),
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json() as { data?: Array<{ embedding: number[] }> }
      if (data.data?.[0]) {
        await supabase.from('historical_patterns').update({ embedding: JSON.stringify(data.data[0].embedding) }).eq('id', p.id)
      }
    } catch { /* ok */ }
  }

  return NextResponse.json({ embedded })
}
