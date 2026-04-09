export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { runSanctionsMonitoring, getSanctionsActivityByRegion, detectActiveSanctionedEntities } from '@/lib/intelligence/sanctions-monitor'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const region = url.searchParams.get('region')
  const format = url.searchParams.get('format') ?? 'full' // 'full' or 'summary'

  try {
    // Get monitoring results
    const monitoring = await runSanctionsMonitoring()

    if (region) {
      // Return data for specific region
      const regionData = await getSanctionsActivityByRegion(region)
      return NextResponse.json({
        region,
        active_entities: regionData.active_entities,
        violation_signals: regionData.violation_signals,
        escalation_signals: regionData.escalation_signals,
        summary: regionData.summary,
      })
    }

    // Return global sanctions activity
    if (format === 'summary') {
      return NextResponse.json({
        global_active_entities: monitoring.active_entities_detected,
        violations_24h: monitoring.new_violations,
        escalation_signals: monitoring.escalation_signals,
        timestamp: new Date().toISOString(),
      })
    }

    // Full format
    const supabase = createServiceClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: violationSignals } = await supabase
      .from('correlation_signals')
      .select('title, description, severity, region, detected_at')
      .eq('signal_type', 'sanctions_violation_new_region')
      .gte('detected_at', sevenDaysAgo)
      .order('detected_at', { ascending: false })
      .limit(20)

    const { data: escalationSignals } = await supabase
      .from('correlation_signals')
      .select('title, description, severity, detected_at')
      .eq('signal_type', 'sanctions_escalation')
      .gte('detected_at', sevenDaysAgo)
      .order('detected_at', { ascending: false })
      .limit(10)

    const activeEntities = await detectActiveSanctionedEntities()

    return NextResponse.json({
      monitoring_summary: {
        active_entities_detected: monitoring.active_entities_detected,
        violations_24h: monitoring.new_violations,
        escalation_signals: monitoring.escalation_signals,
      },
      recently_active_entities: activeEntities.slice(0, 15).map(e => ({
        entity_name: e.entity_name,
        program: e.program,
        regions_active: e.regions_active,
        event_count_7d: e.event_count_7d,
        last_event_date: e.last_event_date,
      })),
      violation_signals: violationSignals ?? [],
      escalation_signals: escalationSignals ?? [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[sanctions activity] Error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve sanctions activity', details: String(error) },
      { status: 500 }
    )
  }
}
