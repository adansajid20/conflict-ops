/**
 * Heavy Lane Processor
 * Runs every 30 minutes via Inngest
 * Budget: max 50 GPT-4o calls per run (hard limit)
 * Processes: raw events → extraction → embedding → clustering → anomaly
 */

import { createServiceClient } from '@/lib/supabase/server'
import { extractEvent, getEmbedding } from '@/lib/ai/gemini'

const HEAVY_LANE_BATCH_SIZE = 50
const CLUSTER_COSINE_THRESHOLD = 0.82

export type HeavyLaneResult = {
  processed: number
  extracted: number
  embedded: number
  clustered: number
  errors: number
  skipped: number
}

/**
 * Process unprocessed events through the heavy lane
 * Enforces hard budget of 50 GPT-4o calls
 */
export async function runHeavyLane(): Promise<HeavyLaneResult> {
  const result: HeavyLaneResult = {
    processed: 0,
    extracted: 0,
    embedded: 0,
    clustered: 0,
    errors: 0,
    skipped: 0,
  }

  const supabase = createServiceClient()

  // Fetch unprocessed events (oldest first, max batch size)
  const { data: events, error } = await supabase
    .from('events')
    .select('id, source, title, description, description_original, country_code, severity, raw')
    .eq('heavy_lane_processed', false)
    .is('embedding', null)
    .order('ingested_at', { ascending: true })
    .limit(HEAVY_LANE_BATCH_SIZE)

  if (error || !events) {
    result.errors++
    return result
  }

  for (const event of events) {
    result.processed++

    try {
      const textToProcess = event.description_original ?? event.description ?? event.title ?? ''
      const isHighPriority = (event.severity ?? 1) >= 4

      // Step 1: Extract structured data (GPT-4o for high severity, mini for rest)
      let updatedFields: Record<string, unknown> = {}

      if (textToProcess.length > 50) {
        const extracted = await extractEvent(textToProcess, event.source, isHighPriority)

        if (extracted) {
          result.extracted++
          updatedFields = {
            event_type: extracted.event_type,
            severity: extracted.severity,
            country_code: extracted.country_code ?? event.country_code,
            description: extracted.summary,
            provenance_inferred: {
              extracted_by: isHighPriority ? 'gemini-2.0-flash' : 'gemini-2.0-flash',
              extracted_at: new Date().toISOString(),
              location_name: extracted.location_name,
              actor_names: extracted.actor_names,
            },
          }

          // Update location if extracted
          if (extracted.lat && extracted.lng) {
            updatedFields['location'] = `POINT(${extracted.lng} ${extracted.lat})`
          }
        }
      }

      // Step 2: Generate embedding
      const textForEmbedding = [
        event.title,
        updatedFields['description'] ?? event.description,
        event.country_code,
      ]
        .filter(Boolean)
        .join(' ')

      const embeddingResult = await getEmbedding(textForEmbedding)
      if (embeddingResult?.embedding) {
        result.embedded++
        updatedFields['embedding'] = JSON.stringify(embeddingResult.embedding)
      }

      // Step 3: Check for duplicate cluster (cosine similarity via pgvector)
      if (embeddingResult?.embedding) {
        const { data: similar } = await supabase.rpc('find_similar_events', {
          query_embedding: JSON.stringify(embeddingResult.embedding),
          similarity_threshold: CLUSTER_COSINE_THRESHOLD,
          max_results: 3,
          hours_window: 72,
          exclude_id: event.id,
        })

        if (similar && similar.length > 0) {
          result.clustered++
          updatedFields['status'] = 'clustered'
        }
      }

      // Step 4: Mark as processed
      updatedFields['heavy_lane_processed'] = true
      updatedFields['heavy_lane_at'] = new Date().toISOString()

      if (!updatedFields['status']) {
        updatedFields['status'] = 'pending'
      }

      await supabase
        .from('events')
        .update(updatedFields)
        .eq('id', event.id)
    } catch (err) {
      console.error(`[heavy-lane] error processing event ${event.id}:`, err)
      result.errors++

      // Mark as processed anyway to avoid infinite retry
      await supabase
        .from('events')
        .update({ heavy_lane_processed: true, heavy_lane_at: new Date().toISOString() })
        .eq('id', event.id)
    }
  }

  return result
}
