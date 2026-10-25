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
  projects: [
    { name: 'default', testIgnore: /shortcut-pairing\.spec\.ts/ },
    {
      name: 'shortcut-pairing',
      testMatch: /shortcut-pairing\.spec\.ts/,
      use: { baseURL: 'http://sizzle.test:3212' },
    },
  ],
  webServer: [
    {
      // Keep defaults independent of a maintainer's local .env.
      command:
        'RAILS_ENV=test SIZZLE_THEME_EDITOR=true SIZZLE_SHORTCUT_PAIRING=false bin/rails server -b 127.0.0.1 -p 3211 -P tmp/pids/browser-default.pid',
      url: 'http://127.0.0.1:3211/up',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        'RAILS_ENV=test SIZZLE_THEME_EDITOR=true SIZZLE_SHORTCUT_PAIRING=true bin/rails server -b 127.0.0.1 -p 3212 -P tmp/pids/browser-shortcuts.pid',
      url: 'http://127.0.0.1:3212/up',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
