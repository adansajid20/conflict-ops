export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sanitizeEventForClient } from '@/lib/event-presentation'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ event: null }, { status: 404 })
  }

  return NextResponse.json({
    event: {
      ...data,
      description: sanitizeEventForClient(data).description,
      outlet_name: sanitizeEventForClient(data).outlet_name,
      source_id: sanitizeEventForClient(data).source_url,
      summary_short: typeof data.summary_short === 'string' ? data.summary_short : null,
    },
  })
}
