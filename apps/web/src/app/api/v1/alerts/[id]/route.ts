import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getOrgId(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  return data?.org_id as string | null
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  let body: { read?: boolean; dismissed?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.read === 'boolean') {
    updates.read = body.read
    updates.read_at = body.read ? new Date().toISOString() : null
  }
  if (typeof body.dismissed === 'boolean') {
    updates.dismissed = body.dismissed
    updates.dismissed_at = body.dismissed ? new Date().toISOString() : null
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('alerts')
    .update(updates)
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
