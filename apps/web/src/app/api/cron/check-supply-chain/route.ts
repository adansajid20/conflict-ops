export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function authOk(req: NextRequest) {
  return new URL(req.url).searchParams.get('token') === process.env.INTERNAL_SECRET
}

async function callHaiku(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json() as { content?: Array<{ text?: string }> }
    return data.content?.[0]?.text ?? ''
  } catch {
    return ''
  }
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const h15m = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const h24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let alertsCreated = 0

  const { data: nodes } = await supabase.from('supply_chain_nodes').select('*')
  if (!nodes?.length) return NextResponse.json({ checked: 0, alerts: 0 })

  for (const node of nodes) {
    try {
      const region = (node.region ?? node.country ?? '') as string
      const userId = node.user_id as string
      const criticality = node.criticality as string

      const minRisk = criticality === 'critical' ? 5.0 : criticality === 'high' ? 6.0 : 7.0

      // Check country risk profile
      const { data: profile } = await supabase.from('country_profiles').select('risk_score,conflict_intensity').ilike('country_name', `%${node.country ?? ''}%`).limit(1).single()
      const riskScore = (profile?.risk_score as number) ?? 0

      // Check recent events near this node
      const { data: events } = await supabase.from('events').select('id,title,severity,region,occurred_at').gte('occurred_at', h24h).gte('severity', 3).ilike('region', `%${region.split('_')[0]}%`).limit(5)

      // Check active predictions
      const { data: preds } = await supabase.from('predictions').select('id,title,probability').gt('expires_at', new Date().toISOString()).is('outcome', null).gte('probability', 0.6).ilike('region', `%${region.split('_')[0]}%`).limit(3)

      const isThreatenened = riskScore >= minRisk || (events?.length ?? 0) > 0 || (preds?.length ?? 0) > 0

      if (isThreatenened) {
        // Cooldown: 1 alert per node per hour
        const cooldown = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: recent } = await supabase.from('supply_chain_alerts').select('id').eq('node_id', node.id).gte('created_at', cooldown).limit(1).single()
        if (recent) continue

        const eventCount = events?.length ?? 0
        const topEvent = events?.[0]
        const topPred = preds?.[0]

        const impact = await callHaiku(
          `In 2 sentences, assess the supply chain impact on a ${node.node_type} called "${node.node_name}" in ${node.country ?? region}: ` +
          `Risk score ${riskScore.toFixed(1)}/10, ${eventCount} recent events${topEvent ? ` including "${topEvent.title}"` : ''}.`
        )

        await supabase.from('supply_chain_alerts').insert({
          user_id: userId,
          node_id: node.id,
          event_id: topEvent?.id ?? null,
          prediction_id: topPred?.id ?? null,
          title: `Supply chain threat: ${node.node_name} (${node.country ?? region})`,
          impact_assessment: impact || `Risk score ${riskScore.toFixed(1)} detected for ${node.node_name}. ${eventCount} recent events in the area.`,
          severity: riskScore >= 8 ? 'critical' : riskScore >= 6 ? 'high' : 'medium',
        })
        alertsCreated++
      }
    } catch (e) {
      console.warn(`Supply chain check failed for node ${node.id}:`, e)
    }
  }

  return NextResponse.json({ checked: nodes.length, alerts: alertsCreated })
}
