export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const checks: Record<string, unknown> = {}
  let healthy = true

  // DB check
  try {
    const supabase = createServiceClient()
    const { count, error } = await supabase.from('events').select('*', { count: 'exact', head: true }).gte('occurred_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    checks.db = error ? { ok: false, error: error.message } : { ok: true, recent_events: count }
    if (error) healthy = false
  } catch (e) {
    checks.db = { ok: false, error: String(e) }
    healthy = false
  }

  // Ingest freshness
  try {
    const supabase = createServiceClient()
    const { data } = await supabase.from('events').select('occurred_at').order('occurred_at', { ascending: false }).limit(1).single()
    const ageMin = data ? Math.round((Date.now() - new Date(data.occurred_at ?? '').getTime()) / 60000) : 999
    checks.ingest_freshness = { ok: ageMin < 30, age_minutes: ageMin }
    if (ageMin > 60) healthy = false
  } catch {
    checks.ingest_freshness = { ok: false }
  }

  checks.timestamp = new Date().toISOString()

  return NextResponse.json({ healthy, checks }, { status: healthy ? 200 : 503 })
}
