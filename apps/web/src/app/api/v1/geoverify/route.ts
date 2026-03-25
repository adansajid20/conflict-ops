import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { computeConfidenceScore, scoreToTier } from '@/lib/geoverify/engine'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  source_url: z.string().url(),
  claimed_location: z.string().max(200).optional(),
  claimed_time: z.string().optional(),
  initial_lat: z.number().optional(),
  initial_lng: z.number().optional(),
  notes: z.string().max(2000).optional(),
})

const UpdateCheckSchema = z.object({
  verification_id: z.string().uuid(),
  method: z.string(),
  result: z.enum(['pass', 'fail', 'inconclusive', 'pending']),
  notes: z.string().max(1000).optional(),
})

async function getUserId(clerkId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id, org_id').eq('clerk_user_id', clerkId).single()
  return data
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserId(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('geo_verifications')
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await getUserId(userId)
  if (!user?.org_id) return NextResponse.json({ error: 'No org' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? 'create'

  const supabase = createServiceClient()

  if (action === 'add_check') {
    const parsed = UpdateCheckSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const { data: existing } = await supabase
      .from('geo_verifications')
      .select('id, checks')
      .eq('id', parsed.data.verification_id)
      .eq('org_id', user.org_id)
      .single()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const checks = [
      ...((existing.checks as Array<Record<string, unknown>>) ?? []),
      {
        method: parsed.data.method,
        result: parsed.data.result,
        notes: parsed.data.notes ?? '',
        analyst: user.id,
        timestamp: new Date().toISOString(),
      },
    ]

    const confidence = computeConfidenceScore(checks as Parameters<typeof computeConfidenceScore>[0])
    const tier = scoreToTier(confidence, checks as Parameters<typeof scoreToTier>[1])

    const { data, error } = await supabase
      .from('geo_verifications')
      .update({ checks, confidence_score: confidence, tier, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data })
  }

  // Default: create new verification
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const { data, error } = await supabase
    .from('geo_verifications')
    .insert({
      org_id: user.org_id,
      analyst_id: user.id,
      source_url: parsed.data.source_url,
      claimed_location: parsed.data.claimed_location ?? null,
      claimed_time: parsed.data.claimed_time ?? null,
      assigned_lat: parsed.data.initial_lat ?? null,
      assigned_lng: parsed.data.initial_lng ?? null,
      notes: parsed.data.notes ?? null,
      tier: 'unverified',
      confidence_score: 0,
      checks: [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data }, { status: 201 })
}
