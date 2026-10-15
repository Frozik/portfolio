import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { FIXTURE_PASSWORD } from './fixture-vault';
import { openFromDrive } from './open-vault';

/** A page opened at the start goes on to the vault opened last; the list is its link away. */
async function toEveryVault(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('all-vaults').click();
  await expect(page.getByTestId('vault-list')).toBeVisible();
}

async function createLocalVault(page: Page, name: string): Promise<void> {
  await page.getByTestId('create-vault').click();
  await page.getByRole('textbox').first().fill(name);
  await page.locator('input[autocomplete="new-password"]').first().fill(FIXTURE_PASSWORD);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(FIXTURE_PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByTestId('create-submit').click();
  await expect(page.getByTestId('no-cards')).toBeVisible();
}

test('a new vault is made while another one is open, which locks', async ({ context }) => {
  const page = await openFromDrive(context);
  await toEveryVault(page);

  await createLocalVault(page, 'Personal');

  await expect(page.getByTestId('card-row')).toHaveCount(0);
});

test('another vault opens while an edit of the first is still in the editor', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await toEveryVault(page);
  await createLocalVault(page, 'Personal');
  const personal = page.url();
  await toEveryVault(page);
  await page.getByTestId('vault-row').filter({ hasNotText: 'Personal' }).click();
  await page.locator('input[autocomplete="current-password"]').fill(FIXTURE_PASSWORD);
  await page.locator('input[autocomplete="current-password"]').press('Enter');
  await page.getByTestId('card-row').first().click();
  await page.getByTestId('edit-card').click();
  await page.getByTestId('card-editor').getByRole('textbox').first().click();
  await page.keyboard.type(' draft');

  // Inside the app, as its own links go: no reload ends the first vault's session for it.
  await page.evaluate(path => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, new URL(personal).pathname);

  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
});

test('a locked vault leads back to every vault on this device', async ({ context }) => {
  const page = await openFromDrive(context);
  await page.getByTestId('lock').click();
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();

  await page.getByTestId('all-vaults').click();

  await expect(page.getByTestId('vault-row')).toHaveCount(1);
});

test('a vault is deleted from this device only once the deletion is confirmed', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await page.getByTestId('lock').click();
  await page.getByTestId('all-vaults').click();

  await page.getByTestId('vault-delete').click();
  await page.getByTestId('confirm-dialog-cancel').click();
  await expect(page.getByTestId('vault-row')).toHaveCount(1);
  await page.getByTestId('vault-delete').click();
  await page.getByTestId('confirm-dialog-confirm').click();

  await expect(page.getByTestId('no-vaults')).toBeVisible();
});

test('a page opened at the start goes on to the vault opened last', async ({ context }) => {
  const page = await openFromDrive(context);
  const vaultPath = new URL(page.url()).pathname.split('/').slice(0, 2).join('/');

  await page.goto('/');

  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(vaultPath);
});
