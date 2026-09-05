import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/portfolio/`;

// Smoke tests run against the production build served by `vite preview`, the
// same setup Lighthouse uses — never against the dev server.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 2,
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
      use: {
        ...devices['Desktop Chrome'],
        // Headless Chromium has no GPU: WebGPU either works through SwiftShader
        // or the app must show its unsupported notice — both are valid outcomes.
        launchOptions: { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader'] },
      },
    },
  ],
});
