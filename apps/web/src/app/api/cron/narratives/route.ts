export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const CRON_SECRET = process.env.INTERNAL_SECRET ?? ''

// Group events by title similarity — finds same story across multiple outlets
function slugify(title: string): string {
  return title.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 6) // first 6 words as fingerprint
    .join('-')
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (token !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  // Fetch recent events with titles
  const { data: events } = await supabase
    .from('events')
    .select('id,title,source,outlet_name,occurred_at,region,severity')
    .gte('ingested_at', since6h)
    .not('title', 'is', null)
    .limit(500)

  if (!events?.length) return NextResponse.json({ clusters_created: 0 })

  // Group by title fingerprint
  const groups: Record<string, typeof events> = {}
  for (const event of events) {
    const key = slugify(event.title ?? '')
    if (!groups[key]) groups[key] = []
    groups[key].push(event)
  }

  let clusters_created = 0

  for (const [, group] of Object.entries(groups)) {
    if (group.length < 3) continue // Only flag if 3+ outlets cover it

    const sources = [...new Set(group.map(e => e.outlet_name ?? e.source))].filter(Boolean)
    if (sources.length < 2) continue // Must be from multiple outlets

    const canonical = group[0]
    if (!canonical) continue
    const velocity = group.length / 6 // events per hour in 6h window

    // Check if we already have this cluster
    const { data: existing } = await supabase
      .from('narrative_clusters')
      .select('id,amplification_count')
      .ilike('title', `%${(canonical.title ?? '').slice(0, 50)}%`)
      .gte('first_seen_at', since6h)
      .limit(1)

    if (existing?.length) {
      await supabase.from('narrative_clusters')
        .update({
          amplification_count: group.length,
          velocity,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing[0]!.id)
    } else {
      await supabase.from('narrative_clusters').insert({
        title: (canonical.title ?? '').slice(0, 200),
        narrative_type: 'factual',
        origin_source: canonical.outlet_name ?? canonical.source,
        amplification_count: group.length,
        velocity,
        first_seen_at: canonical.occurred_at ?? new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      clusters_created++
    }
  }

  return NextResponse.json({ success: true, clusters_created, groups_analyzed: Object.keys(groups).length })
}
