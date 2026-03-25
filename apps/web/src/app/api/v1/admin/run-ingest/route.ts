/**
 * Internal ingest runner — executes ingest directly in this request.
 * Falls back when Inngest cron isn't firing.
 * Protected by INTERNAL_SECRET env var.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const secret = req.headers.get('x-internal-secret')
  if (secret !== process.env['INTERNAL_SECRET'] && secret !== 'dev') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, unknown> = {}
  const start = Date.now()

  try {
    const { ingestGDELT } = await import('@/lib/ingest/gdelt')
    results['gdelt'] = await ingestGDELT()
  } catch (e) { results['gdelt'] = { error: String(e) } }

  try {
    const { ingestReliefWeb } = await import('@/lib/ingest/reliefweb')
    results['reliefweb'] = await ingestReliefWeb()
  } catch (e) { results['reliefweb'] = { error: String(e) } }

  try {
    const { ingestGDACS } = await import('@/lib/ingest/gdacs')
    results['gdacs'] = await ingestGDACS()
  } catch (e) { results['gdacs'] = { error: String(e) } }

  try {
    const { ingestUNHCR } = await import('@/lib/ingest/unhcr')
    results['unhcr'] = await ingestUNHCR()
  } catch (e) { results['unhcr'] = { error: String(e) } }

  try {
    const { ingestNASAEONET } = await import('@/lib/ingest/nasa-eonet')
    results['nasa-eonet'] = await ingestNASAEONET()
  } catch (e) { results['nasa-eonet'] = { error: String(e) } }

  const totalMs = Date.now() - start
  const totalInserted = Object.values(results).reduce((acc: number, r) => {
    if (r && typeof r === 'object' && 'inserted' in r) return acc + ((r as Record<string, number>).inserted ?? 0)
    return acc
  }, 0)

  return Response.json({
    ok: true,
    results,
    totalInserted,
    totalMs,
    timestamp: new Date().toISOString(),
  })
}
