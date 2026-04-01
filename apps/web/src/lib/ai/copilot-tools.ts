import { createServiceClient } from '@/lib/supabase/server'

export type CopilotToolName = 'search_events' | 'get_mission' | 'get_forecast' | 'get_alerts'

export type SearchEventsInput = {
  org_id: string
  query?: string
  country_code?: string
  region?: string
  severity_gte?: number
  hours?: number
  limit?: number
}

export type GetMissionInput = {
  org_id: string
  mission_id?: string
  mission_name?: string
}

export type GetForecastInput = {
  org_id: string
  region?: string
  country_code?: string
  horizon_days?: number
}

export type GetAlertsInput = {
  org_id: string
  severity_gte?: number
  unread_only?: boolean
  limit?: number
}

function safeLimit(limit: number | undefined, fallback: number, max: number): number {
  const value = Number(limit ?? fallback)
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.floor(value), 1), max)
}

export async function searchEvents(input: SearchEventsInput): Promise<Record<string, unknown>> {
  const supabase = createServiceClient()
  const hours = safeLimit(input.hours, 168, 24 * 30)
  const limit = safeLimit(input.limit, 8, 25)
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('events')
    .select('id,title,description,event_type,severity,region,country_code,occurred_at,ingested_at')
    .gte('ingested_at', since)
    .order('ingested_at', { ascending: false })
    .limit(limit)

  if (input.country_code) query = query.eq('country_code', input.country_code.toUpperCase())
  if (input.region) query = query.ilike('region', `%${input.region}%`)
  if (typeof input.severity_gte === 'number') query = query.gte('severity', input.severity_gte)
  if (input.query) query = query.or(`title.ilike.%${input.query}%,description.ilike.%${input.query}%`)

  const { data, error } = await query
  if (error) {
    return { tool: 'search_events', error: error.message, events: [] }
  }

  return { tool: 'search_events', events: data ?? [] }
}

export async function getMission(input: GetMissionInput): Promise<Record<string, unknown>> {
  const supabase = createServiceClient()
  let query = supabase
    .from('missions')
    .select('id,name,description,regions,tags,created_at,updated_at')
    .eq('org_id', input.org_id)
    .limit(1)

  if (input.mission_id) {
    query = query.eq('id', input.mission_id)
  } else if (input.mission_name) {
    query = query.ilike('name', `%${input.mission_name}%`)
  }

  const { data, error } = await query
  if (error) return { tool: 'get_mission', error: error.message, mission: null }
  return { tool: 'get_mission', mission: data?.[0] ?? null }
}

export async function getForecast(input: GetForecastInput): Promise<Record<string, unknown>> {
  const supabase = createServiceClient()
  let query = supabase
    .from('forecasts')
    .select('id,region,country_code,horizon_days,score,confidence,event_count,computed_at,factors')
    .eq('horizon_days', input.horizon_days ?? 30)
    .order('computed_at', { ascending: false })
    .limit(5)

  if (input.country_code) query = query.eq('country_code', input.country_code.toUpperCase())
  if (input.region) query = query.ilike('region', `%${input.region}%`)

  const { data, error } = await query
  if (error) return { tool: 'get_forecast', error: error.message, forecasts: [] }
  return { tool: 'get_forecast', forecasts: data ?? [] }
}

export async function getAlerts(input: GetAlertsInput): Promise<Record<string, unknown>> {
  const supabase = createServiceClient()
  let query = supabase
    .from('alerts')
    .select('id,title,body,severity,read,delivered_at,metadata')
    .eq('org_id', input.org_id)
    .order('delivered_at', { ascending: false })
    .limit(safeLimit(input.limit, 8, 25))

  if (typeof input.severity_gte === 'number') query = query.gte('severity', input.severity_gte)
  if (input.unread_only) query = query.eq('read', false)

  const { data, error } = await query
  if (error) return { tool: 'get_alerts', error: error.message, alerts: [] }
  return { tool: 'get_alerts', alerts: data ?? [] }
}

export const copilotTools = {
  search_events: searchEvents,
  get_mission: getMission,
  get_forecast: getForecast,
  get_alerts: getAlerts,
}
