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
  let collected = 0

  // IODA API
  try {
    const res = await fetch('https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/country?from=-1h', { signal: AbortSignal.timeout(15000) })
    if (res.ok) {
      const data = await res.json() as { data?: Array<{ score?: number; entity?: { code: string; name: string } }> }
      for (const signal of data.data ?? []) {
        if ((signal.score ?? 0) > -3) continue
        const score = signal.score ?? 0
        const severity = score < -7 ? 'total' : score < -5 ? 'major' : 'partial'
        const country = signal.entity?.name ?? 'Unknown'

        await supabase.from('internet_outages').insert({
          country: signal.entity?.code ?? 'XX', region: country,
          start_time: new Date().toISOString(), severity, source: 'ioda',
        })

        await supabase.from('events').upsert({
          title: `Internet outage detected in ${country} — ${severity} disruption`,
          description: `IODA detected a ${severity} connectivity drop in ${country}. Score: ${score}. Government-imposed internet shutdowns often precede or accompany military operations or protest crackdowns.`,
          source_id: `conflictradar://outage/${signal.entity?.code}/${Date.now()}`,
          source: 'IODA/ConflictRadar', severity: severity === 'total' ? 4 : 3,
          event_type: 'political', region: country,
          enriched: true, enriched_at: new Date().toISOString(),
        }, { onConflict: 'source_id', ignoreDuplicates: true })
        collected++
      }
    }
  } catch (e) { console.warn('IODA error:', e) }

  // Cloudflare Radar (optional backup)
  if (process.env.CLOUDFLARE_API_TOKEN) {
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/radar/annotations/outages?limit=20&dateRange=1h', {
        headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const data = await res.json() as { result?: { annotations?: Array<{ locations?: string[]; startDate?: string; endDate?: string }> } }
        for (const outage of data.result?.annotations ?? []) {
          await supabase.from('internet_outages').insert({
            country: outage.locations?.[0] ?? 'Unknown',
            start_time: outage.startDate ?? new Date().toISOString(),
            end_time: outage.endDate ?? null, severity: 'major', source: 'cloudflare',
          })
          collected++
        }
      }
    } catch { /* optional */ }
  }

  await supabase.from('tracking_stats').upsert({ stat_type: 'outages', count: collected, updated_at: new Date().toISOString() }, { onConflict: 'stat_type' })
  return NextResponse.json({ collected })
}
