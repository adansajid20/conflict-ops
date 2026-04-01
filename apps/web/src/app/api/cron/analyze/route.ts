import { createServiceClient } from '@/lib/supabase/server'
import { extractEntitiesBatch } from '@/lib/intelligence/entity-extraction'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type AnalyzeEventRow = {
  id: string
  title: string
  source: string
  description: string | null
  event_type: string | null
  severity: number | null
  region: string | null
  country_code: string | null
  provenance_raw: Record<string, unknown> | null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  const validSecret = process.env['INTERNAL_SECRET'] ?? ''

  if (!token || token !== validSecret) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('events')
    .select('id,title,source,description,event_type,severity,region,country_code,provenance_raw')
    .is('analyzed_at', null)
    .order('significance_score', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }

  let analyzed = 0
  let skipped = 0
  const events = (data ?? []) as AnalyzeEventRow[]
  for (let index = 0; index < events.length; index += 10) {
    const batch = events.slice(index, index + 10)
    const result = await extractEntitiesBatch(supabase, batch)
    analyzed += result.analyzed
    skipped += result.skipped
  }

  return Response.json({ success: true, data: { analyzed, skipped } })
}
