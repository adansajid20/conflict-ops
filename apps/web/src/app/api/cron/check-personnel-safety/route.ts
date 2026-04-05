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
  let alertsCreated = 0

  const { data: personnel } = await supabase.from('team_locations').select('*').eq('status', 'active')
  if (!personnel?.length) return NextResponse.json({ checked: 0, alerts: 0 })

  const h10m = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  for (const person of personnel) {
    try {
      const country = person.country as string
      const userId = person.org_user_id as string

      // Check risk score for their country
      const { data: riskData } = await supabase.from('country_profiles').select('risk_score,travel_advisory,conflict_intensity').ilike('country_name', `%${country}%`).limit(1).single()
      const riskScore = (riskData?.risk_score as number) ?? 0

      // Check recent critical events near their location
      const { data: critEvents } = await supabase.from('events').select('id,title,severity,region').gte('occurred_at', h10m).gte('severity', 4).ilike('region', `%${country.toLowerCase().split(' ')[0]}%`).limit(5)

      // Check active high-prob predictions for their area
      const { data: preds } = await supabase.from('predictions').select('id,title,probability').gt('expires_at', new Date().toISOString()).is('outcome', null).gte('probability', 0.65).ilike('region', `%${country.toLowerCase().split(' ')[0]}%`).limit(3)

      let alertType: string | null = null
      let title = ''
      let body = ''

      if (riskScore >= 8.5) {
        alertType = 'evacuation_recommended'
        title = `⚠️ EVACUATION RECOMMENDED: ${person.person_name} in ${country}`
        body = `Risk score ${riskScore.toFixed(1)}/10. Immediate evacuation may be advisable. Travel advisory: ${riskData?.travel_advisory ?? 'unknown'}.`
      } else if ((critEvents?.length ?? 0) > 0) {
        alertType = 'risk_spike'
        title = `🚨 CRITICAL EVENT near ${person.person_name} (${country})`
        body = `${critEvents!.length} critical event(s) detected: ${critEvents![0]?.title?.slice(0, 80) ?? 'N/A'}`
      } else if (riskScore >= 7.0) {
        alertType = 'risk_spike'
        title = `⚡ Risk elevated for ${person.person_name} in ${country}`
        body = `Risk score ${riskScore.toFixed(1)}/10. Monitor situation closely.`
      } else if ((preds?.length ?? 0) > 0) {
        alertType = 'prediction'
        title = `📊 High-probability prediction for ${country} (${person.person_name})`
        body = `${preds![0]?.title?.slice(0, 100) ?? ''} — probability ${Math.round((preds![0]?.probability as number ?? 0) * 100)}%`
      }

      if (alertType) {
        // Check cooldown: don't re-alert same person+type within 30min
        const cooldown = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const { data: recent } = await supabase.from('safety_alerts').select('id').eq('person_id', person.id).eq('alert_type', alertType).gte('created_at', cooldown).limit(1).single()
        if (!recent) {
          await supabase.from('safety_alerts').insert({
            org_user_id: userId,
            person_id: person.id,
            alert_type: alertType,
            title,
            body,
            severity: alertType === 'evacuation_recommended' ? 'critical' : 'high',
            risk_score: riskScore,
          })
          alertsCreated++
        }
      }
    } catch (e) {
      console.warn(`Personnel check failed for ${person.id}:`, e)
    }
  }

  return NextResponse.json({ checked: personnel.length, alerts: alertsCreated })
}
