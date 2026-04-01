/**
 * Organization Management API — Enterprise
 * Seat management, role assignment, SSO config, tenant controls
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { z } from 'zod'
import { writeAuditLog } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

const UpdateMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'analyst', 'viewer']),
})

const SSOConfigSchema = z.object({
  provider: z.enum(['saml', 'oidc']),
  metadata_url: z.string().url().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  domain: z.string(),
})

async function requireAdmin(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('id,org_id,role')
    .eq('clerk_user_id', userId)
    .single()
  if (!data?.org_id) return null
  if (!['admin','owner'].includes(data.role as string)) return null
  return data
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const [orgResult, membersResult] = await Promise.all([
    supabase.from('orgs').select('id,name,plan_id,subscription_status,seats_used,seats_limit,sso_enabled,sso_provider,created_at').eq('id', user.org_id).single(),
    supabase.from('users').select('id,email,role,created_at,last_active').eq('org_id', user.org_id).order('created_at'),
  ])

  return NextResponse.json({
    success: true,
    data: {
      org: orgResult.data,
      members: membersResult.data ?? [],
    },
  })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await requireAdmin(userId)
  if (!admin) return NextResponse.json({ error: 'Admin role required' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const b = body as Record<string, unknown>

  const supabase = createServiceClient()
  const action = b['action'] as string

  // Update member role
  if (action === 'update_member') {
    const parsed = UpdateMemberSchema.safeParse(b)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    await supabase.from('users').update({ role: parsed.data.role }).eq('id', parsed.data.user_id).eq('org_id', admin.org_id)
    await writeAuditLog(supabase, { orgId: admin.org_id, userId: admin.id, action: 'member.role.update', resourceType: 'user', resourceId: parsed.data.user_id, metadata: { role: parsed.data.role } })
    return NextResponse.json({ success: true, data: null })
  }

  // Remove member
  if (action === 'remove_member') {
    const memberId = b['user_id'] as string
    await supabase.from('users').update({ org_id: null, role: 'viewer' }).eq('id', memberId).eq('org_id', admin.org_id)
    return NextResponse.json({ success: true, data: null })
  }

  // Configure SSO (Enterprise only)
  if (action === 'configure_sso') {
    const limits = await getOrgPlanLimits(admin.org_id)
    if (!limits.ssoSaml) return NextResponse.json({ error: 'SSO requires Enterprise plan.' }, { status: 403 })

    const parsed = SSOConfigSchema.safeParse(b['config'])
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    await supabase.from('orgs').update({
      sso_enabled: true,
      sso_provider: parsed.data.provider,
      sso_config: {
        provider: parsed.data.provider,
        metadata_url: parsed.data.metadata_url ?? null,
        client_id: parsed.data.client_id ?? null,
        domain: parsed.data.domain,
      },
    }).eq('id', admin.org_id)

    return NextResponse.json({ success: true, data: null })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
