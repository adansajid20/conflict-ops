export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAlertEmail } from '@/lib/email/alerts'

type AlertRow = {
  id: string
  email: string
  name: string | null
  conditions: {
    severity_min?: number
    regions?: string[]
    event_types?: string[]
    keywords?: string[]
  } | null
}

type EventRow = {
  id: string
  title: string
  severity: number
  region: string
  source: string
  source_id: string
  occurred_at: string
  event_type?: string | null
}

const CRON_SECRET = process.env.INTERNAL_SECRET ?? ''

function isMissingAlertsTable(error: { message?: string; code?: string } | null | undefined) {
  const message = `${error?.message ?? ''}`.toLowerCase()
  return error?.code === '42P01' || message.includes('relation') && message.includes('alerts') && message.includes('does not exist')
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (token !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: alerts, error: alertsError } = await supabase
    .from('email_subscriptions')
    .select('id,email,name,conditions')
    .eq('is_active', true)
    .eq('frequency', 'realtime')

  if (isMissingAlertsTable(alertsError)) {
    return NextResponse.json({ sent: 0, alertsChecked: 0, reason: 'alerts table missing' })
  }

  if (alertsError) return NextResponse.json({ error: alertsError.message }, { status: 500 })
  if (!alerts?.length) return NextResponse.json({ sent: 0, alertsChecked: 0, reason: 'no active alerts' })

  const { data: newEvents, error: eventsError } = await supabase
    .from('events')
    .select('id,title,severity,region,source,source_id,occurred_at,event_type')
    .gte('ingested_at', since)
    .order('occurred_at', { ascending: false })
    .limit(100)

  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 })
  if (!newEvents?.length) return NextResponse.json({ sent: 0, alertsChecked: alerts.length, newEvents: 0, reason: 'no new events' })

  let sent = 0
  for (const alert of alerts as AlertRow[]) {
    const cond = alert.conditions ?? {}
    const matched = (newEvents as EventRow[]).filter((event) => {
      if (cond.severity_min && event.severity < cond.severity_min) return false
      if (cond.regions?.length && !cond.regions.includes(event.region)) return false
      if (cond.event_types?.length && !cond.event_types.includes(event.event_type ?? '')) return false
      if (cond.keywords?.length) {
        const text = `${event.title ?? ''} ${event.source ?? ''}`.toLowerCase()
        if (!cond.keywords.some((kw) => text.includes(kw.toLowerCase()))) return false
      }
      return true
    })

    if (!matched.length) continue

    const ok = await sendAlertEmail({
      to: alert.email,
      recipientName: alert.name ?? undefined,
      events: matched,
      alertName: alert.name ?? undefined,
      digestMode: false,
    })

    if (ok) {
      sent += 1
      await supabase.from('email_subscriptions').update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', alert.id)
    }
  }

  return NextResponse.json({ sent, alertsChecked: alerts.length, newEvents: newEvents.length })
}
