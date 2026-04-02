export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ count: 0 })
  }

  const supabase = createClient()
  const { count } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('active', true)

  return NextResponse.json({ count: count ?? 0 })
}
