export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Redis } from '@upstash/redis'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('role').eq('clerk_user_id', userId).single()
  if (!user || !['owner', 'admin'].includes(user.role ?? '')) {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { enabled } = await req.json() as { enabled: boolean }

  const redis = new Redis({
    url: process.env['UPSTASH_REDIS_REST_URL']!,
    token: process.env['UPSTASH_REDIS_REST_TOKEN']!,
  })

  if (enabled) {
    await redis.set('system:safe_mode', '1', { ex: 3600 }) // auto-expires in 1h
  } else {
    await redis.del('system:safe_mode')
  }

  return Response.json({ ok: true, safe_mode: enabled, timestamp: new Date().toISOString() })
}
