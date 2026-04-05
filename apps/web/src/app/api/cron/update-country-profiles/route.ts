export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

// Map region slug → ISO country codes + display names
const COUNTRY_MAP: Array<{ code: string; name: string; region: string }> = [
  { code: 'UA', name: 'Ukraine', region: 'eastern_europe' },
  { code: 'RU', name: 'Russia', region: 'eastern_europe' },
  { code: 'IL', name: 'Israel', region: 'middle_east' },
  { code: 'PS', name: 'Palestine', region: 'middle_east' },
  { code: 'IR', name: 'Iran', region: 'middle_east' },
  { code: 'YE', name: 'Yemen', region: 'middle_east' },
  { code: 'SY', name: 'Syria', region: 'middle_east' },
  { code: 'IQ', name: 'Iraq', region: 'middle_east' },
  { code: 'LB', name: 'Lebanon', region: 'middle_east' },
  { code: 'SD', name: 'Sudan', region: 'sub_saharan_africa' },
  { code: 'SO', name: 'Somalia', region: 'sub_saharan_africa' },
  { code: 'MM', name: 'Myanmar', region: 'south_asia' },
  { code: 'CN', name: 'China', region: 'east_asia' },
  { code: 'KP', name: 'North Korea', region: 'east_asia' },
  { code: 'PK', name: 'Pakistan', region: 'south_asia' },
  { code: 'AF', name: 'Afghanistan', region: 'south_asia' },
  { code: 'LY', name: 'Libya', region: 'north_africa' },
  { code: 'ET', name: 'Ethiopia', region: 'sub_saharan_africa' },
  { code: 'ML', name: 'Mali', region: 'sub_saharan_africa' },
  { code: 'TD', name: 'Chad', region: 'sub_saharan_africa' },
]

async function callHaiku(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json() as { content?: Array<{ text?: string }> }
    return data.content?.[0]?.text ?? ''
  } catch {
    return ''
  }
}

function travelAdvisory(risk: number): string {
  if (risk >= 8) return 'do_not_travel'
  if (risk >= 6) return 'reconsider'
  if (risk >= 4) return 'caution'
  return 'safe'
}

function conflictIntensity(events: number, maxSev: number): string {
  if (maxSev >= 4 && events >= 10) return 'war'
  if (maxSev >= 3 && events >= 5) return 'high'
  if (maxSev >= 2 && events >= 2) return 'medium'
  if (events >= 1) return 'low'
  return 'none'
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const now = new Date()
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let updated = 0

  for (const country of COUNTRY_MAP) {
    try {
      // Get event counts + max severity
      const [{ count: count7d, data: events7d }, { count: count30d }] = await Promise.all([
        supabase.from('events').select('severity', { count: 'exact' }).ilike('region', `%${country.region}%`).gte('occurred_at', d7),
        supabase.from('events').select('id', { count: 'exact', head: true }).ilike('region', `%${country.region}%`).gte('occurred_at', d30),
      ])

      const maxSev = Math.max(...(events7d ?? []).map(e => (e.severity as number) ?? 1), 1)
      const evCount7d = count7d ?? 0
      const evCount30d = count30d ?? 0

      // Risk sub-scores (heuristic based on event data)
      const baseSeverity = maxSev / 4
      const political_stability = Math.max(0, 10 - evCount7d * 0.3 - baseSeverity * 4)
      const internal_security = Math.max(0, 10 - evCount7d * 0.4 - baseSeverity * 3)
      const external_threats = Math.max(0, 10 - baseSeverity * 5)
      const economic_risk = Math.max(0, 10 - evCount7d * 0.2 - baseSeverity * 2)
      const infrastructure_risk = Math.max(0, 10 - baseSeverity * 3)
      const civil_liberties = Math.max(0, 10 - evCount7d * 0.15 - baseSeverity * 2)

      // Weighted risk score
      const risk_score = Math.min(10,
        (10 - political_stability) * 0.3 +
        (10 - internal_security) * 0.25 +
        (10 - external_threats) * 0.2 +
        (10 - economic_risk) * 0.1 +
        (10 - infrastructure_risk) * 0.08 +
        (10 - civil_liberties) * 0.07
      )

      // Get active predictions and correlations
      const [{ count: activePreds }, { count: activeCorrs }] = await Promise.all([
        supabase.from('predictions').select('id', { count: 'exact', head: true }).ilike('region', `%${country.region}%`).gt('expires_at', now.toISOString()).is('outcome', null),
        supabase.from('correlation_signals').select('id', { count: 'exact', head: true }).ilike('region', `%${country.region}%`).gt('detected_at', d7),
      ])

      // AI summary (only if risk is significant)
      let ai_summary = ''
      if (evCount7d > 0) {
        ai_summary = await callHaiku(
          `Write a 2-sentence intelligence brief for ${country.name} (${country.code}). ` +
          `Data: ${evCount7d} events in 7 days, max severity ${maxSev}/4, risk score ${risk_score.toFixed(1)}/10, ` +
          `${activePreds} active predictions, conflict intensity: ${conflictIntensity(evCount7d, maxSev)}.`
        )
      }

      await supabase.from('country_profiles').upsert({
        country_code: country.code,
        country_name: country.name,
        risk_score: Math.round(risk_score * 10) / 10,
        political_stability: Math.round(political_stability * 10) / 10,
        internal_security: Math.round(internal_security * 10) / 10,
        external_threats: Math.round(external_threats * 10) / 10,
        economic_risk: Math.round(economic_risk * 10) / 10,
        infrastructure_risk: Math.round(infrastructure_risk * 10) / 10,
        civil_liberties: Math.round(civil_liberties * 10) / 10,
        conflict_intensity: conflictIntensity(evCount7d, maxSev),
        active_predictions: activePreds ?? 0,
        active_correlations: activeCorrs ?? 0,
        event_count_7d: evCount7d,
        event_count_30d: evCount30d,
        travel_advisory: travelAdvisory(risk_score),
        ai_summary: ai_summary || null,
        last_updated: now.toISOString(),
      }, { onConflict: 'country_code' })
      updated++
    } catch (e) {
      console.warn(`Country profile failed for ${country.code}:`, e)
    }
  }

  return NextResponse.json({ updated })
}
