/**
 * Public REST API — Business plan and above
 * Authenticated via API key (Bearer token)
 * Rate limited via Upstash
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'

async function authenticateAPIKey(req: Request): Promise<{
  orgId: string
  planId: string
} | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const apiKey = authHeader.slice(7)
  if (!apiKey) return null

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('api_keys')
    .select('org_id, orgs(plan_id)')
    .eq('key_hash', hashApiKey(apiKey))
    .eq('active', true)
    .single()

  if (!data) return null

  const orgData = data as unknown as { org_id: string; orgs: { plan_id: string } | null }
  return {
    orgId: orgData.org_id,
    planId: orgData.orgs?.plan_id ?? 'free',
  }
}

function hashApiKey(key: string): string {
  // In production use crypto.subtle — this is a stub
  const { createHash } = require('crypto') as typeof import('crypto')
  return createHash('sha256').update(key).digest('hex')
}

let ratelimit: Ratelimit | null = null
function getRatelimit(): Ratelimit {
  if (!ratelimit && process.env['UPSTASH_REDIS_REST_URL']) {
    const redis = Redis.fromEnv()
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000, '1 h'), // 1000 req/hour for Business
    })
  }
  return ratelimit!
}

export async function GET(req: Request) {
  const auth = await authenticateAPIKey(req)
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Valid API key required. Get one at conflictradar.co/settings/api' },
      { status: 401 }
    )
  }

  if (!['business', 'enterprise'].includes(auth.planId)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'API access requires Business plan or higher.' },
      { status: 403 }
    )
  }

  // Rate limit
  const rl = getRatelimit()
  if (rl) {
    const { success, remaining } = await rl.limit(auth.orgId)
    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', message: '1000 requests per hour on Business plan.' },
        {
          status: 429,
          headers: { 'Retry-After': '3600', 'X-RateLimit-Remaining': String(remaining) },
        }
      )
    }
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 500)
  const offset = parseInt(url.searchParams.get('offset') ?? '0')
  const countryCode = url.searchParams.get('country')
  const severity = url.searchParams.get('severity_gte')
  const since = url.searchParams.get('since') // ISO date

  const supabase = createServiceClient()
  let query = supabase
    .from('events')
    .select('id,source,event_type,title,description,region,country_code,severity,status,occurred_at,ingested_at')
    .not('status', 'eq', 'clustered')
    .order('occurred_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (countryCode) query = query.eq('country_code', countryCode)
  if (severity) query = query.gte('severity', parseInt(severity))
  if (since) query = query.gte('occurred_at', since)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    meta: {
      count: data?.length ?? 0,
      total: count,
      offset,
      limit,
      next: data?.length === limit ? `?offset=${offset + limit}&limit=${limit}` : null,
    },
  }, {
    headers: {
      'X-API-Version': 'v1',
      'X-Attribution': 'Powered by CONFLICT OPS (conflictradar.co)',
    },
  })
}
