import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getOrgId(userId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  return data?.org_id as string | null
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const orgId = await getOrgId(userId)
  if (!orgId) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('pirs').delete().eq('id', params.id).eq('org_id', orgId)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
