import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/portfolio/`;
const UPDATE_SPEC = /update\.spec\.ts$/;
const ROUTES_SPEC = /routes\.spec\.ts$/;
const CHROMIUM = devices['Desktop Chrome'];
// Headless Chromium has no GPU: WebGPU either works through SwiftShader or the
// app must show its unsupported notice — both are valid outcomes. Only the
// route walk gets it: SwiftShader posing as a GPU runs canvas and compositing
// without backpressure, so a page left animating for a minute queues minutes
// of raster that the renderer drains, frozen, on the next navigation.
const WEBGPU_CHROMIUM = {
  ...CHROMIUM,
  launchOptions: { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader'] },
};

// Every wait in these tests is for an event — the app mounted, the worker
// cached the shell — and passes the moment it happens. CI runners are slow and
// shared, so the waits are long: the margin is spent only where it is needed,
// and a slow machine never reads as a broken app. Navigations get no limit of
// their own beyond the test's: a page load is not what these tests measure.
const WAIT_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 120_000;
// What Playwright picks on GitHub's 4-core runner; the pre-push hook runs with
// CI=1 as well, so local runs see the same parallelism.
const CI_WORKERS = 2;

// Smoke tests run against the production build served by `vite preview`, the
// same setup Lighthouse uses — never against the dev server.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: WAIT_TIMEOUT_MS },
  workers: process.env.CI === undefined ? undefined : CI_WORKERS,
  forbidOnly: process.env.CI !== undefined,
  // Retries tell a flaky test from a broken one in the report; either fails the run.
  retries: process.env.CI === undefined ? 0 : 2,
  failOnFlakyTests: process.env.CI !== undefined,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['github']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'routes',
      testMatch: ROUTES_SPEC,
      use: WEBGPU_CHROMIUM,
    },
    {
      name: 'chromium',
      testIgnore: [UPDATE_SPEC, ROUTES_SPEC],
      use: CHROMIUM,
    },
    // The update test rewrites `dist/sw.js` while it runs, which every other open
    // page would pick up as an update — so it runs alone, after the rest.
    {
      name: 'update',
      testMatch: UPDATE_SPEC,
      dependencies: ['routes', 'chromium'],
      use: CHROMIUM,
    },
  ],
});
