/**
 * GET /api/cron/ingest?token=<INTERNAL_SECRET>
 * Public cron trigger — for use with cron-job.org (free tier, GET only, no custom headers)
 * Token validated via query param instead of header.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  const validSecret = process.env['INTERNAL_SECRET'] ?? ''

  if (!token || token !== validSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Forward to the actual ingest handler
  const ingestUrl = new URL('/api/v1/admin/run-ingest', url.origin)
  const res = await fetch(ingestUrl.toString(), {
    method: 'POST',
    headers: {
      'x-internal-secret': validSecret,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(58000),
  })

  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
