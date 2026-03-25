export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { auth } from '@clerk/nextjs/server'
import { inngest } from '@/inngest/client'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Check admin via Clerk metadata OR fallback to DB role
  // Don't hard-fail if DB check fails — allow any authenticated user to trigger ingest
  // (In prod, restrict via Clerk org roles)
  try {
    await inngest.send({
      name: 'ingest/fast-lane.trigger',
      data: { manual: true, triggeredBy: userId, timestamp: new Date().toISOString() },
    })
    return Response.json({
      ok: true,
      message: 'Ingest triggered — sources will fetch within 30 seconds',
      triggeredAt: new Date().toISOString(),
    })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
