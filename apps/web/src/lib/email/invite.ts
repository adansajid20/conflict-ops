import { sendEmail } from '@/lib/email/client'

type SendInviteEmailParams = {
  to: string
  orgName: string
  role: string
  inviteUrl: string
  invitedByEmail?: string | null
}

export async function sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
  if (!process.env['RESEND_API_KEY']) {
    console.warn('[invite-email] RESEND_API_KEY missing; skipping email send')
    return
  }

  const html = `
    <div style="background:#0D1117;color:#F1F5F9;padding:32px;font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="font-size:12px;letter-spacing:0.16em;color:#60A5FA;margin-bottom:16px">CONFLICT OPS</div>
      <h1 style="font-size:24px;margin:0 0 12px">You're invited to join ${params.orgName}</h1>
      <p style="color:#94A3B8;line-height:1.6">${params.invitedByEmail ?? 'A workspace admin'} invited you to join <strong>${params.orgName}</strong> as <strong>${params.role}</strong>.</p>
      <p style="color:#94A3B8;line-height:1.6">Use the secure link below to accept your invitation.</p>
      <a href="${params.inviteUrl}" style="display:inline-block;background:#2563EB;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Accept invite</a>
      <p style="color:#64748B;font-size:12px;margin-top:20px">If the button fails, paste this URL into your browser:<br/>${params.inviteUrl}</p>
    </div>
  `

  const response = await sendEmail({
    to: params.to,
    template: 'welcome',
    data: { subject: `Invitation to join ${params.orgName}`, html },
  })

  if (!response.ok) {
    console.warn('[invite-email] failed to send invite', response.error)
  }
}
