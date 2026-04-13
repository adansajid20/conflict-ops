import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

const PatchSchema = z.object({ read: z.boolean().optional(), markAll: z.boolean().optional() })

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse<ApiResponse<null>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', userId).single()
  if (!user?.id || !user.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { body = { read: true } }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  if (parsed.data.markAll) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('org_id', user.org_id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: null })
  }

  const { error } = await supabase.from('notifications').update({ read: parsed.data.read ?? true }).eq('id', params.id).eq('user_id', user.id).eq('org_id', user.org_id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: null })
}
