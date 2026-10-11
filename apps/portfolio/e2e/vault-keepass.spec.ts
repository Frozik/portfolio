import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { waitForApp } from './app-ready';

const KEEPASS_FILE = fileURLToPath(new URL('./fixtures/keepass.kdbx', import.meta.url));
const KEEPASS_PASSWORD = 'keepass master';

// plan task 26d — a KeePass database through the real build: kdbxweb, its XML
// parser and Argon2 in a Worker of their own, which the bundle must carry.
test('a KeePass database opens with its password and its entries join the vault', async ({
  page,
}) => {
  await page.goto('vault');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.locator('input[type="file"]').first().setInputFiles(KEEPASS_FILE);
  await page.getByLabel('Master password of the KeePass database').fill('not it');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByText('Wrong password', { exact: false })).toBeVisible();
  await page.getByLabel('Master password of the KeePass database').fill(KEEPASS_PASSWORD);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  await page.getByRole('link', { name: 'Back to the vault' }).click();
  await expect(page.getByRole('option', { name: /KeePass forum/ })).toBeVisible();
});
