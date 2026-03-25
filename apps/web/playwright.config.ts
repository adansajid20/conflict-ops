import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 20_000,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env['BASE_URL'] ?? 'https://conflictradar.co',
    extraHTTPHeaders: { 'Accept-Language': 'en-US' },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], javaScriptEnabled: true } },
  ],
})
