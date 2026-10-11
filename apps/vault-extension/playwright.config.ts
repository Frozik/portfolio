import { defineConfig } from '@playwright/test';

// Waits are for events (the worker answered, the field changed) and pass the
// moment they happen; the margin is for slow shared CI runners.
const WAIT_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 120_000;

/** The e2e build (`wxt build --mode e2e`) loaded into Chromium's own channel. */
export default defineConfig({
  testDir: './e2e',
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: WAIT_TIMEOUT_MS },
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 2,
  failOnFlakyTests: process.env.CI !== undefined,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['github']],
});
