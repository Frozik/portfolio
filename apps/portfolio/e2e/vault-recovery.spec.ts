import { expect, test } from '@playwright/test';

import { waitForApp } from './app-ready';

const DEMO_PASSWORD = 'demo';

// plan task 22b — the recovery key through the real build: the Emergency Kit
// PDF renders in the browser, the key turns on only after its last group is
// typed back, and after a lock it opens the vault and asks for a new password.
test('a recovery key made in the settings opens the vault in place of the password', async ({
  page,
}) => {
  await page.goto('vault');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Create a recovery key…' }).click();
  const key =
    (await page
      .locator('code')
      .filter({ hasText: /^[0-9A-Z]{4}(-[0-9A-Z]{4}){6}$/ })
      .textContent()) ?? '';
  await expect(page.getByRole('button', { name: 'Save the Emergency Kit (PDF)' })).toBeVisible();
  await page.getByRole('button', { name: 'I have it' }).click();
  await page.getByLabel('The last group of the key').fill(key.split('-').at(-1) ?? '');
  await page
    .getByRole('region', { name: 'Recovery key' })
    .getByLabel('Master password', { exact: true })
    .fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Turn the recovery key on' }).click();
  await expect(page.getByTestId('recovery-key-on')).toBeVisible();

  await page.getByRole('link', { name: 'Back to the vault' }).click();
  await page.getByRole('button', { name: 'Lock' }).click();
  await page.getByRole('button', { name: 'Forgot the password? Use the recovery key' }).click();
  const field = page.getByLabel('Recovery key');
  await field.fill(key);
  await field.press('Enter');

  await expect(page.getByTestId('opened-with-recovery-key')).toBeVisible();
});
