import { createServiceClient } from '@/lib/supabase/server'

type TrendRow = {
  zone: string
  country_code: string | null
  event_count: number
  prior_count: number
  change_pct: number
}

type CountryAggregate = {
  country_code: string
  event_count_30d: number
  event_count_7d: number
  event_count_prior_7d: number
  severity_avg: number
  severity_prior_avg: number
  escalation_count_30d: number
}

export async function detectTrends(): Promise<number> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('get_conflict_trends', { days: 7 })
  if (error) return 0

  let created = 0
  for (const row of ((data as TrendRow[] | null) ?? [])) {
    let signalType: 'ESCALATION_TREND' | 'DEESCALATION' | null = null
    if (row.change_pct > 50) signalType = 'ESCALATION_TREND'
    if (row.change_pct < -30) signalType = 'DEESCALATION'
    if (!signalType) continue

    const confidence = Math.min(0.99, Math.max(0.4, Math.abs(row.change_pct) / 100))
    const basis = `${row.event_count} events in the last 7d vs ${row.prior_count} in the prior 7d (${Math.round(row.change_pct)}% change).`
    const { error: upsertError } = await supabase.from('forecast_signals').upsert({
      conflict_zone: row.zone,
      country_code: row.country_code,
      signal_type: signalType,
      confidence,
      basis,
      valid_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })

    if (!upsertError) created++
  }

  return created
}

export async function updateCountryRiskScores(): Promise<number> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('events')
    .select('country_code, severity, escalation_indicator, ingested_at')
    .not('country_code', 'is', null)
    .gte('ingested_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (error) return 0

  const buckets = new Map<string, CountryAggregate>()
  const now = Date.now()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const countryCode = typeof row.country_code === 'string' ? row.country_code : null
    if (!countryCode) continue
    const ingestedAt = typeof row.ingested_at === 'string' ? new Date(row.ingested_at).getTime() : 0
    const severity = typeof row.severity === 'number' ? row.severity : 1
    const escalation = Boolean(row.escalation_indicator)

    const bucket = buckets.get(countryCode) ?? {
      country_code: countryCode,
      event_count_30d: 0,
      event_count_7d: 0,
      event_count_prior_7d: 0,
      severity_avg: 0,
      severity_prior_avg: 0,
      escalation_count_30d: 0,
    }

    bucket.event_count_30d += 1
    bucket.severity_avg += severity
    if (escalation) bucket.escalation_count_30d += 1
    if (now - ingestedAt <= sevenDaysMs) {
      bucket.event_count_7d += 1
    } else if (now - ingestedAt <= 2 * sevenDaysMs) {
      bucket.event_count_prior_7d += 1
      bucket.severity_prior_avg += severity
    }
    buckets.set(countryCode, bucket)
  }

  let updated = 0
  for (const bucket of buckets.values()) {
    const severityAvg = bucket.event_count_30d > 0 ? bucket.severity_avg / bucket.event_count_30d : 0
    const eventFrequencyScore = Math.min(100, bucket.event_count_30d * 2)
    const severityWeightedScore = Math.min(100, severityAvg * 20)
    const escalationTrendScore = Math.min(100, bucket.escalation_count_30d * 10)
    const historicalBaselineScore = bucket.event_count_prior_7d === 0 ? 60 : Math.min(100, (bucket.event_count_7d / bucket.event_count_prior_7d) * 50)
    const composite = Math.round(eventFrequencyScore * 0.35 + severityWeightedScore * 0.3 + escalationTrendScore * 0.2 + historicalBaselineScore * 0.15)

    const priorWindowScore = bucket.event_count_prior_7d * 10 + (bucket.event_count_prior_7d > 0 ? bucket.severity_prior_avg / bucket.event_count_prior_7d : 0) * 10
    const currentWindowScore = bucket.event_count_7d * 10 + severityAvg * 10
    const trend = currentWindowScore > priorWindowScore + 10 ? 'rising' : currentWindowScore < priorWindowScore - 10 ? 'falling' : 'stable'

    const { error: upsertError } = await supabase.from('country_risk_scores').upsert({
      country_code: bucket.country_code,
      risk_score: Math.min(100, Math.max(0, composite)),
      trend,
      event_count_7d: bucket.event_count_7d,
      severity_avg: Number(severityAvg.toFixed(2)),
      updated_at: new Date().toISOString(),
    })

    if (!upsertError) updated++
  }

  return updated
}
