import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const internalSecret = request.headers.get('x-internal-secret')

  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    internalSecret !== process.env.INTERNAL_SECRET
  ) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://conflictradar.co'
    const response = await fetch(`${baseUrl}/api/v1/admin/run-ingest`, {
      method: 'POST',
      headers: {
        'x-internal-secret': process.env.INTERNAL_SECRET || '',
      },
      cache: 'no-store',
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Cron ingest failed',
      },
      { status: 500 },
    )
  }
}
