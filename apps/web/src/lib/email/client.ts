/**
 * Email notifications via Resend
 * Free tier: 3,000 emails/month — plenty for early users
 * Env: RESEND_API_KEY
 *
 * Templates:
 * - alert_triggered: when a PIR alert fires
 * - welcome: new user onboarding
 * - weekly_brief: scheduled situation report
 * - trial_ending: 3 days before trial expires
 */

export type EmailTemplate =
  | 'alert_triggered'
  | 'welcome'
  | 'weekly_brief'
  | 'trial_ending'

export type SendEmailParams = {
  to: string
  template: EmailTemplate
  data: Record<string, unknown>
}

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'CONFLICT OPS <noreply@conflictops.com>'

function buildSubject(template: EmailTemplate, data: Record<string, unknown>): string {
  switch (template) {
    case 'alert_triggered': return `⚠ ALERT: ${data['alert_name'] ?? 'PIR threshold crossed'}`
    case 'welcome': return '✓ Welcome to CONFLICT OPS — Your access is ready'
    case 'weekly_brief': return `CONFLICT OPS Weekly Brief — ${data['week'] ?? new Date().toDateString()}`
    case 'trial_ending': return '⏳ Your CONFLICT OPS trial ends in 3 days'
  }
}

function buildHtml(template: EmailTemplate, data: Record<string, unknown>): string {
  const base = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { background: #0a0e14; color: #c9d1d9; font-family: monospace; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .header { border-bottom: 1px solid #21262d; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { color: #58a6ff; font-size: 18px; font-weight: bold; letter-spacing: 4px; }
  .badge { display: inline-block; background: #1f6feb20; color: #58a6ff; border: 1px solid #1f6feb40; padding: 4px 10px; font-size: 11px; letter-spacing: 2px; border-radius: 4px; margin-bottom: 16px; }
  h2 { color: #e6edf3; font-size: 22px; margin: 0 0 12px; }
  p { color: #8b949e; line-height: 1.6; font-size: 14px; }
  .btn { display: inline-block; background: #1f6feb; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; margin-top: 20px; }
  .stat { background: #161b22; border: 1px solid #21262d; border-radius: 6px; padding: 16px; margin: 8px 0; }
  .stat-val { color: #58a6ff; font-size: 24px; font-weight: bold; }
  .stat-label { color: #484f58; font-size: 11px; letter-spacing: 2px; margin-top: 4px; }
  .footer { border-top: 1px solid #21262d; margin-top: 40px; padding-top: 16px; font-size: 11px; color: #484f58; }
</style></head>
<body><div class="wrap">
  <div class="header"><div class="logo">CONFLICT OPS</div></div>
  ${content}
  <div class="footer">CONFLICT OPS // UNCLASSIFIED // OPERATOR USE ONLY<br>You're receiving this because you have an active CONFLICT OPS account.</div>
</div></body>
</html>`

  switch (template) {
    case 'welcome':
      return base(`
        <div class="badge">WELCOME OPERATOR</div>
        <h2>Your access is ready</h2>
        <p>Welcome to CONFLICT OPS. You now have access to real-time conflict intelligence, forecasting tools, and the analysis workbench.</p>
        <p>Your 14-day trial starts now. No credit card required.</p>
        <p><strong style="color:#e6edf3">What to do first:</strong></p>
        <p>1. Open the <strong style="color:#e6edf3">Intel Feed</strong> — live conflict events updated every 15 minutes<br>
        2. Create a <strong style="color:#e6edf3">Mission</strong> — define your area of interest and PIR<br>
        3. Set <strong style="color:#e6edf3">Alerts</strong> — get notified when thresholds are crossed</p>
        <a href="https://conflict-ops.vercel.app" class="btn">Open Dashboard →</a>
      `)

    case 'alert_triggered':
      return base(`
        <div class="badge">⚠ ALERT TRIGGERED</div>
        <h2>${data['alert_name'] ?? 'PIR Alert'}</h2>
        <div class="stat">
          <div class="stat-val">${data['escalation_level'] ?? 'ELEVATED'}</div>
          <div class="stat-label">ESCALATION LEVEL</div>
        </div>
        <div class="stat">
          <div class="stat-val">${data['event_count'] ?? '—'}</div>
          <div class="stat-label">EVENTS IN TRIGGER WINDOW</div>
        </div>
        <p>${data['description'] ?? 'A Priority Intelligence Requirement threshold has been crossed.'}</p>
        <p>Region: <strong style="color:#e6edf3">${data['region'] ?? 'Unknown'}</strong></p>
        <a href="https://conflict-ops.vercel.app/alerts" class="btn">View Alert →</a>
      `)

    case 'trial_ending':
      return base(`
        <div class="badge">⏳ TRIAL ENDING</div>
        <h2>3 days left on your trial</h2>
        <p>Your CONFLICT OPS trial ends in 3 days. Upgrade to keep your missions, alerts, and analysis history.</p>
        <p>Start at <strong style="color:#e6edf3">$29/month</strong> for Individual access, or <strong style="color:#e6edf3">$99/month</strong> for Pro with full workbench access.</p>
        <a href="https://conflict-ops.vercel.app/settings/billing" class="btn">Upgrade Now →</a>
      `)

    case 'weekly_brief':
      return base(`
        <div class="badge">WEEKLY BRIEF</div>
        <h2>Situation Report — ${data['week'] ?? ''}</h2>
        <div class="stat"><div class="stat-val">${data['events_this_week'] ?? 0}</div><div class="stat-label">EVENTS THIS WEEK</div></div>
        <div class="stat"><div class="stat-val">${data['active_alerts'] ?? 0}</div><div class="stat-label">ACTIVE ALERTS</div></div>
        <div class="stat"><div class="stat-val">${data['top_region'] ?? '—'}</div><div class="stat-label">HIGHEST ACTIVITY REGION</div></div>
        <p>${data['summary'] ?? 'Review your full situation dashboard for detailed analysis.'}</p>
        <a href="https://conflict-ops.vercel.app" class="btn">Open Dashboard →</a>
      `)
  }
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env['RESEND_API_KEY']
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured' }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: params.to,
        subject: buildSubject(params.template, params.data),
        html: buildHtml(params.template, params.data),
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.text()
      return { ok: false, error: err }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
