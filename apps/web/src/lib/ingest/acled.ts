/**
 * ACLED — Armed Conflict Location & Event Data
 * Gold standard conflict event database used by UN, NGOs, governments.
 * Free with registration: https://developer.acleddata.com/
 *
 * Required env vars:
 *   ACLED_EMAIL — your registered email
 *   ACLED_API_KEY — your API key from acleddata.com
 *
 * If not set, this module returns { stored: 0, skipped: 0, errors: 0, disabled: true }
 */
import { createServiceClient } from '@/lib/supabase/server'

interface ACLEDEvent {
  data_id: string
  event_id_cnty: string
  event_id_no_cnty: string
  event_date: string  // 'YYYY-MM-DD'
  year: string
  time_precision: string
  event_type: string  // 'Battles' | 'Explosions/Remote violence' | 'Violence against civilians' | 'Protests' | 'Riots' | 'Strategic developments'
  sub_event_type: string
  actor1: string
  assoc_actor_1: string
  inter1: string
  actor2: string
  assoc_actor_2: string
  inter2: string
  interaction: string
  civilian_targeting: string
  iso: string  // ISO 3166-1 numeric
  region: string  // ACLED region name
  country: string
  admin1: string  // state/province
  admin2: string  // district
  admin3: string
  location: string  // city/area name
  latitude: string
  longitude: string
  geo_precision: string
  source: string
  source_scale: string
  notes: string
  fatalities: string
  tags: string
  timestamp: string  // unix
}

interface ACLEDResponse {
  status: number
  success: boolean
  count: number
  data: ACLEDEvent[]
}

// Map ACLED event type to our event_type
function mapACLEDEventType(acledType: string): string {
  const t = acledType.toLowerCase()
  if (t.includes('battle')) return 'armed_conflict'
  if (t.includes('explosion') || t.includes('remote violence')) return 'airstrike'
  if (t.includes('violence against civilian')) return 'armed_conflict'
  if (t.includes('protest')) return 'civil_unrest'
  if (t.includes('riot')) return 'civil_unrest'
  if (t.includes('strategic')) return 'political_crisis'
  return 'armed_conflict'
}

// Map fatalities + event type to severity
function mapACLEDSeverity(fatalities: string, eventType: string): 1 | 2 | 3 | 4 {
  const fat = parseInt(fatalities) || 0
  const t = eventType.toLowerCase()
  if (fat >= 50 || t.includes('explosion')) return 4
  if (fat >= 10 || t.includes('battle')) return 3
  if (fat >= 1 || t.includes('violence against civilian')) return 2
  return 1
}

// ACLED region name → our region
const ACLED_REGION_MAP: Record<string, string> = {
  'Western Africa': 'Africa',
  'Middle Africa': 'Africa',
  'Eastern Africa': 'Africa',
  'Southern Africa': 'Africa',
  'Northern Africa': 'Africa',
  'Middle East': 'Middle East',
  'South Asia': 'South Asia',
  'Southeast Asia': 'Southeast Asia',
  'East Asia': 'East Asia',
  'Central Asia': 'Central Asia',
  'Caucasus and Central Asia': 'Central Asia',
  'Europe': 'Europe',
  'Eastern Europe': 'Eastern Europe',
  'Balkans': 'Europe',
  'Latin America': 'Latin America',
  'South America': 'Latin America',
  'Caribbean': 'Latin America',
  'Central America': 'Latin America',
  'North America': 'North America',
  'Oceania': 'Asia Pacific',
}

export async function ingestACLED(): Promise<{ stored: number; skipped: number; errors: number; disabled?: boolean }> {
  const email = process.env['ACLED_EMAIL']
  const apiKey = process.env['ACLED_API_KEY']

  if (!email || !apiKey) {
    // Not configured — skip silently (don't treat as error)
    console.log('[ACLED] Skipping: ACLED_EMAIL and ACLED_API_KEY not set. Register free at https://developer.acleddata.com/')
    return { stored: 0, skipped: 0, errors: 0, disabled: true }
  }

  const supabase = createServiceClient()
  let stored = 0, skipped = 0, errors = 0

  try {
    // Fetch last 7 days of events (ACLED updates daily, but we want a window for reliability)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const dateFrom = sevenDaysAgo.toISOString().slice(0, 10) // 'YYYY-MM-DD'

    const params = new URLSearchParams({
      key: apiKey,
      email: email,
      event_date: dateFrom,
      event_date_where: 'BETWEEN',
      event_date_to: new Date().toISOString().slice(0, 10),
      limit: '500',
      // Focus on high-severity events to keep volume manageable
      'event_type': 'Battles|Explosions/Remote violence|Violence against civilians',
    })

    const res = await fetch(`https://api.acleddata.com/acled/read/?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ConflictOps/1.0 (conflictradar.co)',
      },
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) { return { stored: 0, skipped: 0, errors: 1 } }

    const data: ACLEDResponse = await res.json()
    if (!data.success) { return { stored: 0, skipped: 0, errors: 1 } }

    for (const event of data.data) {
      const source_id = `acled:${event.data_id}`
      const fatalities = parseInt(event.fatalities) || 0

      const title = [
        event.event_type,
        event.actor1 ? `involving ${event.actor1}` : '',
        `in ${event.location}, ${event.country}`,
        fatalities > 0 ? `(${fatalities} fatalities)` : '',
      ].filter(Boolean).join(' ')

      const description = event.notes?.slice(0, 1000) || title

      const { error } = await supabase.from('events').upsert({
        source: 'acled',
        source_id,
        event_type: mapACLEDEventType(event.event_type),
        title: title.slice(0, 500),
        description,
        region: ACLED_REGION_MAP[event.region] ?? event.region ?? null,
        country_code: null, // ACLED doesn't give ISO2, would need lookup table
        severity: mapACLEDSeverity(event.fatalities, event.event_type),
        status: 'confirmed', // ACLED events are verified
        occurred_at: new Date(event.event_date).toISOString(),
        heavy_lane_processed: false,
        provenance_raw: {
          source: 'ACLED',
          attribution: 'Armed Conflict Location & Event Data Project (ACLED)',
          url: 'https://acleddata.com',
          actor1: event.actor1,
          actor2: event.actor2,
          fatalities,
          admin1: event.admin1,
          location: event.location,
          geo_precision: event.geo_precision,
          acled_source: event.source,
        } as Record<string, unknown>,
        raw: event as unknown as Record<string, unknown>,
      }, { onConflict: 'source,source_id', ignoreDuplicates: true })

      if (error) skipped++
      else stored++
    }
  } catch (e) {
    console.error('[ACLED] Error:', e)
    errors++
  }

  return { stored, skipped, errors }
}
