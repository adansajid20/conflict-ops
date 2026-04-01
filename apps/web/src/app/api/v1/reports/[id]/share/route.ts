import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { writeAuditLog } from '@/lib/audit/log'
import type { ApiResponse } from '@conflict-ops/shared'
import { auth } from '@clerk/nextjs/server'

export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse<ApiResponse<{ shared_token: string; share_url: string }>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: actor } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', userId).single()
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const token = crypto.randomBytes(18).toString('hex')
  const { error } = await supabase.from('intel_reports').update({ shared_token: token, updated_at: new Date().toISOString() }).eq('id', params.id).eq('org_id', actor.org_id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  await writeAuditLog(supabase, { orgId: actor.org_id, userId: actor.id, action: 'report.share', resourceType: 'intel_report', resourceId: params.id, metadata: { shared_token: token } })
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
  return NextResponse.json({ success: true, data: { shared_token: token, share_url: `${appUrl}/api/public/v1/reports/${token}` } })
}
