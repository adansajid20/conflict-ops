import { inngest } from './client'
import { ingestACLED } from '@/lib/ingest/acled'
import { ingestGDELT } from '@/lib/ingest/gdelt'
import { runHeavyLane } from '@/lib/ingest/heavy-lane'
import { computeEscalationLevel } from '@/lib/alerts/escalation'
import { HIGH_CONFLICT_COUNTRIES } from '@/lib/ingest/acled'

// ============================================
// FAST LANE — every 15 minutes
// Cheap: raw ingest + dedup only
// No LLM calls
// ============================================

export const fastLaneIngest = inngest.createFunction(
  {
    id: 'fast-lane-ingest',
    name: 'Fast Lane: Raw Ingest',
    concurrency: { limit: 1 }, // never overlap
  },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    // Check system flags — if paused, skip
    const { isSafeMode } = await import('@/lib/cache/redis')
    const safeMode = await step.run('check-safe-mode', async () => isSafeMode())

    if (safeMode) {
      return { skipped: true, reason: 'safe-mode-active' }
    }

    const [acledResult, gdeltResult] = await Promise.allSettled([
      step.run('ingest-acled', () => ingestACLED(48)),
      step.run('ingest-gdelt', () => ingestGDELT()),
    ])

    return {
      acled: acledResult.status === 'fulfilled' ? acledResult.value : { error: String(acledResult.reason) },
      gdelt: gdeltResult.status === 'fulfilled' ? gdeltResult.value : { error: String(gdeltResult.reason) },
      timestamp: new Date().toISOString(),
    }
  }
)

// ============================================
// HEAVY LANE — every 30 minutes
// Expensive: GPT-4o extraction + embeddings
// Hard budget: max 50 calls per run
// ============================================

export const heavyLaneProcess = inngest.createFunction(
  {
    id: 'heavy-lane-process',
    name: 'Heavy Lane: AI Extraction + Embedding',
    concurrency: { limit: 1 },
    retries: 1,
  },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const { isSafeMode } = await import('@/lib/cache/redis')
    const safeMode = await step.run('check-safe-mode', async () => isSafeMode())

    if (safeMode) {
      return { skipped: true, reason: 'safe-mode-active' }
    }

    const result = await step.run('run-heavy-lane', () => runHeavyLane())

    return {
      ...result,
      timestamp: new Date().toISOString(),
    }
  }
)

// ============================================
// FORECAST RECOMPUTE — every 6 hours
// Scoring: rule-based (no LLM)
// ============================================

export const forecastRecompute = inngest.createFunction(
  {
    id: 'forecast-recompute',
    name: 'Forecast: Recompute Regional Scores',
    concurrency: { limit: 1 },
    retries: 0,
  },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const result = await step.run('compute-forecasts', async () => {
      const { createServiceClient } = await import('@/lib/supabase/server')
      const supabase = createServiceClient()

      // Get all countries with events in last 30 days
      const { data: countries } = await supabase
        .from('events')
        .select('country_code')
        .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .not('country_code', 'is', null)

      if (!countries) return { computed: 0 }

      const uniqueCountries = [...new Set(countries.map(c => c.country_code).filter(Boolean))]
      let computed = 0

      for (const countryCode of uniqueCountries) {
        await computeCountryForecast(countryCode as string)
        computed++
      }

      return { computed, countries: uniqueCountries.length }
    })

    return { ...result, timestamp: new Date().toISOString() }
  }
)

// ============================================
// ESCALATION MONITOR — every 2 hours
// Rule-based only, no LLM
// ============================================

export const escalationMonitor = inngest.createFunction(
  { id: 'escalation-monitor', name: 'Escalation Ladder Monitor', concurrency: { limit: 1 }, retries: 0 },
  { cron: '0 */2 * * *' },
  async ({ step }) => {
    const results = await step.run('compute-escalations', async () => {
      const outcomes: Array<{ country: string; level: number; changed: boolean }> = []

      for (const countryCode of HIGH_CONFLICT_COUNTRIES.slice(0, 30)) {
        try {
          const result = await computeEscalationLevel(countryCode)
          outcomes.push({ country: countryCode, level: result.level, changed: result.changed })
        } catch {
          // skip failed countries
        }
      }

      return outcomes
    })

    const changed = results.filter(r => r.changed)
    return { computed: results.length, changed: changed.length, escalations: changed, timestamp: new Date().toISOString() }
  }
)

async function computeCountryForecast(countryCode: string): Promise<void> {
  const { createServiceClient } = await import('@/lib/supabase/server')
  const supabase = createServiceClient()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: events } = await supabase
    .from('events')
    .select('severity, occurred_at')
    .eq('country_code', countryCode)
    .gte('occurred_at', thirtyDaysAgo)
    .not('severity', 'is', null)

  const eventCount = events?.length ?? 0

  // RULE: score = NULL if event_count < 3. NEVER FABRICATE.
  if (eventCount < 3) {
    await supabase.from('forecasts').upsert(
      {
        region: countryCode,
        country_code: countryCode,
        forecast_type: 'escalation',
        horizon_days: 30,
        score: null,
        confidence: null,
        event_count: eventCount,
        computed_at: new Date().toISOString(),
        model_version: 'rule-based-v1',
      },
      { onConflict: 'region,forecast_type,horizon_days' }
    )
    return
  }

  // Rule-based scoring
  const severities = events!.map(e => e.severity as number)
  const avgSeverity = severities.reduce((a, b) => a + b, 0) / severities.length
  const maxSeverity = Math.max(...severities)

  // Normalize components (0-1)
  const freqNorm = Math.min(eventCount / 100, 1)
  const severityNorm = avgSeverity / 5
  const maxNorm = maxSeverity / 5

  // Weighted score
  const score = Math.min(
    0.30 * freqNorm +
    0.40 * severityNorm +
    0.30 * maxNorm,
    1.0
  )

  const confidence = eventCount >= 15 ? 'high' : eventCount >= 7 ? 'medium' : 'low'

  await supabase.from('forecasts').upsert(
    {
      region: countryCode,
      country_code: countryCode,
      forecast_type: 'escalation',
      horizon_days: 30,
      score: Math.round(score * 1000) / 1000,
      confidence,
      event_count: eventCount,
      computed_at: new Date().toISOString(),
      model_version: 'rule-based-v1',
      factors: {
        frequency_norm: freqNorm,
        severity_norm: severityNorm,
        max_severity_norm: maxNorm,
        weights: { frequency: 0.30, severity: 0.40, max_severity: 0.30 },
      },
    },
    { onConflict: 'region,forecast_type,horizon_days' }
  )
}
