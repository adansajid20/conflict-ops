export const dynamic = 'force-dynamic'

export async function GET() {
  const body = `User-agent: *
Allow: /
Allow: /landing
Allow: /features
Allow: /pricing
Allow: /methods
Allow: /privacy
Allow: /terms
Allow: /status
Allow: /wire
Disallow: /overview
Disallow: /feed
Disallow: /map
Disallow: /alerts
Disallow: /missions
Disallow: /workbench
Disallow: /tracking
Disallow: /markets
Disallow: /geoverify
Disallow: /travel
Disallow: /usage
Disallow: /settings
Disallow: /api/v1
Sitemap: https://conflictradar.co/sitemap.xml
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'public, max-age=86400' },
  })
}
