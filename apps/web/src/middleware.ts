import { NextResponse } from 'next/server'

/**
 * Middleware – passes all requests through.
 *
 * Clerk auth is handled at the component/API-route level via useUser() and
 * auth() calls instead of at the middleware level. This avoids the hard crash
 * that occurs when clerkMiddleware() is invoked without valid publishable /
 * secret keys (it throws "Publishable key not valid" internally before any
 * user-supplied try/catch can intercept it).
 */
export default function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
