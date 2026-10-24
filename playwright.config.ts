import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/browser',
  workers: 1,
  use: {
    baseURL: 'http://sizzle.test:3211',
    launchOptions: {
      args: ['--host-resolver-rules=MAP sizzle.test 127.0.0.1', '--no-proxy-server'],
    },
  },
  webServer: {
    command: 'RAILS_ENV=test bin/rails server -b 127.0.0.1 -p 3211',
    url: 'http://127.0.0.1:3211/up',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
