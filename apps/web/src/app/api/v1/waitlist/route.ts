import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'

const Schema = z.object({ email: z.string().email() })

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ email: string }>>> {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const supabase = createServiceClient()
  const { error } = await supabase.from('waitlist').upsert({ email: parsed.data.email }, { onConflict: 'email', ignoreDuplicates: true })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: { email: parsed.data.email } }, { status: 201 })
}
