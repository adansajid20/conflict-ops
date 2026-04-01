import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { rotateApiKey } from '@/lib/security/key-rotation'

const Schema = z.object({ key_id: z.string().uuid() })

async function getUser(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const data = await rotateApiKey(parsed.data.key_id, user.org_id)
  if (!data) return NextResponse.json({ success: false, error: 'Unable to rotate key' }, { status: 400 })
  return NextResponse.json({ success: true, data })
}
