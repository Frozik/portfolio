import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { FIXTURE_CARDS } from './fixture-vault';
import { openFromDrive } from './open-vault';

const KEEPASS_FILE = fileURLToPath(new URL('./fixtures/keepass.kdbx', import.meta.url));
const KEEPASS_PASSWORD = 'keepass master';

// A KeePass database through the real build: kdbxweb, its XML parser and Argon2 in a Worker
// of their own, which the bundle must carry.
test('a KeePass database opens with its password and its entries join the vault', async ({
  context,
}) => {
  const page = await openFromDrive(context);
  await page.getByTestId('tab-settings').click();

  await page.locator('input[type="file"]').first().setInputFiles(KEEPASS_FILE);
  const password = page.getByTestId('import-password').locator('input[type="password"]');
  await password.fill('not it');
  await page.getByTestId('import-open').click();
  await expect(page.getByTestId('import-password')).toHaveAttribute('data-state', 'wrong-password');
  await password.fill(KEEPASS_PASSWORD);
  await page.getByTestId('import-open').click();
  await page.getByTestId('import-apply').click();

  await page.getByTestId('tab-vault').click();
  await expect(page.getByTestId('card-row')).not.toHaveCount(FIXTURE_CARDS);
});
