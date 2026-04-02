/**
 * OpenAI utilities for CONFLICTRADAR
 * Hard budget: max 50 GPT-4o calls per heavy lane run
 * Use GPT-4o-mini for low-priority extraction
 */

const OPENAI_API_BASE = 'https://api.openai.com/v1'

export type EventExtraction = {
  title: string
  event_type: string
  severity: 1 | 2 | 3 | 4 | 5
  location_name: string | null
  country_code: string | null
  lat: number | null
  lng: number | null
  actor_names: string[]
  occurred_at: string | null
  summary: string // max 150 chars
}

export type EmbeddingResponse = {
  embedding: number[]
  tokens_used: number
}

async function openaiRequest(path: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${OPENAI_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env['OPENAI_API_KEY']}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err}`)
  }

  return res.json()
}

/**
 * Extract structured event data from raw article text
 * Uses GPT-4o for high-severity sources, GPT-4o-mini for low-priority
 */
export async function extractEvent(
  rawText: string,
  source: string,
  useHeavyModel = false
): Promise<EventExtraction | null> {
  const model = useHeavyModel ? 'gpt-4o' : 'gpt-4o-mini'

  const prompt = `Extract structured geopolitical event data from this text. Return ONLY valid JSON matching the schema. If the text is not about a geopolitical event, return null.

Schema:
{
  "title": "concise event title (max 100 chars)",
  "event_type": "one of: conflict|political|economic|humanitarian|natural_disaster|cyber|other",
  "severity": "integer 1-5 (1=minor, 5=critical)",
  "location_name": "city/region name or null",
  "country_code": "ISO 3166-1 alpha-2 code or null",
  "lat": "decimal latitude or null",
  "lng": "decimal longitude or null",
  "actor_names": ["array of actor names mentioned"],
  "occurred_at": "ISO 8601 datetime or null",
  "summary": "neutral factual summary max 150 chars"
}

Source: ${source}
Text: ${rawText.substring(0, 2000)}`

  try {
    const response = await openaiRequest('/chat/completions', {
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0,
    }) as { choices: Array<{ message: { content: string } }> }

    const content = response.choices[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content) as EventExtraction | null
    return parsed
  } catch {
    return null
  }
}

/**
 * Generate embedding for text using text-embedding-3-small
 * Cheaper and fast enough for event clustering
 */
export async function getEmbedding(text: string): Promise<EmbeddingResponse | null> {
  try {
    const response = await openaiRequest('/embeddings', {
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000),
    }) as { data: Array<{ embedding: number[] }>; usage: { total_tokens: number } }

    return {
      embedding: response.data[0]?.embedding ?? [],
      tokens_used: response.usage?.total_tokens ?? 0,
    }
  } catch {
    return null
  }
}

/**
 * Generate AI brief for a mission or daily summary
 * Strict 300-word limit
 */
export async function generateBrief(
  context: string,
  briefType: 'sitrep' | 'daily' | 'country',
  maxWords = 300
): Promise<string> {
  const typeInstructions = {
    sitrep: 'Write a SITREP (Situation Report) in the style of a professional intelligence analyst.',
    daily: 'Write a concise daily intelligence brief suitable for an executive audience.',
    country: 'Write a country risk assessment brief for analysts and security professionals.',
  }

  const prompt = `${typeInstructions[briefType]} Maximum ${maxWords} words. Use factual, neutral language. No speculation beyond what the data supports.

Context data:
${context.substring(0, 4000)}`

  try {
    const response = await openaiRequest('/chat/completions', {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.3,
    }) as { choices: Array<{ message: { content: string } }> }

    return response.choices[0]?.message?.content ?? 'Brief generation failed — insufficient data.'
  } catch {
    return 'Brief generation temporarily unavailable.'
  }
}
