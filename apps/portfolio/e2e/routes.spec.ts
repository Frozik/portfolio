import { resolve } from 'node:path';

import type { ConsoleMessage } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';

import { ROUTE_METADATA } from '../src/app/routeMetadata';

// Every navigable route must render without a console error or an uncaught
// exception. WebGPU demos may legitimately fall back to the unsupported notice
// in headless Chromium; a blank page or an error is never acceptable.

const ROUTES = ROUTE_METADATA.map(entry => entry.segment);
const IGNORED_CONSOLE_PATTERNS = [
  /cloudflareinsights/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /WebGPU/i,
  /GPUDevice/i,
];

// The signaling server is outside the smoke test: its health probe fails (refused or CORS)
// and the retro / conf routes must still render.
const COMMUNICATION_HOST = new URL(
  loadEnv('production', resolve(import.meta.dirname, '..'), 'VITE_').VITE_COMMUNICATION_URL ??
    'http://localhost:4445'
).host;

function isExpectedConsoleError(message: ConsoleMessage): boolean {
  const source = `${message.text()} ${message.location().url}`;
  return (
    source.includes(COMMUNICATION_HOST) ||
    IGNORED_CONSOLE_PATTERNS.some(pattern => pattern.test(source))
  );
}

for (const segment of ROUTES) {
  test(`route /${segment} renders without errors`, async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', error => {
      problems.push(`pageerror: ${error.message}`);
    });
    page.on('console', message => {
      if (message.type() !== 'error') {
        return;
      }
      if (isExpectedConsoleError(message)) {
        return;
      }
      problems.push(`console.error: ${message.text()}`);
    });

    await page.goto(segment);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('#initial-loader')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('nav').first()).toBeVisible();

    expect(problems).toEqual([]);
  });
}

test('landing exposes the section navigation and the CV sections', async ({ page }) => {
  await page.goto('');
  await expect(page.locator('h1')).toContainText(/Engineer|Инженер/);
  for (const id of ['about', 'skills', 'work', 'projects', 'contact']) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
});

test('unknown route shows the error page', async ({ page }) => {
  await page.goto('this-route-does-not-exist');
  await expect(page.getByText(/404|Not Found/).first()).toBeVisible();
});
