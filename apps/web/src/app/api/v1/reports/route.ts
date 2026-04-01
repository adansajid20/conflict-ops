import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'
import type { IntelReport, ReportSection } from '@/lib/reports/types'

const SectionSchema = z.object({
  type: z.enum(['header', 'text', 'events', 'ai_summary']),
  content: z.string(),
  event_ids: z.array(z.string()).optional(),
})

async function getActor() {
  const { userId } = await auth()
  if (!userId) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('id,org_id').eq('clerk_user_id', userId).single()
  return data
}

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  classification_banner: z.string().default('UNCLASSIFIED'),
})

export async function GET(): Promise<NextResponse<ApiResponse<IntelReport[]>>> {
  const actor = await getActor()
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('intel_reports').select('id,org_id,title,classification_banner,sections,created_by,shared_token,created_at,updated_at').eq('org_id', actor.org_id).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: (data ?? []) as IntelReport[] })
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<IntelReport>>> {
  const actor = await getActor()
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('intel_reports').insert({ org_id: actor.org_id, title: parsed.data.title, classification_banner: parsed.data.classification_banner, sections: [], created_by: actor.id }).select('id,org_id,title,classification_banner,sections,created_by,shared_token,created_at,updated_at').single()
  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Failed to create report' }, { status: 500 })
  return NextResponse.json({ success: true, data: data as IntelReport }, { status: 201 })
}
