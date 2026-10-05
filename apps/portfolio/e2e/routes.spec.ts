import type { ConsoleMessage } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { ROUTE_METADATA } from '../src/app/routeMetadata';
import { waitForApp } from './app-ready';

// Every navigable route must render without a console error or an uncaught
// exception. WebGPU demos may legitimately fall back to the unsupported notice
// in headless Chromium; a blank page or an error is never acceptable.

const ROUTES = ROUTE_METADATA.map(entry => entry.segment);
const IGNORED_CONSOLE_PATTERNS = [
  /cloudflareinsights/i,
  /ERR_BLOCKED_BY_CLIENT/i,
  /WebGPU/i,
  /GPUDevice/i,
  // Chrome's own log when the transport demo's HTTP/3 attempt finds UDP closed
  // or the server away; the demo falls back to WebSocket, which is the contract.
  /Failed to establish a connection to \S+\/transport: net::ERR_/,
];

// The signaling server is outside the smoke test: retro and conf probe its liveness on mount,
// and the probe is answered here so the run never depends on the server or its CORS rules.
const HEALTH_PROBE = '**/health/live';
const HEALTHY = { status: 200, contentType: 'application/json', body: '{"status":"ok"}' };

function isExpectedConsoleError(message: ConsoleMessage): boolean {
  const source = `${message.text()} ${message.location().url}`;
  return IGNORED_CONSOLE_PATTERNS.some(pattern => pattern.test(source));
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

    await page.route(HEALTH_PROBE, route => route.fulfill(HEALTHY));
    await page.goto(segment);
    await waitForApp(page);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('#initial-loader')).toHaveCount(0);
    await expect(page.locator('nav').first()).toBeVisible();

    expect(problems).toEqual([]);
  });
}

test('landing exposes the section navigation and the CV sections', async ({ page }) => {
  await page.goto('');
  await waitForApp(page);
  // The prerendered page carries one root per language until the deferred
  // bootstrap keeps the visitor's and names it `#root`.
  await expect(page.locator('#root h1')).toContainText(/Engineer|Инженер/);
  for (const id of ['about', 'skills', 'work', 'projects', 'contact']) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
});

test('unknown route shows the error page', async ({ page }) => {
  await page.goto('this-route-does-not-exist');
  await waitForApp(page);
  await expect(page.getByText(/404|Not Found/).first()).toBeVisible();
});
