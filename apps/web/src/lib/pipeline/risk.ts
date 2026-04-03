import { createServiceClient } from '@/lib/supabase/server'

const REGIONS = [
  'middle_east', 'eastern_europe', 'africa', 'south_asia',
  'east_asia', 'southeast_asia', 'central_asia', 'latin_america', 'north_america',
]

export async function calculateRegionRisk(region: string): Promise<number> {
  const supabase = createServiceClient()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: events7d },
    { count: criticalEvents },
    { count: militaryFlights },
    { count: darkShips },
    { count: seismic },
    { count: outages },
  ] = await Promise.all([
    supabase.from('events').select('id', { count: 'exact', head: true }).or(`region.eq.${region},region.ilike.%${region.replace(/_/g,' ')}%`).gte('occurred_at', since7d),
    supabase.from('events').select('id', { count: 'exact', head: true }).or(`region.eq.${region},region.ilike.%${region.replace(/_/g,' ')}%`).gte('severity', 3).gte('occurred_at', since24h),
    supabase.from('flight_tracks').select('id', { count: 'exact', head: true }).eq('conflict_zone', region).gte('recorded_at', since24h),
    supabase.from('vessel_tracks').select('id', { count: 'exact', head: true }).eq('maritime_zone', region).eq('ais_status', 'dark').gte('recorded_at', since7d),
    supabase.from('seismic_events').select('id', { count: 'exact', head: true }).eq('conflict_zone', region).eq('is_suspicious', true).gte('occurred_at', since24h),
    supabase.from('internet_outages').select('id', { count: 'exact', head: true }).ilike('country', `%${region.replace(/_/g,' ')}%`).gte('started_at', since24h),
  ])

  const score =
    Math.min((events7d ?? 0) * 0.05, 3.0) +
    Math.min((criticalEvents ?? 0) * 0.8, 3.0) +
    Math.min((militaryFlights ?? 0) * 0.02, 2.0) +
    Math.min((darkShips ?? 0) * 0.5, 1.0) +
    Math.min((seismic ?? 0) * 0.3, 0.5) +
    Math.min((outages ?? 0) * 0.5, 0.5)

  return Math.min(parseFloat(score.toFixed(2)), 10.0)
}

export async function updateAllRegionRiskScores(): Promise<{ updated: number }> {
  const supabase = createServiceClient()
  let updated = 0

  for (const region of REGIONS) {
    try {
      const newScore = await calculateRegionRisk(region)

      // Get previous score for trend calculation
      const { data: prev } = await supabase
        .from('region_risk_scores')
        .select('risk_score')
        .eq('region', region)
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single()

      const prevScore = prev?.risk_score ?? newScore
      const delta = parseFloat((newScore - prevScore).toFixed(2))
      const trend = delta > 0.5 ? 'escalating' : delta < -0.5 ? 'de-escalating' : 'stable'

      // Delete today's existing row then insert fresh (avoids dupe constraint issues)
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)
      await supabase.from('region_risk_scores').delete()
        .eq('region', region)
        .gte('calculated_at', todayStart.toISOString())

      await supabase.from('region_risk_scores').insert({
        region,
        risk_score: newScore,
        trend,
        trend_delta: delta,
        valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      updated++
    } catch (e) {
      console.error(`[risk] Failed for ${region}:`, e)
    }
  }

  return { updated }
}
