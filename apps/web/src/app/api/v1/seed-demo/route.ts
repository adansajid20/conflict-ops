export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/seed-demo
 * Seeds demo events for first-run experience.
 * Only runs if events table is empty.
 * Protected: requires service role context (admin only).
 */

import { createServiceClient } from '@/lib/supabase/server'

const DEMO_EVENTS = [
  { source: 'gdelt', source_id: 'demo-001', event_type: 'conflict', title: 'Artillery exchanges reported along eastern Ukraine frontline', description: 'Satellite imagery analysis confirms continued artillery activity in Zaporizhzhia oblast. Multiple impact craters detected in 24-hour window.', region: 'Eastern Europe', country_code: 'UA', severity: 4, occurred_at: new Date(Date.now() - 2 * 3600000).toISOString() },
  { source: 'reliefweb', source_id: 'demo-002', event_type: 'humanitarian', title: 'UNHCR reports 340,000 newly displaced in Sudan fighting', description: 'RSF and SAF clashes in North Darfur have driven mass displacement since last week. UN humanitarian corridor negotiations ongoing.', region: 'East Africa', country_code: 'SD', severity: 5, occurred_at: new Date(Date.now() - 5 * 3600000).toISOString() },
  { source: 'gdacs', source_id: 'demo-003', event_type: 'conflict', title: 'Red Alert: Complex emergency escalation in Myanmar Shan State', description: 'GDACS Red Alert issued for Shan State conflict zone. Civilian casualties reported; humanitarian access severely restricted.', region: 'Southeast Asia', country_code: 'MM', severity: 5, occurred_at: new Date(Date.now() - 8 * 3600000).toISOString() },
  { source: 'gdelt', source_id: 'demo-004', event_type: 'political', title: 'Iran nuclear talks collapse; IAEA inspectors denied access', description: 'Vienna talks suspended following IAEA report on undisclosed enrichment activities. US Treasury considering additional sanctions package.', region: 'Middle East', country_code: 'IR', severity: 4, occurred_at: new Date(Date.now() - 12 * 3600000).toISOString() },
  { source: 'reliefweb', source_id: 'demo-005', event_type: 'conflict', title: 'Gaza ceasefire negotiations stalled; IDF operations continue', description: 'Mediators report Egyptian-brokered ceasefire framework rejected. Hostage negotiations ongoing. 340+ days of conflict.', region: 'Middle East', country_code: 'PS', severity: 5, occurred_at: new Date(Date.now() - 15 * 3600000).toISOString() },
  { source: 'gdelt', source_id: 'demo-006', event_type: 'conflict', title: 'Sahel: JNIM advances on Burkina Faso military positions', description: 'JNIM-affiliated forces conducted coordinated attacks on Burkina Faso military checkpoints. Government confirms 12 casualties.', region: 'West Africa', country_code: 'BF', severity: 4, occurred_at: new Date(Date.now() - 18 * 3600000).toISOString() },
  { source: 'nasa_eonet', source_id: 'demo-007', event_type: 'natural_disaster', title: 'Wildfire: Active fire detected in Zaporizhzhia conflict zone', description: 'NASA FIRMS thermal anomaly detected near active frontline. FRP 245 MW. Fire spread coincides with reported shelling.', region: 'Eastern Europe', country_code: 'UA', severity: 3, occurred_at: new Date(Date.now() - 20 * 3600000).toISOString() },
  { source: 'gdelt', source_id: 'demo-008', event_type: 'political', title: 'North Korea fires ballistic missile into Sea of Japan', description: 'KCNA confirmed ICBM test. Japan issued J-Alert warning. Pentagon assessing range and payload. Fourth test in 60 days.', region: 'East Asia', country_code: 'KP', severity: 4, occurred_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { source: 'unhcr', source_id: 'demo-009', event_type: 'humanitarian', title: 'Displacement surge in Ethiopia: +38% YoY (2.1M people)', description: 'UNHCR reports 2.1M refugees from Ethiopia in 2024, up 38% from prior year. Tigray reconstruction stalled; Amhara conflict ongoing.', region: 'East Africa', country_code: 'ET', severity: 3, occurred_at: new Date(Date.now() - 28 * 3600000).toISOString() },
  { source: 'gdelt', source_id: 'demo-010', event_type: 'conflict', title: 'Congo (DRC): M23 advances on Goma airport perimeter', description: 'M23 rebel forces reported within 8km of Goma International Airport. MONUSCO convoy attacked. Evacuation warnings issued.', region: 'Central Africa', country_code: 'CD', severity: 5, occurred_at: new Date(Date.now() - 30 * 3600000).toISOString() },
  { source: 'reliefweb', source_id: 'demo-011', event_type: 'conflict', title: 'Somalia: Al-Shabaab IED kills 6 on Mogadishu-Afgoye road', description: 'Vehicle-borne IED detonated on main supply route. AMISOM convoy targeted. UN suspended road movements in affected corridor.', region: 'East Africa', country_code: 'SO', severity: 4, occurred_at: new Date(Date.now() - 36 * 3600000).toISOString() },
  { source: 'gdelt', source_id: 'demo-012', event_type: 'economic', title: 'Yemen: Red Sea attack rate rises to 3.2/week', description: 'Houthi drone and missile attacks on commercial shipping maintain elevated rate. Maersk and MSC rerouting via Cape of Good Hope adding 12 days.', region: 'Middle East', country_code: 'YE', severity: 4, occurred_at: new Date(Date.now() - 40 * 3600000).toISOString() },
]

export async function POST(req: Request) {
  // Simple admin check via header
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env['SUPABASE_SERVICE_ROLE_KEY']?.slice(-8)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Only seed if empty
  const { count } = await supabase.from('events').select('id', { count: 'exact', head: true })
  if ((count ?? 0) > 0) {
    return Response.json({ ok: true, message: 'Already has data', count })
  }

  const { data, error } = await supabase.from('events').upsert(
    DEMO_EVENTS.map(e => ({
      ...e,
      status: 'pending',
      heavy_lane_processed: false,
      ingested_at: new Date().toISOString(),
    })),
    { onConflict: 'source,source_id', ignoreDuplicates: true }
  )

  return Response.json({ ok: !error, seeded: DEMO_EVENTS.length, error: error?.message ?? null })
}
