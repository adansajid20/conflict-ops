/**
 * Admin: Database cleanup endpoint
 * Removes bad data accumulated before severity calibration fixes.
 * Protected by x-internal-secret header.
 *
 * POST /api/v1/admin/cleanup
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const INTERNAL_SECRET = process.env['INTERNAL_SECRET'] ?? ''

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== INTERNAL_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const results: Record<string, number | string> = {}

  try {
    // 1. Delete news_rss events with severity >= 3 (wrongly tagged as High/Critical)
    const { count: newsRssDeleted, error: e1 } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .eq('source', 'news_rss')
      .gte('severity', 3)
    if (e1) results['news_rss_high_sev'] = `error: ${e1.message}`
    else results['news_rss_high_sev_deleted'] = newsRssDeleted ?? 0

    // 2. Delete gdelt events with severity >= 3
    const { count: gdeltDeleted, error: e2 } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .eq('source', 'gdelt')
      .gte('severity', 3)
    if (e2) results['gdelt_high_sev'] = `error: ${e2.message}`
    else results['gdelt_high_sev_deleted'] = gdeltDeleted ?? 0

    // 3. Delete events older than 30 days (keep DB lean)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count: oldDeleted, error: e3 } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .lt('occurred_at', thirtyDaysAgo)
    if (e3) results['old_events'] = `error: ${e3.message}`
    else results['old_events_deleted'] = oldDeleted ?? 0

    // 4. Delete events with null/empty/placeholder titles
    const { count: badTitleDeleted, error: e4 } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .or('title.is.null,title.eq.,title.like.%[Removed]%')
    if (e4) results['bad_titles'] = `error: ${e4.message}`
    else results['bad_title_deleted'] = badTitleDeleted ?? 0

    const total =
      (results['news_rss_high_sev_deleted'] as number ?? 0) +
      (results['gdelt_high_sev_deleted'] as number ?? 0) +
      (results['old_events_deleted'] as number ?? 0) +
      (results['bad_title_deleted'] as number ?? 0)

    return NextResponse.json({ ok: true, total_deleted: total, details: results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
