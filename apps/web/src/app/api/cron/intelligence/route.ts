export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cronAuthOk } from '@/lib/cron-auth'
import { enhanceVesselIntelligence } from '@/lib/ingest/tracking/ais-enhanced'
import { runSanctionsMonitoring } from '@/lib/intelligence/sanctions-monitor'
import { collectEconomicSignals } from '@/lib/ingest/economic-signals'
import { calculateAllCompositeScores } from '@/lib/intelligence/signal-aggregator'

export async function GET(req: NextRequest) {
  if (!cronAuthOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const startTime = Date.now()

  try {
    // Run all intelligence gathering in parallel
    const [vesselIntel, sanctions, economic, compositeScores] = await Promise.all([
      enhanceVesselIntelligence(),
      runSanctionsMonitoring(),
      collectEconomicSignals(),
      calculateAllCompositeScores(),
    ])

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      vessel_intelligence: {
        dark_vessels_detected: vesselIntel.dark_vessels.length,
        route_anomalies_detected: vesselIntel.route_anomalies.length,
        sanctioned_dark_flagged: vesselIntel.sanctioned_dark_flagged,
      },
      sanctions_monitoring: {
        active_entities: sanctions.active_entities_detected,
        violations: sanctions.new_violations,
        escalation_signals: sanctions.escalation_signals,
      },
      economic_signals: {
        commodity_spikes: economic.commodity_spikes,
        correlations_detected: economic.correlations_detected,
      },
      composite_scores: {
        countries_analyzed: compositeScores.length,
        critical_countries: compositeScores.filter(s => s.severity === 'critical').length,
        high_threat_countries: compositeScores.filter(s => s.severity === 'high').length,
      },
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[intelligence cron] Error:', error)
    return NextResponse.json(
      {
        error: 'Intelligence gathering failed',
        details: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
