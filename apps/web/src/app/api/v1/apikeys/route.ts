/**
 * API Key Management — Business plan+
 * Keys are generated here, hashed before storage.
 * Plaintext shown ONCE — then gone.
 */

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'
import { z } from 'zod'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({ name: z.string().min(1).max(80) })

async function getUser(clerkId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id,role').eq('clerk_user_id', clerkId).single()
  return data
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('api_keys')
    .select('id,name,key_prefix,active,last_used,expires_at,created_at')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ success: true, data: data ?? [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.apiAccess) return NextResponse.json({ error: 'API access requires Business plan.' }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const rawKey = `cok_live_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 16) + '...'

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ org_id: user.org_id, created_by: user.id, name: parsed.data.name, key_hash: keyHash, key_prefix: keyPrefix, active: true })
    .select('id,name,key_prefix,created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    data: { ...data, key: rawKey },
    message: 'Store this key securely — it will not be shown again.',
  }, { status: 201 })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const user = await getUser(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = createServiceClient()
  await supabase.from('api_keys').update({ active: false }).eq('id', id).eq('org_id', user.org_id)
  return NextResponse.json({ success: true, data: null })
}
