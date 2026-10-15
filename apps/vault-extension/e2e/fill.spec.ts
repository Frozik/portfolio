import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { unlockedExtension } from './unlocked-extension';

const CARD_ID = 'card-e2e';

/** What the test calls from the popup page: the two extension APIs a "Fill" goes through. */
declare const chrome: {
  readonly tabs: { query(filter: { readonly url: string }): Promise<{ readonly id?: number }[]> };
  readonly runtime: { sendMessage(message: unknown): Promise<unknown> };
};

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
