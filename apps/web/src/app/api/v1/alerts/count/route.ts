export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'

function isMissingAlertsTable(error: { message?: string; code?: string } | null | undefined) {
  const message = `${error?.message ?? ''}`.toLowerCase()
  return error?.code === '42P01' || message.includes('relation') && message.includes('alerts') && message.includes('does not exist')
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ count: 0 })
  }

  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_active', true)

  if (isMissingAlertsTable(error)) {
    return NextResponse.json({ count: 0, note: 'alerts table missing' })
  }

  if (error) {
    return NextResponse.json({ count: 0, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
