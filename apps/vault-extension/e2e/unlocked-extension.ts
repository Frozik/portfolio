import { fileURLToPath } from 'node:url';

import type { BrowserContext, Page, Worker } from '@playwright/test';
import { chromium, expect } from '@playwright/test';

const EXTENSION = fileURLToPath(new URL('../.output/chrome-mv3-e2e', import.meta.url));
const VAULT_FILE = fileURLToPath(new URL('fixtures/e2e.pwv', import.meta.url));
export const MASTER_PASSWORD = 'e2e master password';
const LOGIN_PAGE = `<!doctype html><title>Sign in</title><form>
  <input type="email" name="email" autocomplete="username">
  <input type="password" name="password" autocomplete="current-password">
  <button>Sign in</button></form>`;

/** A browser with the extension, its popup set up from the fixture file and unlocked through its own screens. */
export async function unlockedExtension(): Promise<{
  readonly context: BrowserContext;
  readonly popup: Page;
  readonly worker: Worker;
}> {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await context.route('https://*.example.test/**', route =>
    route.fulfill({ contentType: 'text/html', body: LOGIN_PAGE })
  );
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${new URL(worker.url()).host}/popup.html`);
  await popup.locator('input[type="file"]').setInputFiles(VAULT_FILE);
  await popup.getByLabel('Master password').fill(MASTER_PASSWORD);
  await popup.getByRole('button', { name: 'Unlock' }).click();
  await expect(popup.getByRole('button', { name: 'Lock' })).toBeVisible();
  return { context, popup, worker };
}
