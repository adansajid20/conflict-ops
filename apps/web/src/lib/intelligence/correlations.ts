export type CorrelationEvent = {
  id: string
  region?: string | null
  event_type?: string | null
  occurred_at?: string | null
}

export type CorrelationResult = {
  lead_event_type: string
  follow_event_type: string
  region: string
  count: number
  avg_lag_hours: number
}

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const LEAD_MS = 72 * 60 * 60 * 1000

export function findCorrelations(events: CorrelationEvent[]): CorrelationResult[] {
  const regionBuckets = new Map<string, CorrelationEvent[]>()

  for (const event of events) {
    const region = event.region?.trim()
    const occurredAt = event.occurred_at ? new Date(event.occurred_at).getTime() : Number.NaN
    if (!region || !event.event_type || !Number.isFinite(occurredAt)) continue
    const windowStart = Math.floor(occurredAt / WINDOW_MS) * WINDOW_MS
    const key = `${region}::${windowStart}`
    const bucket = regionBuckets.get(key) ?? []
    bucket.push(event)
    regionBuckets.set(key, bucket)
  }

  const stats = new Map<string, { count: number; lagMs: number }>()

  for (const [key, bucket] of regionBuckets.entries()) {
    const region = key.split('::')[0] ?? 'Unknown'
    const sorted = [...bucket].sort((a, b) => new Date(a.occurred_at ?? 0).getTime() - new Date(b.occurred_at ?? 0).getTime())

    for (let i = 0; i < sorted.length; i += 1) {
      const lead = sorted[i]
      if (!lead) continue
      const leadAt = new Date(lead.occurred_at ?? 0).getTime()
      if (!lead.event_type || !Number.isFinite(leadAt)) continue

      for (let j = i + 1; j < sorted.length; j += 1) {
        const follow = sorted[j]
        if (!follow) continue
        const followAt = new Date(follow.occurred_at ?? 0).getTime()
        const lag = followAt - leadAt
        if (!follow.event_type || !Number.isFinite(followAt) || lag <= 0 || lag > LEAD_MS) continue
        if (lead.event_type === follow.event_type) continue

        const pairKey = `${region}::${lead.event_type}::${follow.event_type}`
        const current = stats.get(pairKey) ?? { count: 0, lagMs: 0 }
        current.count += 1
        current.lagMs += lag
        stats.set(pairKey, current)
      }
    }
  }

  return [...stats.entries()]
    .map(([key, value]) => {
      const [region, lead_event_type, follow_event_type] = key.split('::')
      return {
        region: region ?? 'Unknown',
        lead_event_type: lead_event_type ?? 'unknown',
        follow_event_type: follow_event_type ?? 'unknown',
        count: value.count,
        avg_lag_hours: Number((value.lagMs / value.count / (60 * 60 * 1000)).toFixed(1)),
      }
    })
    .sort((a, b) => b.count - a.count)
}
