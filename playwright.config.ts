import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    { name: 'iphone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npx tsx scripts/seed-e2e.ts && npm run start -- --port 3100',
    url: 'http://localhost:3100',
    env: { CACHE_DIR: '.data-e2e', SITE_URL: 'http://localhost:3100' },
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
