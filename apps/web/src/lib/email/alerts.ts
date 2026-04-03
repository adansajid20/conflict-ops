import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface AlertEmailParams {
  to: string
  recipientName?: string
  events: Array<{
    id: string
    title: string
    severity: number
    region: string
    source: string
    occurred_at: string
    source_id: string
  }>
  alertName?: string
  digestMode?: boolean
}

const SEVERITY_LABEL: Record<number, string> = { 4: 'CRITICAL', 3: 'HIGH', 2: 'MEDIUM', 1: 'LOW' }
const SEVERITY_COLOR: Record<number, string> = { 4: '#ef4444', 3: '#f97316', 2: '#eab308', 1: '#22c55e' }
const SEVERITY_BG: Record<number, string> = { 4: '#2d1515', 3: '#2d1a0e', 2: '#2d2810', 1: '#0e2d14' }

function eventHtml(event: AlertEmailParams['events'][0]): string {
  const sev = event.severity ?? 1
  const color = SEVERITY_COLOR[sev] ?? '#6b7280'
  const bg = SEVERITY_BG[sev] ?? '#1a1a1a'
  const label = SEVERITY_LABEL[sev] ?? 'LOW'
  const regionDisplay = event.region?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? ''
  const time = new Date(event.occurred_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  })

  return `
  <div style="border-left: 3px solid ${color}; background: ${bg}; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px;">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <span style="background: ${color}22; color: ${color}; border: 1px solid ${color}44; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em;">${label}</span>
      ${regionDisplay ? `<span style="color: #6b7280; font-size: 11px;">${regionDisplay}</span>` : ''}
      <span style="color: #4b5563; font-size: 10px; margin-left: auto;">${time}</span>
    </div>
    <p style="color: #f3f4f6; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; line-height: 1.4;">
      ${event.title}
    </p>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="color: #6b7280; font-size: 11px;">${event.source ?? 'Intelligence Feed'}</span>
      ${event.source_id ? `<a href="${event.source_id}" style="color: #3b82f6; font-size: 11px; text-decoration: none;">↗ Source</a>` : ''}
      <a href="https://conflictradar.co/feed?event=${event.id}" style="color: #3b82f6; font-size: 11px; text-decoration: none; margin-left: auto;">View →</a>
    </div>
  </div>`
}

export async function sendAlertEmail(params: AlertEmailParams): Promise<boolean> {
  const { to, recipientName, events, alertName, digestMode } = params
  if (!events.length) return false

  const subject = digestMode
    ? `ConflictRadar: ${events.length} new event${events.length > 1 ? 's' : ''} matching your alert`
    : `[${SEVERITY_LABEL[events[0]?.severity ?? 1]}] ${events[0]?.title?.slice(0, 80) ?? 'New Alert'}`

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #060a10; font-family: 'Inter', -apple-system, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #1f2937;">
      <div>
        <p style="color: #4b5563; font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; margin: 0 0 2px 0;">CONFLICTRADAR</p>
        <p style="color: #f9fafb; font-size: 16px; font-weight: 700; margin: 0;">Intelligence Alert</p>
      </div>
      ${alertName ? `<span style="margin-left: auto; background: #1f2937; color: #9ca3af; border: 1px solid #374151; padding: 4px 10px; border-radius: 4px; font-size: 11px;">${alertName}</span>` : ''}
    </div>

    <p style="color: #9ca3af; font-size: 13px; margin: 0 0 20px 0;">
      ${recipientName ? `Hey ${recipientName}, ` : ''}${digestMode ? `Here are your latest ${events.length} intelligence updates:` : 'A new event matching your alert criteria has been detected:'}
    </p>

    ${events.slice(0, 10).map(eventHtml).join('')}

    <div style="text-align: center; margin: 28px 0;">
      <a href="https://conflictradar.co/feed" style="background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-block;">
        Open Intelligence Feed →
      </a>
    </div>

    <div style="border-top: 1px solid #1f2937; padding-top: 16px; text-align: center;">
      <p style="color: #4b5563; font-size: 11px; margin: 0 0 8px 0;">
        ConflictRadar · Geopolitical Intelligence Platform
      </p>
      <p style="color: #374151; font-size: 10px; margin: 0;">
        <a href="https://conflictradar.co/settings/alerts" style="color: #4b5563; text-decoration: underline;">Manage alerts</a>
        &nbsp;·&nbsp;
        <a href="https://conflictradar.co/unsubscribe" style="color: #4b5563; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`

  try {
    const result = await resend.emails.send({
      from: 'ConflictRadar <alerts@conflictradar.co>',
      to,
      subject,
      html,
    })

    return !result.error
  } catch (err) {
    console.error('[alerts] Resend error:', err)
    return false
  }
}
