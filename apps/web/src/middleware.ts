import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/landing(.*)',
  '/features(.*)',
  '/pricing(.*)',
  '/methods(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/status(.*)',
  '/wire(.*)',
  '/security(.*)',
  '/robots.txt',
  '/sitemap.xml',
  '/api/webhooks/(.*)',
  '/api/public/(.*)',
  '/api/health(.*)',
  '/api/inngest(.*)',
  '/api/v1/admin/run-ingest(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId } = auth()
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname)
      return NextResponse.redirect(signInUrl)
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
