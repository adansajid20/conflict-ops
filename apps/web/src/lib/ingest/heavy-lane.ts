import { createServiceClient } from '@/lib/supabase/server'
import { extractEvent, getEmbedding } from '@/lib/ai/gemini'
import { translateEvent } from '@/lib/translation/translate'
import { deliverWebhook } from '@/lib/webhooks/deliver'
import { evaluateAlertRules } from '@/lib/alerts/rules-engine'
import { clusterEvent } from '@/lib/intelligence/clustering'
import { extractEntitiesBatch } from '@/lib/intelligence/entity-extraction'
import { weightedSignificance } from '@/lib/intelligence/source-tiers'

type HeavyLaneEvent = {
  id: string
  source: string
  title: string
  description: string | null
  description_original: string | null
  description_lang: string | null
  description_translated: string | null
  country_code: string | null
  severity: number | null
  raw: Record<string, unknown> | null
  event_type: string | null
  significance_score?: number | null
  analyzed_at?: string | null
}

const HEAVY_LANE_BATCH_SIZE = 50
const SIGNIFICANCE_BATCH_LIMIT = 20

export type HeavyLaneResult = {
  processed: number
  extracted: number
  embedded: number
  clustered: number
  analyzed: number
  significance_scored: number
  errors: number
  skipped: number
}

function extractSourceLabel(event: Pick<HeavyLaneEvent, 'source' | 'raw'>): string {
  const rawSource = event.raw && typeof event.raw === 'object' ? event.raw['source'] : null
  return typeof rawSource === 'string' && rawSource ? rawSource : event.source
}

async function scoreSignificance(event: Pick<HeavyLaneEvent, 'title' | 'event_type' | 'severity' | 'source' | 'raw'>): Promise<number> {
  if (!process.env['OPENAI_API_KEY']) {
    return Math.min(80, Math.max(0, (event.severity ?? 1) * 20))
  }

  const prompt = `Rate the geopolitical significance of this event on a scale of 0-100.
- 90-100: Major breaking event (airstrike, coup, mass casualty, declaration of war)
- 70-89: High impact (major diplomatic breakdown, large protest, significant sanctions)
- 50-69: Medium impact (ongoing conflict update, political tension, humanitarian alert)
- 30-49: Low impact (routine report, minor incident, background context)
- 0-29: Noise (press release, opinion, historical reference, not actionable)

Event: "${event.title}"
Source: ${extractSourceLabel(event)}
Type: ${event.event_type ?? 'unknown'}

Respond with ONLY a number between 0 and 100.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env['OPENAI_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 16,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI scoring failed: ${response.status}`)
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = json.choices?.[0]?.message?.content?.trim() ?? ''
    const parsed = Number.parseInt(content.replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(parsed)) {
      return Math.min(100, Math.max(0, parsed))
    }
  } catch {
    // fall through to deterministic fallback
  }

  return Math.min(80, Math.max(0, (event.severity ?? 1) * 20))
}

export async function runHeavyLane(): Promise<HeavyLaneResult> {
  const result: HeavyLaneResult = {
    processed: 0,
    extracted: 0,
    embedded: 0,
    clustered: 0,
    analyzed: 0,
    significance_scored: 0,
    errors: 0,
    skipped: 0,
  }

  const supabase = createServiceClient()
  const { data: events, error } = await supabase
    .from('events')
    .select('id, source, title, description, description_original, description_lang, description_translated, country_code, severity, raw, event_type, significance_score, analyzed_at')
    .eq('heavy_lane_processed', false)
    .is('embedding', null)
    .order('ingested_at', { ascending: true })
    .limit(HEAVY_LANE_BATCH_SIZE)

  if (error || !events) {
    result.errors++
    return result
  }

  const pendingForScoring: HeavyLaneEvent[] = []
  const pendingForAnalysis: HeavyLaneEvent[] = []

  for (const event of events as HeavyLaneEvent[]) {
    result.processed++

    try {
      await translateEvent({
        id: event.id,
        description: event.description,
        description_original: event.description_original,
        description_lang: event.description_lang,
        description_translated: event.description_translated,
      })

      const textToProcess = event.description_original ?? event.description ?? event.title
      const isHighPriority = (event.severity ?? 1) >= 4
      const updatedFields: Record<string, unknown> = {}

      if (textToProcess && textToProcess.length > 50) {
        const extracted = await extractEvent(textToProcess, event.source, isHighPriority)
        if (extracted) {
          result.extracted++
          updatedFields['event_type'] = extracted.event_type
          updatedFields['severity'] = extracted.severity
          updatedFields['country_code'] = extracted.country_code ?? event.country_code
          updatedFields['description'] = extracted.summary
          updatedFields['provenance_inferred'] = {
            extracted_by: 'gemini-2.0-flash',
            extracted_at: new Date().toISOString(),
            location_name: extracted.location_name,
            actor_names: extracted.actor_names,
          }
          if (extracted.lat && extracted.lng) {
            updatedFields['location'] = `POINT(${extracted.lng} ${extracted.lat})`
          }
        }
      }

      const textForEmbedding = [event.title, String(updatedFields['description'] ?? event.description ?? ''), event.country_code ?? ''].filter(Boolean).join(' ')
      const embeddingResult = await getEmbedding(textForEmbedding)
      if (embeddingResult?.embedding?.length) {
        result.embedded++
        updatedFields['embedding'] = JSON.stringify(embeddingResult.embedding)
      }

      updatedFields['heavy_lane_processed'] = true
      updatedFields['heavy_lane_at'] = new Date().toISOString()
      updatedFields['status'] = updatedFields['status'] ?? 'pending'

      await supabase.from('events').update(updatedFields).eq('id', event.id)

      if (embeddingResult?.embedding?.length) {
        const clustered = await clusterEvent(supabase, {
          id: event.id,
          title: event.title,
          source: extractSourceLabel(event),
          event_type: String(updatedFields['event_type'] ?? event.event_type ?? ''),
          country_code: event.country_code,
          severity: Number(updatedFields['severity'] ?? event.severity ?? 1),
          description: String(updatedFields['description'] ?? event.description ?? ''),
          significance_score: typeof event.significance_score === 'number' ? event.significance_score : null,
          embedding: embeddingResult.embedding,
        })
        if (clustered) result.clustered++
      }

      pendingForScoring.push({
        ...event,
        event_type: String(updatedFields['event_type'] ?? event.event_type ?? ''),
        severity: Number(updatedFields['severity'] ?? event.severity ?? 1),
      })

      if (!event.analyzed_at) {
        pendingForAnalysis.push({
          ...event,
          description: String(updatedFields['description'] ?? event.description ?? ''),
          event_type: String(updatedFields['event_type'] ?? event.event_type ?? ''),
          severity: Number(updatedFields['severity'] ?? event.severity ?? 1),
        })
      }

      const raw = event.raw
      const orgId = raw && typeof raw === 'object' && typeof raw['org_id'] === 'string' ? raw['org_id'] : ''
      if (orgId) {
        await evaluateAlertRules(orgId, [{
          id: event.id,
          title: event.title,
          description: String(updatedFields['description'] ?? event.description ?? ''),
          country_code: String(updatedFields['country_code'] ?? event.country_code ?? ''),
          event_type: String(updatedFields['event_type'] ?? event.event_type ?? ''),
          severity: Number(updatedFields['severity'] ?? event.severity ?? 0),
          region: raw && typeof raw['region'] === 'string' ? raw['region'] : '',
        }])
      }

      if (Number(updatedFields['severity'] ?? event.severity ?? 0) >= 4 && orgId) {
        await deliverWebhook(orgId, 'event.high_severity', { event_id: event.id, severity: updatedFields['severity'] ?? event.severity })
      }
    } catch (err) {
      console.error(`[heavy-lane] error processing event ${event.id}:`, err)
      result.errors++
      await supabase.from('events').update({ heavy_lane_processed: true, heavy_lane_at: new Date().toISOString() }).eq('id', event.id)
    }
  }

  for (const event of pendingForScoring.slice(0, SIGNIFICANCE_BATCH_LIMIT)) {
    const score = await scoreSignificance(event)
    const weighted = weightedSignificance(score, extractSourceLabel(event))
    const { error: updateError } = await supabase.from('events').update({ significance_score: weighted }).eq('id', event.id)
    if (!updateError) result.significance_scored++
  }

  if (pendingForAnalysis.length > 0) {
    const analysisResult = await extractEntitiesBatch(supabase, pendingForAnalysis.slice(0, 10))
    result.analyzed += analysisResult.analyzed
    result.skipped += analysisResult.skipped
  }

  return result
}
