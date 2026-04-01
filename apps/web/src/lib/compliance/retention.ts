import { createServiceClient } from '@/lib/supabase/server'

export async function enforceRetention(orgId: string): Promise<{ success: boolean; deletedEvents: number; deletedComments: number; retentionDays: number }> {
  const supabase = createServiceClient()
  const { data: org } = await supabase.from('orgs').select('data_retention_days').eq('id', orgId).single()
  const retentionDays = org?.data_retention_days ?? 365
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

  const [eventsResult, commentsResult] = await Promise.all([
    supabase.from('events').delete({ count: 'exact' }).lt('occurred_at', cutoff),
    supabase.from('event_comments').delete({ count: 'exact' }).eq('org_id', orgId).lt('created_at', cutoff),
  ])

  return {
    success: !eventsResult.error && !commentsResult.error,
    deletedEvents: eventsResult.count ?? 0,
    deletedComments: commentsResult.count ?? 0,
    retentionDays,
  }
}
