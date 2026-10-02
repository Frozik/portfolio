import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/portfolio/`;
const UPDATE_SPEC = /update\.spec\.ts$/;
const CHROMIUM = {
  ...devices['Desktop Chrome'],
  // Headless Chromium has no GPU: WebGPU either works through SwiftShader
  // or the app must show its unsupported notice — both are valid outcomes.
  launchOptions: { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader'] },
};

// Smoke tests run against the production build served by `vite preview`, the
// same setup Lighthouse uses — never against the dev server.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
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
      name: 'chromium',
      testIgnore: UPDATE_SPEC,
      use: CHROMIUM,
    },
    // The update test rewrites `dist/sw.js` while it runs, which every other open
    // page would pick up as an update — so it runs alone, after the rest.
    {
      name: 'update',
      testMatch: UPDATE_SPEC,
      dependencies: ['chromium'],
      use: CHROMIUM,
    },
  ],
});
