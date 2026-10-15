import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { FIXTURE_CARDS } from './fixture-vault';
import { openFromDrive } from './open-vault';

const DIST = resolve(import.meta.dirname, '..', 'dist');
const SERVICE_WORKER = resolve(DIST, 'sw.js');
const VERSION_MANIFEST = resolve(DIST, 'version.json');
const KILL_SWITCH = resolve(import.meta.dirname, '..', 'dist-kill-switch', 'sw.js');
const RELEASE_VERSION = /^v?(\d+)\.\d+\.\d+/;

// Every test here rewrites a file the server hands out; side by side, one would restore it
// while another's page still waits for what it deployed.
test.describe.configure({ mode: 'default' });

async function openAsReturningVisitor(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect(page.getByTestId('no-vaults')).toBeVisible();
}

async function askForUpdate(page: Page): Promise<void> {
  await page.evaluate(() =>
    navigator.serviceWorker.ready.then(registration => registration.update())
  );
}

/** The next major release after the one this build reports. */
async function nextMajor(page: Page): Promise<string> {
  const version = (await page.getByTestId('app-version').textContent()) ?? '';
  const major = RELEASE_VERSION.exec(version)?.[1];
  expect(major, `the build carries a release version, not "${version}"`).toBeDefined();
  return `v${Number(major) + 1}.0.0`;
}

function publishVersions(web: { readonly latest: string; readonly minimum: string }): void {
  writeFileSync(VERSION_MANIFEST, JSON.stringify({ web }));
}

test.afterEach(() => {
  rmSync(VERSION_MANIFEST, { force: true });
});

test('the whole build is precached, so the app opens offline after one visit', async ({
  page,
  context,
}) => {
  await openAsReturningVisitor(page);
  await context.setOffline(true);

  await page.reload();

  await expect(page.getByTestId('no-vaults')).toBeVisible();
  await context.setOffline(false);
});

test('a new build takes over a page that holds no key', async ({ page }) => {
  await openAsReturningVisitor(page);
  const original = readFileSync(SERVICE_WORKER, 'utf8');
  try {
    writeFileSync(SERVICE_WORKER, `${original}\n// next build`);
    const reloaded = page.waitForEvent('load');
    await askForUpdate(page);
    await reloaded;
  } finally {
    writeFileSync(SERVICE_WORKER, original);
  }

  await expect(page.getByTestId('no-vaults')).toBeVisible();
});

test('a build below the floor says it must update; one past it is offered the new release', async ({
  page,
}) => {
  await page.goto('/');
  const next = await nextMajor(page);

  publishVersions({ latest: next, minimum: next });
  await page.reload();
  await expect(page.getByTestId('update-notice')).toHaveAttribute('data-state', 'required');

  publishVersions({ latest: next, minimum: 'v0.0.1' });
  await page.reload();
  await expect(page.getByTestId('update-notice')).toHaveAttribute('data-state', 'available');
});

test('without a readable floor nothing is blocked', async ({ page }) => {
  writeFileSync(VERSION_MANIFEST, '<html>not a manifest</html>');
  await page.goto('/');

  await expect(page.getByTestId('no-vaults')).toBeVisible();
  await expect(page.getByTestId('update-notice')).toHaveCount(0);
});

test('the kill switch clears every cache and leaves no worker installed', async ({ page }) => {
  await openAsReturningVisitor(page);
  const original = readFileSync(SERVICE_WORKER, 'utf8');
  try {
    copyFileSync(KILL_SWITCH, SERVICE_WORKER);
    const reloaded = page.waitForEvent('load');
    await askForUpdate(page);
    await reloaded;

    await expect
      .poll(() =>
        page.evaluate(async () => ({
          caches: (await caches.keys()).length,
          workers: (await navigator.serviceWorker.getRegistrations()).length,
        }))
      )
      .toEqual({ caches: 0, workers: 0 });
  } finally {
    writeFileSync(SERVICE_WORKER, original);
  }
});

test('a new build waits while a vault is open, and takes over once it is locked', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const original = readFileSync(SERVICE_WORKER, 'utf8');
  try {
    writeFileSync(SERVICE_WORKER, `${original}\n// next build`);
    await askForUpdate(page);
    await page.waitForFunction(() =>
      navigator.serviceWorker
        .getRegistration()
        .then(registration => (registration?.waiting ?? null) !== null)
    );
    await expect(page.getByTestId('card-row')).toHaveCount(FIXTURE_CARDS);

    await page.getByTestId('lock').click();
    await page.waitForFunction(() =>
      navigator.serviceWorker
        .getRegistration()
        .then(registration => (registration?.waiting ?? null) === null)
    );
  } finally {
    writeFileSync(SERVICE_WORKER, original);
  }

  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
});

test('a floor raised above this build locks an open vault and waits for the new one', async ({
  context,
}) => {
  const page = await context.newPage();
  await page.goto('/');
  const next = await nextMajor(page);
  await openFromDrive(context, page);

  publishVersions({ latest: next, minimum: next });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByTestId('update-notice')).toHaveAttribute('data-state', 'required');
  await expect(page.getByTestId('card-row')).toHaveCount(0);
});
