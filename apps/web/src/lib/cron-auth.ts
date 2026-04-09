import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Accepts EITHER:
 * - Vercel's auto-injected Authorization: Bearer <CRON_SECRET> header
 * - Our legacy ?token=<INTERNAL_SECRET> query param
 */
export function cronAuthOk(req: NextRequest): boolean {
  // Vercel injects CRON_SECRET as Authorization: Bearer header
  const authHeader = req.headers.get('authorization')
  if (authHeader && process.env.CRON_SECRET) {
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`
    try {
      if (timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedAuth))) {
        return true
      }
    } catch {
      // timingSafeEqual throws if lengths don't match
    }
  }

  // Legacy: query param token matches INTERNAL_SECRET
  const token = new URL(req.url).searchParams.get('token') ?? ''
  const secret = process.env.INTERNAL_SECRET ?? ''

  // Fail closed: INTERNAL_SECRET must be at least 20 chars long
  if (!secret || secret.length < 20) {
    return false
  }

  if (token && secret) {
    try {
      if (timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
        return true
      }
    } catch {
      // timingSafeEqual throws if lengths don't match
    }
  }

  return false
}
