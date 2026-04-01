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

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  classification_banner: z.string().optional(),
  sections: z.array(SectionSchema).optional(),
})

export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse<ApiResponse<IntelReport>>> {
  const actor = await getActor()
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('intel_reports').select('id,org_id,title,classification_banner,sections,created_by,shared_token,created_at,updated_at').eq('org_id', actor.org_id).eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Report not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: data as IntelReport })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }): Promise<NextResponse<ApiResponse<IntelReport>>> {
  const actor = await getActor()
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
  const payload: { title?: string; classification_banner?: string; sections?: ReportSection[]; updated_at: string } = { updated_at: new Date().toISOString() }
  if (parsed.data.title !== undefined) payload.title = parsed.data.title
  if (parsed.data.classification_banner !== undefined) payload.classification_banner = parsed.data.classification_banner
  if (parsed.data.sections !== undefined) payload.sections = parsed.data.sections
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('intel_reports').update(payload).eq('org_id', actor.org_id).eq('id', params.id).select('id,org_id,title,classification_banner,sections,created_by,shared_token,created_at,updated_at').single()
  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Failed to update report' }, { status: 500 })
  return NextResponse.json({ success: true, data: data as IntelReport })
}
