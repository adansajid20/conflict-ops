import { generateSummary } from '@/lib/event-presentation'

export interface ExtractedIntelligence {
  summary: string
  entities: {
    actors: string[]
    locations: string[]
    weapons: string[]
    casualties?: string
  }
  significance: number
  escalation_indicator: boolean
  related_conflicts: string[]
  tags: string[]
}

type EventForAnalysis = {
  id: string
  title: string
  source: string
  description: string | null
  event_type: string | null
  severity: number | null
  region?: string | null
  country_code?: string | null
  provenance_raw?: Record<string, unknown> | null
}

type SupabaseRuntime = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> }
  }
}

function asSupabaseRuntime(client: unknown): SupabaseRuntime {
  return client as SupabaseRuntime
}

function fallbackIntelligence(event: EventForAnalysis): ExtractedIntelligence {
  return {
    summary: generateSummary(event),
    entities: { actors: [], locations: [event.region ?? event.country_code ?? ''].filter(Boolean), weapons: [] },
    significance: Math.min(80, Math.max(0, (event.severity ?? 1) * 20)),
    escalation_indicator: (event.severity ?? 1) >= 3,
    related_conflicts: [],
    tags: [event.event_type ?? 'news'].filter(Boolean),
  }
}

async function extractEntities(event: EventForAnalysis): Promise<ExtractedIntelligence> {
  if (!process.env['OPENAI_API_KEY']) return fallbackIntelligence(event)

  const prompt = `You are an intelligence analyst. Return ONLY valid JSON.
Schema:
{
  "summary": "2-3 sentence analyst brief",
  "entities": {
    "actors": ["actor"],
    "locations": ["location"],
    "weapons": ["weapon"],
    "casualties": "optional casualties string"
  },
  "significance": 0,
  "escalation_indicator": false,
  "related_conflicts": ["conflict"],
  "tags": ["tag"]
}

Event title: ${event.title}
Source: ${event.source}
Type: ${event.event_type ?? 'unknown'}
Description: ${event.description ?? ''}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env['OPENAI_API_KEY']}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
      }),
    })

    if (!response.ok) throw new Error(`OpenAI analyze failed: ${response.status}`)
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = json.choices?.[0]?.message?.content
    if (!content) return fallbackIntelligence(event)
    const parsed = JSON.parse(content) as ExtractedIntelligence
    return {
      summary: parsed.summary,
      entities: {
        actors: Array.isArray(parsed.entities?.actors) ? parsed.entities.actors : [],
        locations: Array.isArray(parsed.entities?.locations) ? parsed.entities.locations : [],
        weapons: Array.isArray(parsed.entities?.weapons) ? parsed.entities.weapons : [],
        casualties: parsed.entities?.casualties,
      },
      significance: Math.min(100, Math.max(0, Number(parsed.significance ?? 0))),
      escalation_indicator: Boolean(parsed.escalation_indicator),
      related_conflicts: Array.isArray(parsed.related_conflicts) ? parsed.related_conflicts : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    }
  } catch {
    return fallbackIntelligence(event)
  }
}

export async function extractEntitiesBatch(client: unknown, events: EventForAnalysis[]): Promise<{ analyzed: number; skipped: number }> {
  const supabase = asSupabaseRuntime(client)
  let analyzed = 0
  let skipped = 0

  for (const event of events.slice(0, 10)) {
    const intelligence = await extractEntities(event)
    const { error } = await supabase.from('events').update({
      intelligence_summary: intelligence.summary,
      entities: intelligence.entities,
      escalation_indicator: intelligence.escalation_indicator,
      analyzed_at: new Date().toISOString(),
      significance_score: intelligence.significance,
    }).eq('id', event.id)

    if (error) skipped++
    else analyzed++
  }

  return { analyzed, skipped }
}
