export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { setSafeMode, isSafeMode } from '@/lib/cache/redis'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('role').eq('clerk_user_id', userId).single()
  if (!user || !['owner', 'admin'].includes(user.role ?? '')) {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { enabled } = await req.json() as { enabled: boolean }

  try {
    await setSafeMode(enabled)
    return Response.json({ ok: true, safe_mode: enabled, timestamp: new Date().toISOString() })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const safe = await isSafeMode()
  return Response.json({ safe_mode: safe })
}
