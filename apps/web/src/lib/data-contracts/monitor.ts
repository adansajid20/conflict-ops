import { createServiceClient } from '@/lib/supabase/server'

export type SourceSLAStatus = 'green' | 'amber' | 'red'

export type SourceSLA = {
  source: string
  status: SourceSLAStatus
  last_success_at: string | null
  avg_fetch_interval_mins: number | null
  failure_rate_7d: number
}

type RawIngestLogRow = {
  source: string | null
  fetched_at: string | null
  record_count: number | null
}

function deriveStatus(lastSuccessAt: string | null, avgIntervalMins: number | null, failureRate: number): SourceSLAStatus {
  if (!lastSuccessAt) return 'red'
  const ageMins = (Date.now() - new Date(lastSuccessAt).getTime()) / 60000
  if (failureRate >= 0.5 || ageMins > Math.max((avgIntervalMins ?? 60) * 6, 360)) return 'red'
  if (failureRate >= 0.2 || ageMins > Math.max((avgIntervalMins ?? 60) * 2, 120)) return 'amber'
  return 'green'
}

export async function checkSourceSLA(): Promise<SourceSLA[]> {
  try {
    const supabase = createServiceClient()
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('raw_ingest_log')
      .select('source,fetched_at,record_count')
      .gte('fetched_at', since)
      .order('fetched_at', { ascending: false })

    if (error || !data) return []

    const grouped = new Map<string, RawIngestLogRow[]>()
    for (const row of data as RawIngestLogRow[]) {
      if (!row.source) continue
      const list = grouped.get(row.source) ?? []
      list.push(row)
      grouped.set(row.source, list)
    }

    return [...grouped.entries()].map(([source, rows]) => {
      const successes = rows.filter((row) => (row.record_count ?? 0) > 0)
      const timestamps = successes
        .map((row) => row.fetched_at)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

      const intervals: number[] = []
      for (let index = 1; index < timestamps.length; index += 1) {
        const current = timestamps[index]
        const previous = timestamps[index - 1]
        if (!current || !previous) continue
        intervals.push((new Date(current).getTime() - new Date(previous).getTime()) / 60000)
      }

      const avgFetchInterval = intervals.length > 0
        ? Number((intervals.reduce((sum, value) => sum + value, 0) / intervals.length).toFixed(1))
        : null
      const failureRate = rows.length > 0 ? Number(((rows.length - successes.length) / rows.length).toFixed(3)) : 0
      const lastSuccessAt = successes[0]?.fetched_at ?? null

      return {
        source,
        status: deriveStatus(lastSuccessAt, avgFetchInterval, failureRate),
        last_success_at: lastSuccessAt,
        avg_fetch_interval_mins: avgFetchInterval,
        failure_rate_7d: failureRate,
      }
    }).sort((left, right) => left.source.localeCompare(right.source))
  } catch {
    return []
  }
}
