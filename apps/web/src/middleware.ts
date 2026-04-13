import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Middleware with safe Clerk integration.
 *
 * Uses clerkMiddleware for auth context. If Clerk throws (e.g. invalid
 * keys), falls through to NextResponse.next() so the site stays up.
 */

const clerk = clerkMiddleware()

export default async function middleware(
  ...args: Parameters<typeof clerk>
) {
  try {
    return await clerk(...args)
  } catch {
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
