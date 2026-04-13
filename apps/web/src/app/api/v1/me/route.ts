export const dynamic = 'force-dynamic'

import { safeAuth } from '@/lib/auth'
import { ensureUserProvisioned } from '@/lib/user/provision'

export async function GET() {
  try {
    const { userId } = await safeAuth()
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await ensureUserProvisioned(userId)
    return Response.json({ success: true, data: user })
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 })
  }
}
