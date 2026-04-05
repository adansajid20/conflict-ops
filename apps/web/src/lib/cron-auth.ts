import type { NextRequest } from 'next/server'

/**
 * Accepts EITHER:
 * - Vercel's auto-injected Authorization: Bearer <CRON_SECRET> header
 * - Our legacy ?token=<INTERNAL_SECRET> query param
 */
export function cronAuthOk(req: NextRequest): boolean {
  // Vercel injects CRON_SECRET as Authorization: Bearer header
  const authHeader = req.headers.get('authorization')
  if (authHeader && process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true
  }
  // Legacy: query param token matches INTERNAL_SECRET
  const token = new URL(req.url).searchParams.get('token') ?? ''
  const secret = process.env.INTERNAL_SECRET ?? ''
  if (token && secret && token === secret) return true

  return false
}
