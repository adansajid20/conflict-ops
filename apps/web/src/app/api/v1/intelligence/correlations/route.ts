import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { findCorrelations, type CorrelationResult } from '@/lib/intelligence/correlations'
import type { ApiResponse } from '@conflict-ops/shared'

const RequestSchema = z.object({
  region: z.string().min(1).optional(),
  days: z.number().int().min(1).max(90).optional(),
})

export async function POST(req: Request): Promise<NextResponse<ApiResponse<CorrelationResult[]>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  let body: unknown = {}
  try { body = await req.json() } catch { body = {} }
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })

  const since = new Date(Date.now() - (parsed.data.days ?? 30) * 24 * 60 * 60 * 1000).toISOString()
  let query = supabase.from('events').select('id,region,event_type,occurred_at').gte('occurred_at', since).limit(1000)
  if (parsed.data.region) query = query.ilike('region', `%${parsed.data.region}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: findCorrelations((data ?? []) as Array<{ id: string; region?: string | null; event_type?: string | null; occurred_at?: string | null }>) })
}
