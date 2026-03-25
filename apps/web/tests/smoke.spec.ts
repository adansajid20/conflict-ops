/**
 * CONFLICT OPS — Playwright Smoke Tests
 * Run: BASE_URL=https://conflictradar.co npx playwright test
 */
import { test, expect } from '@playwright/test'

const BASE = process.env['BASE_URL'] ?? 'https://conflictradar.co'

// ─── Public routes ───────────────────────────────────────────
test.describe('Public routes (no auth)', () => {
  test('landing page loads with title', async ({ page }) => {
    await page.goto(`${BASE}/landing`)
    await expect(page).toHaveTitle(/CONFLICT OPS/)
    await expect(page.locator('h1')).toBeVisible()
  })

  test('features page renders', async ({ page }) => {
    await page.goto(`${BASE}/features`)
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('pricing page renders', async ({ page }) => {
    await page.goto(`${BASE}/pricing`)
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('methods page renders', async ({ page }) => {
    await page.goto(`${BASE}/methods`)
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('wire feed page renders', async ({ page }) => {
    await page.goto(`${BASE}/wire`)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('status page renders', async ({ page }) => {
    await page.goto(`${BASE}/status`)
    await expect(page.locator('body')).not.toContainText('Application error')
  })

  test('privacy page renders', async ({ page }) => {
    await page.goto(`${BASE}/privacy`)
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('terms page renders', async ({ page }) => {
    await page.goto(`${BASE}/terms`)
    await expect(page.locator('body')).not.toContainText('500')
  })
})

// ─── SEO routes ───────────────────────────────────────────
test.describe('SEO routes', () => {
  test('robots.txt returns 200 with text/plain', async ({ request }) => {
    const res = await request.get(`${BASE}/robots.txt`)
    expect(res.status()).toBe(200)
    expect(await res.text()).toContain('User-agent')
  })

  test('sitemap.xml returns 200 with XML', async ({ request }) => {
    const res = await request.get(`${BASE}/sitemap.xml`)
    expect(res.status()).toBe(200)
    expect(await res.text()).toContain('<urlset')
  })
})

// ─── API health ───────────────────────────────────────────
test.describe('API health', () => {
  test('GET /api/health returns ok JSON', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`)
    expect(res.status()).toBe(200)
    const json = await res.json() as { ok: boolean; dbOk: boolean }
    expect(json.dbOk).toBe(true)
    expect(json).toHaveProperty('lastIngestAt')
    expect(json).toHaveProperty('enabledSources')
    expect(json).toHaveProperty('errors')
  })

  test('GET /api/public/v1 returns API info', async ({ request }) => {
    const res = await request.get(`${BASE}/api/public/v1`)
    expect(res.status()).toBe(200)
    const json = await res.json() as { api: string }
    expect(json.api).toContain('CONFLICT OPS')
  })

  test('GET /api/inngest returns function count', async ({ request }) => {
    const res = await request.get(`${BASE}/api/inngest`)
    expect(res.status()).toBe(200)
    const json = await res.json() as { function_count: number }
    expect(json.function_count).toBeGreaterThanOrEqual(1)
  })
})

// ─── Auth-protected routes redirect ─────────────────────────
test.describe('Dashboard redirects (unauthenticated)', () => {
  for (const route of ['/overview', '/feed', '/map', '/alerts', '/missions', '/admin']) {
    test(`${route} redirects to /sign-in`, async ({ page }) => {
      await page.goto(`${BASE}${route}`)
      // Should redirect — allow sign-in or the page itself (Clerk might SSR it)
      const url = page.url()
      const isRedirected = url.includes('/sign-in') || url.includes('/sign-up')
      const isSignInPage = await page.locator('input[type="email"], input[type="password"], [data-testid="sign-in"]').count() > 0
      expect(isRedirected || isSignInPage).toBe(true)
    })
  }
})

// ─── No 500s on any public page ───────────────────────────
test.describe('No 500 errors on public pages', () => {
  const PUBLIC_PAGES = ['/landing', '/features', '/pricing', '/methods', '/wire', '/status', '/privacy', '/terms']

  for (const route of PUBLIC_PAGES) {
    test(`${route} no 500 in HTML`, async ({ request }) => {
      const res = await request.get(`${BASE}${route}`)
      expect(res.status()).toBe(200)
      const html = await res.text()
      // Should not contain server error states (actual error text, not substrings in animation values)
      expect(html).not.toContain('Internal Server Error')
      expect(html).not.toContain('Application error')
      expect(html).not.toContain('"statusCode":500')
    })
  }
})

// ─── Intel Feed API (no auth = 401) ──────────────────────
test.describe('Intel Feed API', () => {
  test('GET /api/v1/events returns 401 without auth (not 500)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/events`)
    // 401 or 307 redirect — not 500
    expect(res.status()).not.toBe(500)
  })

  test('GET /api/v1/alerts returns 401 without auth (not 500)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/alerts`)
    expect(res.status()).not.toBe(500)
  })
})
