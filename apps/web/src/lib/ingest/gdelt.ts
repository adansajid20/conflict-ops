import { createServiceClient } from '@/lib/supabase/server'
import { isBlocklisted } from './utils'
import { inferRegionFromTitle } from '../classification'
import { classifyEvent } from '../pipeline/classify'

const GDELT_LASTUPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt'

export type RawEvent = {
  title: string
  source_url: string
  external_id: string
  occurred_at: string
  source: 'gdelt'
  outlet_name: string | null
  location: string | null
  severity: 2 | 3 | 4
  event_type: 'conflict'
}

export type IngestResult = {
  fetched: number
  inserted: number
  duplicates: number
  errors: number
}

export async function fetchGDELTLatestBatch(): Promise<RawEvent[]> {
  const lastUpdateText = await fetch(GDELT_LASTUPDATE_URL, {
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'ConflictOps/1.0 (https://conflictradar.co)' },
  }).then((r) => r.text())

  const exportUrl = lastUpdateText.trim().split('\n')[0]?.split(' ')[1]
  if (!exportUrl) return []

  const resp = await fetch(exportUrl, {
    signal: AbortSignal.timeout(30000),
    headers: { 'User-Agent': 'ConflictOps/1.0 (https://conflictradar.co)' },
  })
  if (!resp.ok) return []

  const buffer = Buffer.from(await resp.arrayBuffer())
  const { gunzipSync } = await import('zlib')
  const csvText = gunzipSync(buffer).toString('utf-8')

  const rows = csvText.split('\n').slice(1).filter(Boolean)
  const events: RawEvent[] = []

  for (const row of rows) {
    const cols = row.split('\t')
    if (cols.length < 58) continue

    const goldstein = parseFloat(cols[26] ?? '0')
    const mentions = parseInt(cols[27] ?? '0', 10)
    const sourceUrl = cols[57]?.trim()
    const actor1 = cols[5]?.trim() || 'Unknown'
    const actor2 = cols[10]?.trim() || 'Event'
    const location = cols[53]?.trim() || null

    if (!sourceUrl) continue
    if (goldstein > -2) continue
    if (mentions < 3) continue

    const title = `${actor1} — ${actor2}${location ? ` in ${location}` : ''}`
    if (isBlocklisted(title, sourceUrl)) continue

    const dateStr = cols[1] ?? ''
    const occurredAt =
      dateStr.length === 8
        ? new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`).toISOString()
        : new Date().toISOString()

    events.push({
      title,
      source_url: sourceUrl,
      external_id: sourceUrl,
      occurred_at: occurredAt,
      source: 'gdelt',
      outlet_name: null,
      location,
      severity: goldstein < -6 ? 4 : goldstein < -4 ? 3 : 2,
      event_type: 'conflict',
    })

    if (events.length >= 50) break
  }

  return events
}

export async function ingestGDELT(): Promise<IngestResult> {
  const result: IngestResult = { fetched: 0, inserted: 0, duplicates: 0, errors: 0 }
  const supabase = createServiceClient()

  let events: RawEvent[] = []
  try {
    events = await fetchGDELTLatestBatch()
    result.fetched = events.length
  } catch (error) {
    console.error('[gdelt-ingest] fetch error:', error)
    result.errors += 1
    return result
  }

  for (const event of events) {
    // AI classify + region inference
    let severity: 1 | 2 | 3 | 4 = event.severity
    let escalation_signal = false
    let weapons_mentioned: string[] = []
    let casualty_estimate: number | null = null
    try {
      const classified = await classifyEvent(event.title, '')
      severity = classified.severity
      escalation_signal = classified.escalation_signal
      weapons_mentioned = classified.weapons_mentioned
      casualty_estimate = classified.casualty_estimate
    } catch { /* keep goldstein severity */ }

    const region = inferRegionFromTitle(event.title + (event.location ? ' ' + event.location : '')) ?? null

    const { error } = await supabase.from('events').upsert(
      {
        title: event.title.slice(0, 500),
        description: event.location ? `Location: ${event.location}` : null,
        source: 'gdelt',
        source_id: event.source_url,
        occurred_at: event.occurred_at,
        location: event.location,
        region,
        severity,
        escalation_signal,
        weapons_mentioned: weapons_mentioned.length ? weapons_mentioned : null,
        casualty_estimate,
        event_type: 'armed_conflict',
        external_id: event.external_id,
        status: 'pending',
        heavy_lane_processed: false,
        is_humanitarian_report: false,
        raw: { gdelt_outlet: event.outlet_name, batch: 'latest-15m' },
      },
      { onConflict: 'external_id', ignoreDuplicates: true }
    )

    if (error) {
      result.duplicates += 1
    } else {
      result.inserted += 1
    }
  }

  return result
}
