import { safeAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { assertOrgScoped } from '@/lib/testing/tenant-isolation'

type CheckResult = { name: string; pass: boolean; rows: number; error?: string }

async function getAdmin(clerkUserId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('users').select('org_id,role').eq('clerk_user_id', clerkUserId).single()
  return data
}

export async function GET() {
  const { userId } = await safeAuth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const user = await getAdmin(userId)
  if (!user?.org_id || !['owner', 'admin'].includes(String(user.role))) {
    return NextResponse.json({ success: false, error: 'Admin role required' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const checks: Array<{ name: string; table: string }> = [
    { name: 'events are org-scoped', table: 'events' },
    { name: 'missions are org-scoped', table: 'missions' },
    { name: 'alerts are org-scoped', table: 'alerts' },
    { name: 'API keys are org-scoped', table: 'api_keys' },
    { name: 'PIRs are org-scoped', table: 'pirs' },
  ]

  const results: CheckResult[] = []
  for (const check of checks) {
    try {
      const { data, error } = await supabase.from(check.table).select('org_id').eq('org_id', user.org_id).limit(50)
      if (error) throw error
      const rows = (data ?? []) as Array<{ org_id?: string | null }>
      assertOrgScoped(rows, user.org_id)
      results.push({ name: check.name, pass: true, rows: rows.length })
    } catch (error) {
      results.push({ name: check.name, pass: false, rows: 0, error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  return NextResponse.json({ success: true, data: results })
}
