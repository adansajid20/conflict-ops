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
  '/api/cron/(.*)',
  '/api/v1/article-preview(.*)',
  '/api/v1/events(.*)',
  '/api/v1/overview(.*)',
  '/api/v1/feed(.*)',
  '/api/v1/map/(.*)',
  '/api/flights(.*)',
  '/api/vessels(.*)',
  '/api/acled(.*)',
  '/api/v1/live/(.*)',
  '/api/v1/alerts/(.*)',
  '/api/v1/situations(.*)',
  '/api/v1/correlation-signals(.*)',
  '/api/v1/region-risk(.*)',
  '/api/v1/actors(.*)',
  '/api/v1/actors/relationships(.*)',
  '/api/v1/actors/graph(.*)',
  '/api/v1/intelligence-reports(.*)',
  '/api/v1/predictions(.*)',
  '/api/v1/trends(.*)',
  '/api/v1/track(.*)',
  '/api/v1/similarity(.*)',
  '/api/v1/commodities(.*)',
  '/api/v1/countries(.*)',
  '/api/v1/sanctions(.*)',
  '/api/v1/tools/(.*)',
  '/api/v1/export/(.*)',
  '/api/stripe/webhook(.*)',
  '/situations(.*)',
  '/actors(.*)',
  '/intelligence(.*)',
  '/overview(.*)',
  '/intel(.*)',
  '/map(.*)',
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
