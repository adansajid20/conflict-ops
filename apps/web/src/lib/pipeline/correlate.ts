import { createServiceClient } from '@/lib/supabase/server'

export async function detectCorrelationSignals(): Promise<{ signals_created: number }> {
  const supabase = createServiceClient()
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let signals_created = 0

  try {
    // Pattern 1: Flight surge + critical/high events in same region
    const { data: flightData } = await supabase
      .from('flight_tracks')
      .select('conflict_zone')
      .gte('recorded_at', twoHoursAgo)
      .not('conflict_zone', 'is', null)

    if (flightData?.length) {
      // Count flights per zone manually
      const zoneCounts: Record<string, number> = {}
      for (const row of flightData) {
        if (row.conflict_zone) zoneCounts[row.conflict_zone] = (zoneCounts[row.conflict_zone] ?? 0) + 1
      }

      for (const [zone, count] of Object.entries(zoneCounts)) {
        if (count < 10) continue

        const { data: events } = await supabase
          .from('events')
          .select('id, severity, title')
          .ilike('region', `%${zone}%`)
          .gte('ingested_at', twoHoursAgo)
          .gte('severity', 3)

        if (!events || events.length < 2) continue

        // Check if signal already exists to avoid dupes
        const { data: existing } = await supabase
          .from('correlation_signals')
          .select('id')
          .eq('signal_type', 'flights-plus-critical-events')
          .eq('region', zone)
          .gte('detected_at', twoHoursAgo)
          .limit(1)

        if (existing?.length) continue

        await supabase.from('correlation_signals').insert({
          signal_type: 'flights-plus-critical-events',
          title: `Military flight surge + ${events.length} critical events in ${zone.replace(/_/g, ' ')}`,
          description: `${count} military flights detected alongside ${events.length} critical/high severity events. Possible pre-attack or active operation indicator.`,
          severity: events.some(e => e.severity === 4) ? 'critical' : 'high',
          region: zone,
          confidence: 0.72,
          signal_sources: {
            flight_zone: zone,
            flight_count: count,
            event_ids: events.map(e => e.id),
          },
        })
        signals_created++
      }
    }

    // Pattern 2: Internet outage + high-severity events in same country
    const { data: outages } = await supabase
      .from('internet_outages')
      .select('id, country, severity')
      .gte('recorded_at', oneDayAgo)
      .is('resolved_at', null)

    for (const outage of outages ?? []) {
      const { data: events } = await supabase
        .from('events')
        .select('id, severity, title')
        .ilike('region', `%${outage.country}%`)
        .gte('ingested_at', oneDayAgo)
        .gte('severity', 3)

      if (!events || events.length < 1) continue

      const { data: existing } = await supabase
        .from('correlation_signals')
        .select('id')
        .eq('signal_type', 'outage-plus-events')
        .gte('detected_at', oneDayAgo)
        .limit(1)

      if (existing?.length) continue

      await supabase.from('correlation_signals').insert({
        signal_type: 'outage-plus-events',
        title: `Internet outage + ${events.length} conflict events in ${outage.country}`,
        description: `A ${outage.severity} internet outage has been detected alongside ${events.length} high-severity events. Possible government shutdown or pre-crackdown indicator.`,
        severity: 'high',
        region: outage.country,
        confidence: 0.65,
        signal_sources: {
          outage_id: outage.id,
          event_ids: events.map(e => e.id),
        },
      })
      signals_created++
    }
  } catch (e) {
    console.error('[correlate] Error:', e)
  }

  return { signals_created }
}
