import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { translateEvent } from '@/lib/translation/translate'
import type { ApiResponse } from '@conflict-ops/shared'

type TranslateBody = { event_id?: string }

type EventRow = {
  id: string
  description: string | null
  description_original: string | null
  description_lang: string | null
  description_translated: string | null
}

export async function POST(req: Request): Promise<NextResponse<ApiResponse<{ translated: boolean; description_translated: string | null }>>> {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as TranslateBody | null
  if (!body?.event_id) return NextResponse.json({ success: false, error: 'event_id is required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, description, description_original, description_lang, description_translated')
    .eq('id', body.event_id)
    .single()

  if (error || !data) return NextResponse.json({ success: false, error: error?.message ?? 'Event not found' }, { status: 404 })

  const result = await translateEvent(data as EventRow)
  return NextResponse.json({ success: true, data: result })
}
