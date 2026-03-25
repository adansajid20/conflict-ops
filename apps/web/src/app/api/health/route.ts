export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'CONFLICT OPS',
  })
}
