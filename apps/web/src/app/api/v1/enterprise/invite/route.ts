import crypto from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { sendInviteEmail } from '@/lib/email/invite'
import { writeAuditLog } from '@/lib/audit/log'
import type { ApiResponse } from '@conflict-ops/shared'

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'analyst', 'viewer']),
})

type InviteRecord = {
  id: string
  email: string
  role: string
  token: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

async function getAdminContext(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('id,email,org_id,role')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (!data?.org_id || !['owner', 'admin'].includes(String(data.role ?? ''))) {
    return null
  }

  return data
}

export async function GET(): Promise<NextResponse<ApiResponse<InviteRecord[]>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminContext(userId)
  if (!admin?.org_id) return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('org_invites')
    .select('id,email,role,token,created_at,expires_at,accepted_at')
    .eq('org_id', admin.org_id)
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: (data ?? []) as InviteRecord[] })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<InviteRecord>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const admin = await getAdminContext(userId)
  if (!admin?.org_id) return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = InviteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const limits = await getOrgPlanLimits(admin.org_id)
  const { data: org, error: orgError } = await supabase
    .from('orgs')
    .select('id,name,seats_used,seats_limit')
    .eq('id', admin.org_id)
    .single()

  if (orgError || !org) return NextResponse.json({ success: false, error: orgError?.message ?? 'Org not found' }, { status: 500 })

  const seatLimit = Number(org.seats_limit ?? limits.maxMembers)
  const seatUsed = Number(org.seats_used ?? 0)
  if (seatLimit !== -1 && seatUsed >= seatLimit) {
    return NextResponse.json({ success: false, error: 'Seat limit reached for this organization.' }, { status: 403 })
  }

  const existingPending = await supabase
    .from('org_invites')
    .select('id,email,role,token,created_at,expires_at,accepted_at')
    .eq('org_id', admin.org_id)
    .eq('email', parsed.data.email.toLowerCase())
    .is('accepted_at', null)
    .maybeSingle()

  if (existingPending.data) {
    return NextResponse.json({ success: true, data: existingPending.data as InviteRecord })
  }

  const token = crypto.randomBytes(24).toString('hex')
  const { data, error } = await supabase
    .from('org_invites')
    .insert({
      org_id: admin.org_id,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      token,
      invited_by: admin.id,
    })
    .select('id,email,role,token,created_at,expires_at,accepted_at')
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Failed to create invite' }, { status: 500 })

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  await sendInviteEmail({
    to: parsed.data.email,
    orgName: String(org.name ?? 'CONFLICT OPS'),
    role: parsed.data.role,
    inviteUrl: `${appUrl}/api/v1/enterprise/invite/accept?token=${token}`,
    invitedByEmail: admin.email ?? null,
  })

  await writeAuditLog(supabase, {
    orgId: admin.org_id,
    userId: admin.id,
    action: 'org.invite.created',
    resourceType: 'org_invite',
    resourceId: data.id,
    metadata: { email: data.email, role: data.role },
  })

  return NextResponse.json({ success: true, data: data as InviteRecord }, { status: 201 })
}
