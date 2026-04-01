import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { checkSourceSLA } from '@/lib/data-contracts/monitor'
import type { ApiResponse } from '@conflict-ops/shared'

export async function GET(): Promise<NextResponse<ApiResponse<Awaited<ReturnType<typeof checkSourceSLA>>>>> {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const data = await checkSourceSLA()
  return NextResponse.json({ success: true, data })
}
