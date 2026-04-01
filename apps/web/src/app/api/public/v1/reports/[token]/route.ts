import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@conflict-ops/shared'
import type { IntelReport } from '@/lib/reports/types'

export async function GET(_req: Request, { params }: { params: { token: string } }): Promise<NextResponse<ApiResponse<IntelReport>>> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('intel_reports').select('id,org_id,title,classification_banner,sections,created_by,shared_token,created_at,updated_at').eq('shared_token', params.token).single()
  if (error || !data) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: data as IntelReport })
}
