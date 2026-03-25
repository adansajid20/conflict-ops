export const dynamic = 'force-dynamic'

export async function GET() {
  const base = 'https://conflictradar.co'
  const pages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/landing', priority: '1.0', changefreq: 'weekly' },
    { url: '/features', priority: '0.9', changefreq: 'weekly' },
    { url: '/pricing', priority: '0.9', changefreq: 'weekly' },
    { url: '/methods', priority: '0.7', changefreq: 'monthly' },
    { url: '/privacy', priority: '0.3', changefreq: 'monthly' },
    { url: '/terms', priority: '0.3', changefreq: 'monthly' },
    { url: '/status', priority: '0.5', changefreq: 'hourly' },
    { url: '/wire', priority: '0.8', changefreq: 'hourly' },
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${base}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' },
  })
}
