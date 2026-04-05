export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const h7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  let detected = 0

  // Pattern 1: Sudden escalation — region with 3+ critical events in 6h
  const h6 = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const { data: critEvents } = await supabase.from('events').select('region').gte('occurred_at', h6).eq('severity', 4)
  const regionCounts = new Map<string, number>()
  for (const e of critEvents ?? []) {
    const r = e.region ?? 'unknown'
    regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1)
  }
  for (const [region, count] of regionCounts) {
    if (count >= 3) {
      await supabase.from('correlation_signals').insert({
        pattern_type: 'sudden_escalation',
        description: `${count} critical-severity events in ${region} within 6 hours — sudden escalation pattern`,
        region, confidence: Math.min(0.5 + count * 0.1, 0.95), resolved: false,
        detected_at: new Date().toISOString(),
      })
      detected++
    }
  }

  // Pattern 2: Military flight surge + ground events in same region
  const { data: flights } = await supabase.from('flight_tracks').select('zone_name').eq('is_military', true).gte('created_at', h24)
  const flightZones = new Map<string, number>()
  for (const f of flights ?? []) {
    const z = f.zone_name ?? 'unknown'
    flightZones.set(z, (flightZones.get(z) ?? 0) + 1)
  }
  for (const [zone, flightCount] of flightZones) {
    if (flightCount < 5) continue
    const { count: groundCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).ilike('region', `%${zone}%`).gte('occurred_at', h24).gte('severity', 3)
    if ((groundCount ?? 0) >= 2) {
      await supabase.from('correlation_signals').insert({
        pattern_type: 'air_ground_correlation',
        description: `${flightCount} military flights + ${groundCount} high-severity ground events in ${zone} over 24h`,
        region: zone, confidence: 0.7, resolved: false, detected_at: new Date().toISOString(),
      })
      detected++
    }
  }

  // Pattern 3: Internet outage during military activity
  const { data: outages } = await supabase.from('internet_outages').select('region, country').gte('start_time', h24)
  for (const o of outages ?? []) {
    const region = o.region ?? o.country ?? ''
    const { count: milEvts } = await supabase.from('events').select('*', { count: 'exact', head: true }).ilike('region', `%${region}%`).gte('occurred_at', h24).gte('severity', 3)
    if ((milEvts ?? 0) >= 2) {
      await supabase.from('correlation_signals').insert({
        pattern_type: 'blackout_during_conflict',
        description: `Internet outage in ${region} coincides with ${milEvts} high-severity events — possible information blackout`,
        region, confidence: 0.65, resolved: false, detected_at: new Date().toISOString(),
      })
      detected++
    }
  }

  // Pattern 4: Seismic + conflict events (explosion signatures)
  const { data: seismicEvts } = await supabase.from('seismic_events').select('region').eq('possible_explosion', true).gte('event_time', h24)
  const seismicZones = new Map<string, number>()
  for (const s of seismicEvts ?? []) {
    const r = s.region ?? 'unknown'
    seismicZones.set(r, (seismicZones.get(r) ?? 0) + 1)
  }
  for (const [region, count] of seismicZones) {
    await supabase.from('correlation_signals').insert({
      pattern_type: 'seismic_explosion_pattern',
      description: `${count} shallow seismic event(s) with explosion signatures in ${region} — possible strike activity`,
      region, confidence: 0.6, resolved: false, detected_at: new Date().toISOString(),
    })
    detected++
  }

  // Pattern 5: Multi-source corroboration (same event type in region from 3+ different sources in 2h)
  const h2 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: recentEvts } = await supabase.from('events').select('region, event_type, source').gte('occurred_at', h2).gte('severity', 3)
  const corrobMap = new Map<string, Set<string>>()
  for (const e of recentEvts ?? []) {
    const key = `${e.region}|${e.event_type}`
    if (!corrobMap.has(key)) corrobMap.set(key, new Set())
    corrobMap.get(key)!.add(e.source ?? 'unknown')
  }
  for (const [key, sources] of corrobMap) {
    if (sources.size >= 3) {
      const [region, eventType] = key.split('|')
      await supabase.from('correlation_signals').insert({
        pattern_type: 'multi_source_corroboration',
        description: `${eventType} event in ${region} corroborated by ${sources.size} independent sources in 2h — high confidence`,
        region: region ?? 'unknown', confidence: Math.min(0.6 + sources.size * 0.1, 0.98), resolved: false, detected_at: new Date().toISOString(),
      })
      detected++
    }
  }

  // Also scan for week-long escalation velocity (events 7d vs 24h)
  const { data: regions7d } = await supabase.from('region_risk_scores').select('region, event_count_24h, score').order('event_count_24h', { ascending: false }).limit(10)
  for (const r of regions7d ?? []) {
    const { count: count7d } = await supabase.from('events').select('*', { count: 'exact', head: true }).ilike('region', `%${r.region}%`).gte('occurred_at', h7d)
    const dailyAvg = (count7d ?? 0) / 7
    const count24h = r.event_count_24h ?? 0
    if (count24h > dailyAvg * 3 && count24h >= 5) {
      await supabase.from('correlation_signals').insert({
        pattern_type: 'velocity_spike',
        description: `${r.region}: ${count24h} events in 24h vs ${dailyAvg.toFixed(1)}/day average (${Math.round(count24h / (dailyAvg || 1))}x spike)`,
        region: r.region, confidence: 0.75, resolved: false, detected_at: new Date().toISOString(),
      })
      detected++
    }
  }

  return NextResponse.json({ detected })
}
