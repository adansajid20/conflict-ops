export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/v1/admin/ingest-now
 * Manually triggers ingestion via Inngest event.
 * Requires admin role.
 */

import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/server'
import { inngest } from '@/inngest/client'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('role').eq('clerk_user_id', userId).single()

  if (!user || !['owner', 'admin'].includes(user.role ?? '')) {
    return Response.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    await inngest.send({ name: 'ingest/fast-lane.trigger', data: { manual: true, triggeredBy: userId } })
    return Response.json({ ok: true, message: 'Ingest triggered — runs within 30 seconds', triggeredAt: new Date().toISOString() })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
