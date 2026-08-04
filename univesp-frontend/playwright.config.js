import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  timeout: 30000,
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-chromium{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4176',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4176',
    url: 'http://127.0.0.1:4176/crm/login',
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      VITE_ENABLE_MOCKS: 'false',
    },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
