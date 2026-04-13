import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'

const Schema = z.object({ overage_policy: z.enum(['allow', 'cap', 'notify']) })

async function getUser(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id,role').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function POST(req: Request) {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  if (!['owner', 'admin'].includes(String(user.role))) return NextResponse.json({ success: false, error: 'Owner or admin role required' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('orgs').update({ overage_policy: parsed.data.overage_policy }).eq('id', user.org_id).select('overage_policy').single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}
