import { auth as clerkAuth } from '@clerk/nextjs/server'

/**
 * Safe wrapper around Clerk's auth().
 * Returns { userId: null } instead of throwing when Clerk is unavailable
 * (e.g. missing keys, middleware not running clerkMiddleware, etc.).
 */
export async function safeAuth(): Promise<{ userId: string | null }> {
  try {
    const result = await clerkAuth()
    return { userId: result?.userId ?? null }
  } catch {
    return { userId: null }
  }
}
