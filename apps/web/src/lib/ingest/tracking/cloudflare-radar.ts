import { createServiceClient } from '@/lib/supabase/server'

export type CloudflareRadarOutage = {
  id: string
  country_code: string | null
  bandwidth_ratio: number
  baseline_ratio: number
  measured_at: string
  severity: 1 | 2 | 3 | 4 | 5
  raw: Record<string, unknown>
}

export type CloudflareRadarResult = {
  fetched: number
  detected: number
  stored: number
  skipped?: boolean
}

type RadarLocationResult = {
  country?: string | null
  alpha2?: string | null
  bandwidth_ratio?: number | null
  normal_ratio?: number | null
  timestamp?: string | null
  [key: string]: unknown
}

type RadarApiResponse = {
  success?: boolean
  result?: {
    locations?: RadarLocationResult[]
    [key: string]: unknown
  }
  errors?: Array<{ message?: string }>
}

function toSeverity(ratio: number): 1 | 2 | 3 | 4 | 5 {
  if (ratio <= 0.2) return 5
  if (ratio <= 0.35) return 4
  if (ratio <= 0.5) return 3
  if (ratio <= 0.7) return 2
  return 1
}

export async function ingestCloudflareRadar(): Promise<CloudflareRadarResult> {
  const token = process.env['CLOUDFLARE_RADAR_TOKEN']
  const result: CloudflareRadarResult = { fetched: 0, detected: 0, stored: 0 }

  if (!token) {
    console.warn('[cloudflare-radar] CLOUDFLARE_RADAR_TOKEN not set — skipping')
    return { ...result, skipped: true }
  }

  const response = await fetch('https://api.cloudflare.com/client/v4/radar/internet_quality/summary/bandwidth', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`[cloudflare-radar] HTTP ${response.status}`)
  }

  const payload = await response.json() as RadarApiResponse
  const rows = payload.result?.locations ?? []
  result.fetched = rows.length

  const outages = rows
    .map((row) => {
      const bandwidthRatio = Number(row.bandwidth_ratio ?? 1)
      const baselineRatio = Number(row.normal_ratio ?? 1)
      const countryCode = typeof row.alpha2 === 'string' ? row.alpha2 : typeof row.country === 'string' ? row.country : null
      const measuredAt = typeof row.timestamp === 'string' ? row.timestamp : new Date().toISOString()
      if (!Number.isFinite(bandwidthRatio) || bandwidthRatio > 0.8) return null
      return {
        id: `cf-radar-${countryCode ?? 'unknown'}-${measuredAt.slice(0, 13)}`,
        country_code: countryCode,
        bandwidth_ratio: bandwidthRatio,
        baseline_ratio: Number.isFinite(baselineRatio) ? baselineRatio : 1,
        measured_at: measuredAt,
        severity: toSeverity(bandwidthRatio),
        raw: row,
      } satisfies CloudflareRadarOutage
    })
    .filter((item): item is CloudflareRadarOutage => item !== null)

  result.detected = outages.length
  if (outages.length === 0) return result

  const supabase = createServiceClient()
  for (const outage of outages) {
    const { error } = await supabase.from('internet_outages').upsert({
      source: 'cloudflare-radar',
      source_id: outage.id,
      country_code: outage.country_code,
      bandwidth_ratio: outage.bandwidth_ratio,
      baseline_ratio: outage.baseline_ratio,
      severity: outage.severity,
      detected_at: outage.measured_at,
      raw: outage.raw,
    }, { onConflict: 'source,source_id' })

    if (!error) result.stored += 1
  }

  return result
}
