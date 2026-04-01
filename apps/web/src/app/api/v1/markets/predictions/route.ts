import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const KEYWORDS = ['ukraine','russia','gaza','israel','iran','syria','taiwan','china','sudan','yemen','red sea','lebanon','sahel','korea']

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('prediction_markets').select('*').order('resolution_date', { ascending: true }).limit(100)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const filtered = (data ?? []).filter((row) => {
    const title = String(row.title ?? '').toLowerCase()
    return KEYWORDS.some((keyword) => title.includes(keyword))
  })
  return NextResponse.json({ success: true, data: filtered })
}
