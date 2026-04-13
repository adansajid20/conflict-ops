export const dynamic = 'force-dynamic'

import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { setSafeMode } from '@/lib/cache/redis'
import { isSafeMode } from '@/lib/doctor/safe-mode-check'
import type { ApiResponse } from '@conflict-ops/shared'

type SafeModeBody = { enabled: boolean; reason?: string }

async function requireAdminOrInternal(req: Request): Promise<{ ok: true; userId: string | null } | { ok: false; response: NextResponse<ApiResponse<null>> }> {
  const internalSecret = req.headers.get('x-internal-secret')
  const expectedSecret = process.env['INTERNAL_SECRET'] ?? 'dev'
  if (internalSecret && internalSecret === expectedSecret) {
    return { ok: true, userId: null }
  }

  const { userId } = await safeAuth()
  if (!userId) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('role').eq('clerk_user_id', userId).single()
  if (!user || !['owner', 'admin'].includes(user.role ?? '')) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 }) }
  }

  return { ok: true, userId }
}

export async function POST(req: Request) {
  const gate = await requireAdminOrInternal(req)
  if (!gate.ok) return gate.response

  let body: SafeModeBody
  try {
    body = await req.json() as SafeModeBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const timestamp = new Date().toISOString()
    await supabase.from('system_flags').upsert(
      {
        key: 'safe_mode',
        value: { enabled: body.enabled },
        set_by: gate.userId ?? 'doctor',
        reason: body.reason ?? 'manual toggle',
        set_at: timestamp,
      },
      { onConflict: 'key' },
    )
    await setSafeMode(body.enabled)
    return NextResponse.json({ success: true, data: { safe_mode: body.enabled, timestamp } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update safe mode' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const gate = await requireAdminOrInternal(req)
  if (!gate.ok) return gate.response

  const safe = await isSafeMode()
  return NextResponse.json({ success: true, data: { safe_mode: safe } })
}
