export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

// Fetch OFAC SDN list (free XML from US Treasury)
async function fetchOFACSample(): Promise<Array<{ name: string; type: string; country: string; program: string }>> {
  try {
    const res = await fetch('https://www.treasury.gov/ofac/downloads/sdn.csv', {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'ConflictRadar/1.0' },
    })
    if (!res.ok) return []
    const text = await res.text()
    const lines = text.split('\n').slice(0, 500) // Sample first 500 for quota
    const entities = []
    for (const line of lines) {
      if (!line.trim() || line.startsWith('"UID"')) continue
      const cols = line.split(',').map(s => s.replace(/^"|"$/g, '').trim())
      const name = cols[1] ?? ''
      const type = (cols[2] ?? '').toLowerCase()
      const program = cols[3] ?? ''
      const country = cols[6] ?? ''
      if (name && name.length > 2) {
        entities.push({ name, type: type || 'individual', country, program })
      }
    }
    return entities
  } catch {
    return []
  }
}

// Fuzzy name matching (simple trigram-style score)
function nameSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9 ]/g, '')
  const nb = b.toLowerCase().replace(/[^a-z0-9 ]/g, '')
  if (na === nb) return 1.0
  if (na.includes(nb) || nb.includes(na)) return 0.9
  // Word overlap
  const wa = new Set(na.split(' '))
  const wb = new Set(nb.split(' '))
  const intersection = [...wa].filter(w => wb.has(w) && w.length > 2).length
  return Math.min(0.85, intersection / Math.max(wa.size, wb.size, 1))
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  let synced = 0
  let matched = 0

  // Sync OFAC sample
  const ofacEntities = await fetchOFACSample()
  for (const entity of ofacEntities.slice(0, 200)) {
    const { error } = await supabase.from('sanctions_entities').upsert({
      list_source: 'OFAC_SDN',
      entity_name: entity.name,
      entity_type: entity.type,
      country: entity.country,
      program: entity.program,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'list_source,entity_name', ignoreDuplicates: false })
    if (!error) synced++
  }

  // Run matching against actors table
  const { data: sanctionedEntities } = await supabase.from('sanctions_entities').select('id,entity_name,entity_type').limit(100)
  const { data: actors } = await supabase.from('actors').select('id,name,aliases').limit(200)

  for (const entity of sanctionedEntities ?? []) {
    for (const actor of actors ?? []) {
      const names = [actor.name, ...(actor.aliases ?? [])] as string[]
      for (const name of names) {
        const score = nameSimilarity(entity.entity_name as string, name)
        if (score >= 0.8) {
          // Check not already recorded
          const { data: existing } = await supabase.from('sanctions_matches')
            .select('id').eq('sanctions_entity_id', entity.id).eq('matched_entity_id', actor.id).limit(1).single()
          if (!existing) {
            await supabase.from('sanctions_matches').insert({
              sanctions_entity_id: entity.id,
              matched_entity_type: 'actor',
              matched_entity_id: actor.id as string,
              match_confidence: score,
              match_reason: score === 1.0 ? 'exact_name' : score >= 0.9 ? 'partial_name' : `fuzzy_${Math.round(score * 100)}pct`,
            })
            matched++
          }
          break
        }
      }
    }
  }

  return NextResponse.json({ synced, matched })
}
