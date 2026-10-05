import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { appTranslationsEn } from '../src/app/translations/en';
import { waitForApp } from './app-ready';

// The offline pack promises that every demo opens without a network once it is
// downloaded. The test takes the visitor's path — the menu button — and then
// checks both the promise's mechanism (every built asset is in a cache) and the
// promise itself (routes render with the network cut).
const GAME_ROUTES = ['sudoku', 'tanks', 'scorched', 'space-golf'];
const DIST_ASSETS = resolve(import.meta.dirname, '..', 'dist', 'assets');
const PACK_DOWNLOAD_TIMEOUT_MS = 60_000;
/** A CI runner downloads the pack and renders four routes in well over the default 30 s. */
const TEST_TIMEOUT_MS = 180_000;

async function openMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: appTranslationsEn.nav.openMenu }).click();
}

async function cachedPaths(page: Page): Promise<Set<string>> {
  const urls = await page.evaluate(async () => {
    const collected: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      collected.push(...(await cache.keys()).map(request => request.url));
    }
    return collected;
  });
  return new Set(urls.map(url => new URL(url).pathname));
}

async function assetsMissingFromCaches(page: Page): Promise<string[]> {
  const cached = await cachedPaths(page);
  return readdirSync(DIST_ASSETS).filter(asset => !cached.has(`/portfolio/assets/${asset}`));
}

test('the menu downloads the offline pack and every game then opens with the network cut', async ({
  page,
  context,
}) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  await page.goto('');
  await waitForApp(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await openMenu(page);
  const menu = page.getByRole('dialog');
  await expect(menu.getByText(appTranslationsEn.offline.incomplete)).toBeVisible();
  await menu.getByRole('button', { name: appTranslationsEn.offline.download }).click();
  await expect(menu.getByText(appTranslationsEn.offline.ready, { exact: true })).toBeVisible({
    timeout: PACK_DOWNLOAD_TIMEOUT_MS,
  });

  // The page's view of CacheStorage trails the worker's writes by a moment.
  await expect.poll(() => assetsMissingFromCaches(page)).toEqual([]);

  await context.setOffline(true);
  const problems: string[] = [];
  page.on('pageerror', error => {
    problems.push(error.message);
  });
  for (const segment of GAME_ROUTES) {
    // Readiness is asserted below; the full `load` of an offline page proves nothing more.
    await page.goto(segment, { waitUntil: 'domcontentloaded' });
    await waitForApp(page);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('#initial-loader')).toHaveCount(0);
    await expect(page.locator('nav').first()).toBeVisible();
  }
  expect(problems).toEqual([]);
});
