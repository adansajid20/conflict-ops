import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateIntelReportSummary } from '@/lib/reports/summary'
import type { ApiResponse } from '@conflict-ops/shared'
import type { IntelReport } from '@/lib/reports/types'

export async function POST(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse<ApiResponse<{ summary: string }>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: actor } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!actor?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const { data: report, error } = await supabase.from('intel_reports').select('id,org_id,title,classification_banner,sections,created_by,shared_token,created_at,updated_at').eq('org_id', actor.org_id).eq('id', params.id).single()
  if (error || !report) return NextResponse.json({ success: false, error: error?.message ?? 'Report not found' }, { status: 404 })
  const eventIds = ((report.sections as Array<{ event_ids?: string[] }> | null) ?? []).flatMap((section) => section.event_ids ?? [])
  const { data: events } = eventIds.length > 0 ? await supabase.from('events').select('id,title,description,severity,country_code,occurred_at').in('id', eventIds) : { data: [] }
  const summary = await generateIntelReportSummary({ title: report.title, classification: report.classification_banner, sections: report.sections, events: events ?? [] })
  return NextResponse.json({ success: true, data: { summary } })
}
