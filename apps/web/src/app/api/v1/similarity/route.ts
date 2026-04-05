export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json() as { data?: Array<{ embedding: number[] }> }
  return data.data?.[0]?.embedding ?? []
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json() as { query?: string; mode?: string; limit?: number; threshold?: number }
  const { query, mode = 'events', limit = 10, threshold = 0.3 } = body

  if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    // Fallback: keyword search when no embeddings available
    if (mode === 'events') {
      const { data } = await supabase.from('events').select('id,title,region,severity,occurred_at,summary').ilike('title', `%${query}%`).order('occurred_at', { ascending: false }).limit(limit)
      return NextResponse.json({ events: (data ?? []).map(e => ({ ...e, similarity: 0.5 })), patterns: [], fallback: true })
    } else {
      const { data } = await supabase.from('historical_patterns').select('id,name,description,pattern_type,historical_date').ilike('description', `%${query}%`).limit(limit)
      return NextResponse.json({ events: [], patterns: (data ?? []).map(p => ({ ...p, similarity: 0.5 })), fallback: true })
    }
  }

  const embedding = await getEmbedding(query, openaiKey)
  if (!embedding.length) return NextResponse.json({ error: 'Embedding generation failed' }, { status: 500 })

  if (mode === 'events') {
    const { data, error } = await supabase.rpc('match_events', {
      query_embedding: JSON.stringify(embedding),
      match_threshold: threshold,
      match_count: limit,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ events: data ?? [], patterns: [] })
  } else {
    const { data, error } = await supabase.rpc('match_patterns', {
      query_embedding: JSON.stringify(embedding),
      match_threshold: threshold,
      match_count: limit,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ events: [], patterns: data ?? [] })
  }
}
