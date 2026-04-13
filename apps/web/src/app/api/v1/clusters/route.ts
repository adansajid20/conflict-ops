import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse<{ success: boolean; data?: unknown; error?: string }>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('event_clusters')
    .select('id, canonical_title, canonical_summary, event_ids, source_count, country_code, severity, event_type, significance_score, latest_event_at')
    .order('latest_event_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}
