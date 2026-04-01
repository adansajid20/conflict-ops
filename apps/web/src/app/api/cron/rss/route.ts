import { NextResponse } from 'next/server'
import { ingestRSSLive } from '@/lib/ingest/rss-live'

export const runtime = 'nodejs'
export const maxDuration = 30

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const internalSecret = process.env.INTERNAL_SECRET
  const cronSecret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization')

  if (token && internalSecret && token === internalSecret) return true
  if (authorization && cronSecret && authorization === `Bearer ${cronSecret}`) return true

  return false
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await ingestRSSLive()
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
