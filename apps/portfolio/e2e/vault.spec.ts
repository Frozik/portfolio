import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { waitForApp } from './app-ready';

const DEMO_PASSWORD = 'demo';

async function openDemo(page: Page): Promise<void> {
  await page.goto('vault');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();
}

async function unlock(page: Page): Promise<void> {
  const password = page.getByLabel('Master password');
  await password.fill(DEMO_PASSWORD);
  await password.press('Enter');
}

// plan task 16 — the vault's path through the real build: the Argon2 and codec
// Workers, IndexedDB, the lock by reload and the deep link that survives it.
test('demo: search, copy, edit, lock by reload, unlock back to the same card', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDemo(page);

  await page.keyboard.type('git');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.getByRole('option', { name: /GitHub/ }).click();
  await page.getByRole('button', { name: 'Copy' }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).not.toBe('');

  await page.getByRole('button', { name: 'Edit' }).click();
  const title = page.getByRole('textbox', { name: 'Title' });
  await title.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' (work)');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'GitHub (work)' })).toBeVisible();
  const cardUrl = page.url();

  await page.getByRole('button', { name: 'Lock' }).click();
  await expect(page.getByLabel('Master password')).toBeVisible();
  expect(page.url()).toBe(cardUrl);
  await unlock(page);

  await expect(page.getByRole('heading', { name: 'GitHub (work)' })).toBeVisible();
});

test('a deep link to a card asks for the password, then opens that card', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('option', { name: /Dropbox/ }).click();
  await expect(page.getByRole('heading', { name: 'Dropbox' })).toBeVisible();
  const cardUrl = page.url();

  const fresh = await page.context().newPage();
  await fresh.goto(cardUrl);
  await waitForApp(fresh);
  await unlock(fresh);

  await expect(fresh.getByRole('heading', { name: 'Dropbox' })).toBeVisible();
});

test('leaving the page locks the vault; coming back asks for the password', async ({ page }) => {
  await openDemo(page);

  await page.goto('');
  await waitForApp(page);
  await page.goBack();

  await expect(page.getByLabel('Master password')).toBeVisible();
});
