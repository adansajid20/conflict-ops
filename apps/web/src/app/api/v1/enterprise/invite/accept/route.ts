import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ensureUserProvisioned } from '@/lib/user/provision'

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/overview?invite=missing', req.url))
  }

  const { userId } = await safeAuth()
  if (!userId) {
    return NextResponse.redirect(new URL(`/sign-up?redirect_url=${encodeURIComponent(`/api/v1/enterprise/invite/accept?token=${token}`)}`, req.url))
  }

  const provisioned = await ensureUserProvisioned(userId)
  const supabase = createServiceClient()
  const { data: invite } = await supabase
    .from('org_invites')
    .select('id,org_id,email,role,expires_at,accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite || invite.accepted_at) {
    return NextResponse.redirect(new URL('/overview?invite=invalid', req.url))
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.redirect(new URL('/overview?invite=expired', req.url))
  }

  const { data: user } = await supabase
    .from('users')
    .select('id,email')
    .eq('id', provisioned.userId)
    .single()

  if (!user || user.email.toLowerCase() !== String(invite.email).toLowerCase()) {
    return NextResponse.json({ success: false, error: 'This invite was sent to a different email address' }, { status: 403 })
  }

  await supabase.from('users').update({ org_id: invite.org_id, role: invite.role }).eq('id', user.id)
  await supabase.from('org_invites').update({ accepted_by: user.id, accepted_at: new Date().toISOString() }).eq('id', invite.id)
  try {
    await supabase.rpc('increment_org_seats', { org_id_input: invite.org_id })
  } catch {
    // best-effort only; some environments may not have the helper RPC deployed yet
  }

  return NextResponse.redirect(new URL('/overview?invite=accepted', req.url))
}
