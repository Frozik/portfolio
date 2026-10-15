import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;
const BASE_URL = `http://localhost:${PORT}/`;
const PORTFOLIO_PORT = 4173;
const PORTFOLIO_URL = `http://localhost:${PORTFOLIO_PORT}/portfolio/`;

// Every wait is for an event and passes the moment it happens; CI runners are
// slow and shared, so the margins are long.
const WAIT_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 120_000;
const CI_WORKERS = 2;
const UPDATES_SPEC = /updates\.spec\.ts$/;
const IPHONE_SPEC = /iphone\.spec\.ts$/;

// Against the production build served by `vite preview`, never the dev server:
// the CSP and the pre-paint script exist only in the build.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: WAIT_TIMEOUT_MS },
  workers: process.env.CI === undefined ? undefined : CI_WORKERS,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 2,
  failOnFlakyTests: process.env.CI !== undefined,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['github']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `pnpm exec vite preview --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 60_000,
    },
    // The move from the portfolio's vault needs the portfolio's build beside this one.
    {
      command: `pnpm exec vite preview --port ${PORTFOLIO_PORT} --strictPort`,
      cwd: '../portfolio',
      url: PORTFOLIO_URL,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 60_000,
    },
  ],
  projects: [
    { name: 'chromium', testIgnore: [UPDATES_SPEC, IPHONE_SPEC], use: devices['Desktop Chrome'] },
    // Linux WebKit is not iOS Safari: this checks layout and roles on an iPhone's screen only;
    // how the installed app behaves is checked on a real phone.
    { name: 'iphone', testMatch: IPHONE_SPEC, use: devices['iPhone 15'] },
    // The update tests rewrite `dist/sw.js` and `dist/version.json`, which every other open
    // page would pick up — so they run alone, after the rest.
    {
      name: 'updates',
      testMatch: UPDATES_SPEC,
      dependencies: ['chromium'],
      use: devices['Desktop Chrome'],
    },
  ],
});
