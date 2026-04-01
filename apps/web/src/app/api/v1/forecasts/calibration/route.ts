import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrgPlanLimits } from '@/lib/plan-limits'

export const dynamic = 'force-dynamic'

type ForecastRecord = { analyst_id?: string | null; org_id?: string | null; score?: number | null; outcome?: boolean | null; resolved_at?: string | null }

function brier(prob: number, outcome: boolean) { return (prob - (outcome ? 1 : 0)) ** 2 }

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  const { data: user } = await supabase.from('users').select('org_id').eq('clerk_user_id', userId).single()
  if (!user?.org_id) return NextResponse.json({ success: false, error: 'No org' }, { status: 400 })
  const limits = await getOrgPlanLimits(user.org_id)
  if (!limits.scenarios) return NextResponse.json({ success: false, error: 'Calibration requires Business or Enterprise plan.' }, { status: 403 })
  const { data, error } = await supabase.from('forecasts').select('org_id, analyst_id, score, outcome, computed_at, resolved_at').eq('org_id', user.org_id).not('outcome', 'is', null).limit(500)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const rows = (data ?? []) as ForecastRecord[]
  const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: `${i * 10}-${i * 10 + 9}`, predicted: 0, actual: 0, count: 0 }))
  const byAnalyst = new Map<string, { analyst_id: string; count: number; total: number }>()
  const timeline: Array<{ date: string; brier: number }> = []
  for (const row of rows) {
    const score = Math.max(0, Math.min(1, row.score ?? 0))
    const outcome = Boolean(row.outcome)
    const b = brier(score, outcome)
    const bucketIndex = Math.min(9, Math.floor(score * 10))
    const bucket = buckets[bucketIndex]
    if (bucket) {
      bucket.predicted += score
      bucket.actual += outcome ? 1 : 0
      bucket.count += 1
    }
    const analystId = row.analyst_id ?? 'org'
    const current = byAnalyst.get(analystId) ?? { analyst_id: analystId, count: 0, total: 0 }
    current.count += 1
    current.total += b
    byAnalyst.set(analystId, current)
    timeline.push({ date: String(row.resolved_at ?? new Date().toISOString()).slice(0, 10), brier: b })
  }
  return NextResponse.json({ success: true, data: {
    summary: Array.from(byAnalyst.values()).map((item) => ({ ...item, brier: item.count ? item.total / item.count : 0 })).sort((a, b) => a.brier - b.brier),
    calibration_curve: buckets.map((bucket) => ({ bucket: bucket.bucket, predicted: bucket.count ? bucket.predicted / bucket.count : 0, actual: bucket.count ? bucket.actual / bucket.count : 0, count: bucket.count })),
    timeline,
    baseline_brier: 0.25,
  } })
}
