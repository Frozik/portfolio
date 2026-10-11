import { fileURLToPath } from 'node:url';

import type { BrowserContext, Page } from '@playwright/test';
import { chromium, expect, test } from '@playwright/test';

const EXTENSION = fileURLToPath(new URL('../.output/chrome-mv3-e2e', import.meta.url));
const VAULT_FILE = fileURLToPath(new URL('fixtures/e2e.pwv', import.meta.url));
const MASTER_PASSWORD = 'e2e master password';
const CARD_ID = 'card-e2e';
const LOGIN_PAGE = `<!doctype html><title>Sign in</title><form>
  <input type="email" name="email" autocomplete="username">
  <input type="password" name="password" autocomplete="current-password">
  <button>Sign in</button></form>`;

/** What the test calls from the popup page: the two extension APIs a "Fill" goes through. */
declare const chrome: {
  readonly tabs: { query(filter: { readonly url: string }): Promise<{ readonly id?: number }[]> };
  readonly runtime: { sendMessage(message: unknown): Promise<unknown> };
};

/** A browser with the extension, its popup set up from the fixture file and unlocked through its own screens. */
async function unlockedExtension(): Promise<{
  readonly context: BrowserContext;
  readonly popup: Page;
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
  return { context, popup };
}

/** "Fill" as the popup sends it, for the tab at `tabUrl`, the popup having seen `pageUrl`. */
function fill(popup: Page, tabUrl: string, pageUrl = tabUrl): Promise<unknown> {
  return popup.evaluate(
    async ({ tabUrl: url, pageUrl: seen, cardId }) => {
      const [tab] = await chrome.tabs.query({ url });
      return chrome.runtime.sendMessage({
        kind: 'fill',
        cardId,
        tabId: tab?.id,
        pageUrl: seen,
        allowInsecure: false,
      });
    },
    { tabUrl, pageUrl, cardId: CARD_ID }
  );
}

test('fills the card’s login and password on its site', async () => {
  const { context, popup } = await unlockedExtension();
  const site = await context.newPage();
  await site.goto('https://login.example.test/sign-in');

  expect(await fill(popup, site.url())).toBe('filled');

  await expect(site.locator('input[name="email"]')).toHaveValue('jane@example.test');
  await expect(site.locator('input[name="password"]')).toHaveValue('correct-battery-42');
  await context.close();
});

test('refuses another site, another subdomain, and a tab that moved after the click', async () => {
  const { context, popup } = await unlockedExtension();
  const other = await context.newPage();
  await other.goto('https://evil.example.test/sign-in');
  const subdomain = await context.newPage();
  await subdomain.goto('https://sub.login.example.test/sign-in');

  expect(await fill(popup, other.url())).toBe('other-site');
  expect(await fill(popup, subdomain.url())).toBe('other-site');
  expect(await fill(popup, other.url(), 'https://login.example.test/sign-in')).toBe('other-site');

  for (const page of [other, subdomain]) {
    await expect(page.locator('input[name="password"]')).toHaveValue('');
  }
  await context.close();
});
