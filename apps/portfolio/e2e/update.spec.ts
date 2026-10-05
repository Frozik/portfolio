import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { appTranslationsEn } from '../src/app/translations/en';

// A service worker can trap its users in one build forever: when it caches its
// own script, or when the shell it serves is never revalidated. These tests pin
// the two mechanisms that keep this app updating — the worker file stays out of
// every cache and the precached shell carries a content revision — and then
// perform a real update: a changed `sw.js` must take over the open page.
const DIST = resolve(import.meta.dirname, '..', 'dist');
const SERVICE_WORKER_FILE = resolve(DIST, 'sw.js');
const PRECACHE_ENTRY = /\{"revision":(?:null|"([0-9a-f]{32})"),"url":"([^"]+)"\}/g;
const UPDATE_RELOAD_TIMEOUT_MS = 60_000;
const PACK_DOWNLOAD_TIMEOUT_MS = 60_000;
/** Two pack downloads on a CI runner do not fit the default 30 s. */
const TEST_TIMEOUT_MS = 180_000;
const HASHED_ASSETS_CACHE = 'hashed-assets';

// Two tests here rewrite the one `dist/sw.js`; run side by side, one restores
// the file while the other's page is still waiting for the update it deployed.
test.describe.configure({ mode: 'default' });

function precacheManifest(): ReadonlyMap<string, string | null> {
  const source = readFileSync(SERVICE_WORKER_FILE, 'utf8');
  return new Map(
    [...source.matchAll(PRECACHE_ENTRY)].map(([, revision, url]) => [url, revision ?? null])
  );
}

test('the shell is precached with a content revision, so a new build replaces it', () => {
  const manifest = precacheManifest();
  expect(manifest.get('index.html')).toMatch(/^[0-9a-f]{32}$/);
  expect(manifest.get('404.html')).toMatch(/^[0-9a-f]{32}$/);
});

test('the worker script itself is never precached', () => {
  expect([...precacheManifest().keys()]).not.toContain('sw.js');
});

// A returning visitor: the page boots under the worker's control. `#root` is
// named by the deferred entry, so its presence means the update listener is up.
async function openAsReturningVisitor(page: Page): Promise<void> {
  await page.goto('');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.locator('#root').waitFor();
}

async function deployChangedWorker(page: Page): Promise<void> {
  const original = readFileSync(SERVICE_WORKER_FILE, 'utf8');
  try {
    writeFileSync(SERVICE_WORKER_FILE, `${original}\n// next build`);
    const reloaded = page.waitForEvent('load', { timeout: UPDATE_RELOAD_TIMEOUT_MS });
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then(registration => registration.update())
    );
    await reloaded;
  } finally {
    writeFileSync(SERVICE_WORKER_FILE, original);
  }
}

test('a changed worker takes over the open page and reloads it', async ({ page }) => {
  await openAsReturningVisitor(page);
  await expect
    .poll(() => page.evaluate(() => caches.keys().then(names => names.length)))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(async () => {
      for (const name of await caches.keys()) {
        if ((await (await caches.open(name)).match('/portfolio/sw.js')) !== undefined) {
          return name;
        }
      }
      return null;
    }),
    'no cache holds the worker script'
  ).toBeNull();

  await deployChangedWorker(page);

  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('nav').first()).toBeVisible();
});

test('a downloaded offline pack is completed again by the next build while it installs', async ({
  page,
}) => {
  test.setTimeout(TEST_TIMEOUT_MS);
  await openAsReturningVisitor(page);
  await page.getByRole('button', { name: appTranslationsEn.nav.openMenu }).click();
  const menu = page.getByRole('dialog');
  await menu.getByRole('button', { name: appTranslationsEn.offline.download }).click();
  await expect(menu.getByText(appTranslationsEn.offline.ready)).toBeVisible({
    timeout: PACK_DOWNLOAD_TIMEOUT_MS,
  });

  // Stands in for a build whose assets changed: one pack entry is no longer cached.
  // The 3D model belongs to the map demo alone, so nothing on the landing can
  // refetch it — only the installing worker can bring it back.
  const evicted = await page.evaluate(async cacheName => {
    const cache = await caches.open(cacheName);
    const model = (await cache.keys()).find(request => request.url.endsWith('.glb'));
    if (model === undefined) {
      throw new Error('the pack holds no .glb asset');
    }
    await cache.delete(model);
    return model.url;
  }, HASHED_ASSETS_CACHE);

  await deployChangedWorker(page);

  await expect
    .poll(
      () =>
        page.evaluate(
          ([cacheName, url]) =>
            caches
              .open(cacheName)
              .then(cache => cache.match(url))
              .then(Boolean),
          [HASHED_ASSETS_CACHE, evicted]
        ),
      { timeout: PACK_DOWNLOAD_TIMEOUT_MS }
    )
    .toBe(true);
});
