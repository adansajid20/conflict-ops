/**
 * Metaculus Prediction Market Integration
 * Source: metaculus.com — public API, no auth required
 * Attribution: "Forecasts via Metaculus (metaculus.com)"
 *
 * Fetches open questions tagged: geopolitics, conflict, war, military
 * Maps probability → confidence score for analyst briefings
 * Updates every 4 hours — questions don't move fast
 */

const METACULUS_BASE = 'https://www.metaculus.com/api2'

export type MetaculusQuestion = {
  id: number
  title: string
  resolution_criteria: string
  community_prediction: number | null   // 0-1 probability
  resolution: string | null             // yes/no/annulled/ambiguous
  close_time: string
  resolve_time: string
  tags: string[]
  page_url: string
}

export type MetaculusResult = {
  questions: MetaculusQuestion[]
  fetched: number
}

const CONFLICT_TAGS = ['geopolitics', 'conflict', 'war', 'military', 'nuclear', 'sanctions', 'russia', 'ukraine', 'china', 'iran', 'israel']

export async function fetchMetaculusQuestions(limit = 50): Promise<MetaculusResult> {
  const questions: MetaculusQuestion[] = []

  try {
    const params = new URLSearchParams({
      limit: String(limit),
      status: 'open',
      type: 'forecast',
      order_by: '-activity',
      search: 'conflict OR war OR military OR geopolitics',
    })

    const res = await fetch(`${METACULUS_BASE}/questions/?${params}`, {
      headers: { 'User-Agent': 'ConflictOps/1.0' },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) return { questions: [], fetched: 0 }

    const data = await res.json() as { results?: Array<Record<string, unknown>> }

    for (const q of (data.results ?? [])) {
      const cp = (q['community_prediction'] as Record<string, unknown> | null)?.['full']
      const pred = cp ? Number((cp as Record<string, unknown>)['q2']) : null

      questions.push({
        id: Number(q['id']),
        title: String(q['title'] ?? ''),
        resolution_criteria: String(q['resolution_criteria'] ?? ''),
        community_prediction: pred,
        resolution: q['resolution'] ? String(q['resolution']) : null,
        close_time: String(q['close_time'] ?? ''),
        resolve_time: String(q['resolve_time'] ?? ''),
        tags: ((q['tags'] as Array<Record<string, unknown>>) ?? []).map(t => String(t['name'] ?? '')),
        page_url: `https://www.metaculus.com/questions/${q['id']}/`,
      })
    }
  } catch {
    // swallow — markets are non-critical
  }

  return { questions, fetched: questions.length }
}
