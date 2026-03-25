/**
 * Gemini AI utilities for CONFLICT OPS
 * Model: gemini-2.0-flash (fast, cheap, free tier: 1,500 req/day)
 * Hard budget: max 50 calls per heavy lane run
 * Drop-in replacement for openai.ts
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MODEL = 'gemini-2.0-flash'

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
  summary: string
}

export type EmbeddingResponse = {
  embedding: number[]
  tokens_used: number
}

async function geminiGenerate(prompt: string, jsonMode = false): Promise<string | null> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: jsonMode ? 0 : 0.3,
      maxOutputTokens: jsonMode ? 600 : 800,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
}

async function geminiEmbed(text: string): Promise<number[] | null> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) return null

  const res = await fetch(
    `${GEMINI_API_BASE}/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text: text.substring(0, 8000) }] },
      }),
      signal: AbortSignal.timeout(15000),
    }
  )

  if (!res.ok) return null
  const data = await res.json() as { embedding?: { values?: number[] } }
  return data.embedding?.values ?? null
}

/**
 * Extract structured event data from raw article text
 */
export async function extractEvent(
  rawText: string,
  source: string,
  _useHeavyModel = false // kept for API compat — Gemini Flash handles all tiers
): Promise<EventExtraction | null> {
  const prompt = `Extract structured geopolitical event data from this text. Return ONLY valid JSON matching the schema exactly. If the text is not about a geopolitical event, return {"null":true}.

Schema:
{
  "title": "concise event title (max 100 chars)",
  "event_type": "one of: conflict|political|economic|humanitarian|natural_disaster|cyber|other",
  "severity": integer 1-5 where 1=minor local incident and 5=mass casualty/state collapse,
  "location_name": "city/region name or null",
  "country_code": "ISO 3166-1 alpha-2 code or null",
  "lat": decimal latitude or null,
  "lng": decimal longitude or null,
  "actor_names": ["array of actor/group names mentioned"],
  "occurred_at": "ISO 8601 datetime or null",
  "summary": "neutral factual summary max 150 chars"
}

Source: ${source}
Text: ${rawText.substring(0, 2000)}`

  try {
    const content = await geminiGenerate(prompt, true)
    if (!content) return null

    const parsed = JSON.parse(content) as EventExtraction & { null?: boolean }
    if (parsed.null) return null

    return parsed
  } catch {
    return null
  }
}

/**
 * Generate embedding using Gemini text-embedding-004 (768-dim)
 * NOTE: Supabase vector column is 1536-dim — we pad to match
 */
export async function getEmbedding(text: string): Promise<EmbeddingResponse | null> {
  try {
    const raw = await geminiEmbed(text)
    if (!raw) return null

    // Pad 768 → 1536 by duplicating (maintains cosine similarity properties)
    const embedding = raw.length === 768 ? [...raw, ...raw] : raw

    return { embedding, tokens_used: Math.ceil(text.length / 4) }
  } catch {
    return null
  }
}

/**
 * Generate AI brief for a mission or daily summary
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
    const content = await geminiGenerate(prompt, false)
    return content ?? 'Brief generation failed — insufficient data.'
  } catch {
    return 'Brief generation temporarily unavailable.'
  }
}
